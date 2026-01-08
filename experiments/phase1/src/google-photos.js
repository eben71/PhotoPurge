const { buildBackoffDelayMs, fetchWithTimeout, sleep } = require("./http");

const API_BASE = "https://photoslibrary.googleapis.com/v1";

function createMetrics() {
  return {
    total_requests: 0,
    rate_limit_events: {
      count: 0,
      by_status: {},
      retry_after_seconds: [],
    },
    retry_count: 0,
    total_backoff_wait_seconds: 0,
    token_refresh_events: 0,
    failures_by_type: {
      network: 0,
      auth: 0,
      quota: 0,
      server: 0,
      other: 0,
    },
  };
}

async function apiRequest({
  url,
  method = "GET",
  body,
  getAccessToken,
  metrics,
  maxRetries = 5,
}) {
  let attempt = 0;
  let lastError;
  let forceRefresh = false;

  while (attempt <= maxRetries) {
    attempt += 1;
    const accessToken = await getAccessToken({ forceRefresh });
    forceRefresh = false;

    try {
      metrics.total_requests += 1;
      console.log("HTTP", method || "GET", url);

      const response = await fetchWithTimeout(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.status === 401 && attempt <= maxRetries) {
        metrics.failures_by_type.auth += 1;
        forceRefresh = true;
        continue;
      }

      if (response.status === 429 || response.status === 503) {
        metrics.rate_limit_events.count += 1;
        metrics.rate_limit_events.by_status[response.status] =
          (metrics.rate_limit_events.by_status[response.status] || 0) + 1;
        const retryAfterHeader = response.headers.get("retry-after");
        const retryAfterSeconds = retryAfterHeader
          ? Number(retryAfterHeader)
          : null;
        if (retryAfterSeconds !== null) {
          metrics.rate_limit_events.retry_after_seconds.push(retryAfterSeconds);
        }
        metrics.retry_count += 1;
        const delayMs = buildBackoffDelayMs(attempt, retryAfterSeconds);
        metrics.total_backoff_wait_seconds += delayMs / 1000;
        await sleep(delayMs);
        continue;
      }

      if (response.status >= 500) {
        metrics.failures_by_type.server += 1;
        metrics.retry_count += 1;
        const delayMs = buildBackoffDelayMs(attempt, null);
        metrics.total_backoff_wait_seconds += delayMs / 1000;
        await sleep(delayMs);
        continue;
      }

      if (!response.ok) {
        if (response.status === 403) {
          metrics.failures_by_type.quota += 1;
        } else {
          metrics.failures_by_type.other += 1;
        }
        const errorBody = await response.text();
        throw new Error(`API error ${response.status}: ${errorBody}`);
      }

      return response.json();
    } catch (error) {
      lastError = error;
      if (error.name === "AbortError") {
        metrics.failures_by_type.network += 1;
      } else if (!error.message?.startsWith("API error")) {
        metrics.failures_by_type.network += 1;
      }

      if (attempt > maxRetries) {
        break;
      }
    }
  }

  throw lastError || new Error("API request failed");
}

async function listMediaItems({
  getAccessToken,
  metrics,
  pageToken,
  pageSize,
}) {
  const params = new URLSearchParams({
    pageSize: pageSize.toString(),
  });
  if (pageToken) {
    params.set("pageToken", pageToken);
  }
  const url = `${API_BASE}/mediaItems?${params.toString()}`;
  console.log(
    "listMediaItems: pageSize=",
    pageSize,
    "pageToken=",
    pageToken ? "[present]" : "[none]",
  );

  return apiRequest({ url, getAccessToken, metrics });
}

async function searchMediaItems({
  getAccessToken,
  metrics,
  pageToken,
  pageSize,
  dateFilter,
}) {
  const url = `${API_BASE}/mediaItems:search`;
  const body = {
    pageSize,
    pageToken,
    filters: {
      dateFilter,
    },
  };
  return apiRequest({ url, method: "POST", body, getAccessToken, metrics });
}

async function getMediaItem({ getAccessToken, metrics, mediaItemId }) {
  const url = `${API_BASE}/mediaItems/${mediaItemId}`;
  return apiRequest({ url, getAccessToken, metrics });
}

module.exports = {
  createMetrics,
  listMediaItems,
  searchMediaItems,
  getMediaItem,
};
