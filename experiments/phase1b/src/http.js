const DEFAULT_TIMEOUT_MS = 30000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildBackoffDelayMs(attempt, retryAfterSeconds) {
  if (retryAfterSeconds !== null) {
    return Math.max(0, retryAfterSeconds * 1000);
  }
  const base = 500;
  const max = 10000;
  const jitter = 0.3;
  const exponential = Math.min(max, base * 2 ** (attempt - 1));
  const jitterMs = exponential * jitter * Math.random();
  return Math.floor(exponential + jitterMs);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  buildBackoffDelayMs,
  fetchWithTimeout,
  sleep,
};
