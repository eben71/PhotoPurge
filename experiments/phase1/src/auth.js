const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const http = require('http');
const readline = require('readline');
const { fetchWithTimeout } = require('./http');

const TOKEN_DIR = path.join(__dirname, '..', '.tokens');
const TOKEN_FILE_VERSION = 1;
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_SCOPE = 'https://www.googleapis.com/auth/photoslibrary.readonly';
const TOKEN_TIMEOUT_MS = 20000;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function sanitizeTokenId(tokenId) {
  const cleaned = tokenId.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(cleaned)) {
    throw new Error('token-id must be alphanumeric, dash, or underscore only');
  }
  return cleaned;
}

function tokenPathFor(tokenId) {
  const safeId = sanitizeTokenId(tokenId);
  return path.join(TOKEN_DIR, `${safeId}.enc`);
}

async function ensureTokenDir() {
  await fs.mkdir(TOKEN_DIR, { recursive: true, mode: 0o700 });
}

function parseRedirectUri(redirectUri) {
  const parsed = new URL(redirectUri);
  if (parsed.protocol !== 'http:') {
    throw new Error('redirect URI must be http:// for local OAuth callback');
  }
  return {
    hostname: parsed.hostname,
    port: Number(parsed.port || 80),
    pathname: parsed.pathname,
  };
}

function base64UrlEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function generatePkcePair() {
  const verifier = base64UrlEncode(crypto.randomBytes(32));
  const challenge = base64UrlEncode(
    crypto.createHash('sha256').update(verifier).digest(),
  );
  return { verifier, challenge };
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    rl.stdoutMuted = true;
    rl._writeToOutput = function writeToOutput(stringToWrite) {
      if (rl.stdoutMuted) {
        rl.output.write('*');
      } else {
        rl.output.write(stringToWrite);
      }
    };

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

let cachedPassword = null;

async function getEncryptionPassword() {
  if (process.env.TOKEN_PASSWORD) {
    return process.env.TOKEN_PASSWORD;
  }
  if (cachedPassword) {
    return cachedPassword;
  }
  cachedPassword = await promptHidden('Token encryption password: ');
  return cachedPassword;
}

function encryptTokens(tokens, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(password, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const payload = Buffer.from(JSON.stringify(tokens), 'utf8');
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: TOKEN_FILE_VERSION,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };
}

function decryptTokens(envelope, password) {
  if (envelope.version !== TOKEN_FILE_VERSION) {
    throw new Error(`Unsupported token file version ${envelope.version}`);
  }
  const salt = Buffer.from(envelope.salt, 'base64');
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const data = Buffer.from(envelope.data, 'base64');
  const key = crypto.scryptSync(password, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

async function loadTokens(tokenId) {
  const filePath = tokenPathFor(tokenId);
  try {
    const fileContents = await fs.readFile(filePath, 'utf8');
    const envelope = JSON.parse(fileContents);
    const password = await getEncryptionPassword();
    return decryptTokens(envelope, password);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function saveTokens(tokenId, tokens) {
  await ensureTokenDir();
  const password = await getEncryptionPassword();
  const envelope = encryptTokens(tokens, password);
  const filePath = tokenPathFor(tokenId);
  await fs.writeFile(filePath, JSON.stringify(envelope, null, 2), {
    mode: 0o600,
  });
}

function buildAuthUrl({ clientId, redirectUri, state, codeChallenge }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: OAUTH_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
    include_granted_scopes: 'true',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

function waitForAuthCode(redirectUri, expectedState) {
  const { hostname, port, pathname } = parseRedirectUri(redirectUri);

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${hostname}:${port}`);
      if (url.pathname !== pathname) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || state !== expectedState) {
        res.writeHead(400);
        res.end('Invalid OAuth response');
        server.close();
        reject(new Error('OAuth state mismatch or missing code'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Authentication complete. You can close this window.');
      server.close();
      resolve(code);
    });

    server.listen(port, hostname, () => {
      console.log(`Listening for OAuth callback on ${hostname}:${port}${pathname}`);
    });
  });
}

async function exchangeAuthCodeForTokens({
  clientId,
  clientSecret,
  redirectUri,
  code,
  codeVerifier,
}) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code,
    code_verifier: codeVerifier,
  });

  const response = await fetchWithTimeout(
    TOKEN_ENDPOINT,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
    TOKEN_TIMEOUT_MS,
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${message}`);
  }

  const payload = await response.json();
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    scope: payload.scope,
    token_type: payload.token_type,
    expiry_date: payload.expires_in
      ? Date.now() + payload.expires_in * 1000
      : null,
  };
}

async function refreshAccessToken({
  clientId,
  clientSecret,
  refreshToken,
}) {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetchWithTimeout(
    TOKEN_ENDPOINT,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
    TOKEN_TIMEOUT_MS,
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${message}`);
  }

  const payload = await response.json();
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    scope: payload.scope,
    token_type: payload.token_type,
    expiry_date: payload.expires_in
      ? Date.now() + payload.expires_in * 1000
      : null,
  };
}

function isTokenExpired(tokens) {
  if (!tokens.expiry_date) {
    return false;
  }
  const bufferMs = 60 * 1000;
  return Date.now() >= tokens.expiry_date - bufferMs;
}

async function ensureTokens(tokenId) {
  const clientId = requireEnv('CLIENT_ID');
  const clientSecret = requireEnv('CLIENT_SECRET');
  const redirectUri = requireEnv('REDIRECT_URI');

  let tokens = await loadTokens(tokenId);
  if (!tokens) {
    const state = base64UrlEncode(crypto.randomBytes(16));
    const { verifier, challenge } = generatePkcePair();
    const authUrl = buildAuthUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge: challenge,
    });

    console.log('Open the following URL to authorize:');
    console.log(authUrl);

    const code = await waitForAuthCode(redirectUri, state);
    tokens = await exchangeAuthCodeForTokens({
      clientId,
      clientSecret,
      redirectUri,
      code,
      codeVerifier: verifier,
    });
    await saveTokens(tokenId, tokens);
  }

  return {
    tokens,
    clientId,
    clientSecret,
    redirectUri,
  };
}

async function getValidAccessToken({ tokenId, metrics, forceRefresh = false }) {
  const { tokens: existingTokens, clientId, clientSecret } =
    await ensureTokens(tokenId);
  let tokens = existingTokens;

  if (forceRefresh || isTokenExpired(tokens)) {
    if (!tokens.refresh_token) {
      throw new Error('Missing refresh token; re-authentication required.');
    }
    const refreshed = await refreshAccessToken({
      clientId,
      clientSecret,
      refreshToken: tokens.refresh_token,
    });
    tokens = {
      ...tokens,
      access_token: refreshed.access_token,
      expiry_date: refreshed.expiry_date,
      scope: refreshed.scope ?? tokens.scope,
      token_type: refreshed.token_type ?? tokens.token_type,
      refresh_token: refreshed.refresh_token || tokens.refresh_token,
    };
    await saveTokens(tokenId, tokens);
    if (metrics) {
      metrics.token_refresh_events += 1;
    }
  }

  return tokens.access_token;
}

module.exports = {
  getValidAccessToken,
  loadTokens,
  requireEnv,
};
