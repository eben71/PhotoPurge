const { fetchWithTimeout } = require("./http");

const API_ROOT = "https://photospicker.googleapis.com/v1";
const DEFAULT_TIMEOUT_MS = 20000;

async function requestJson(url, { accessToken, method = "GET", body = null }) {
  const response = await fetchWithTimeout(
    url,
    {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    DEFAULT_TIMEOUT_MS,
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Picker API request failed (${response.status}): ${message}`);
  }

  return response.json();
}

async function createSession({ accessToken, maxItemCount }) {
  const body = {};
  if (maxItemCount) {
    body.pickingConfig = {
      maxItemCount: String(maxItemCount),
    };
  }

  return requestJson(`${API_ROOT}/sessions`, {
    accessToken,
    method: "POST",
    body,
  });
}

async function getSession({ accessToken, sessionId }) {
  return requestJson(`${API_ROOT}/sessions/${sessionId}`, {
    accessToken,
  });
}

async function listMediaItems({ accessToken, sessionId, pageSize, pageToken }) {
  const params = new URLSearchParams({
    sessionId,
  });
  if (pageSize) {
    params.set("pageSize", String(pageSize));
  }
  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  return requestJson(`${API_ROOT}/mediaItems?${params.toString()}`, {
    accessToken,
  });
}

module.exports = {
  createSession,
  getSession,
  listMediaItems,
};
