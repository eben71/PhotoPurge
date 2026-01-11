const { fetchWithTimeout } = require("./http");

function sampleWithReservoir(currentSample, item, index, sampleSize) {
  if (currentSample.length < sampleSize) {
    currentSample.push(item);
    return;
  }
  const randomIndex = Math.floor(Math.random() * (index + 1));
  if (randomIndex < sampleSize) {
    currentSample[randomIndex] = item;
  }
}

function normalizeContentType(value) {
  if (!value) {
    return "unknown";
  }
  return value.split(";")[0].trim().toLowerCase();
}

function buildContentUrl(item) {
  if (!item || !item.baseUrl) {
    return null;
  }
  if (item.mimeType && item.mimeType.startsWith("video/")) {
    return `${item.baseUrl}=dv`;
  }
  return `${item.baseUrl}=d`;
}

async function probeUrls(sampleItems, { accessToken, timeoutMs = 20000 } = {}) {
  const statusHistogram = {};
  const contentTypeHistogram = {};
  const results = [];
  let totalLatency = 0;

  for (const item of sampleItems) {
    const start = Date.now();
    let status = null;
    let ok = false;
    let contentType = "unknown";
    let error = null;

    try {
      const contentUrl = buildContentUrl(item);
      if (!contentUrl) {
        throw new Error("Missing baseUrl for probe.");
      }
      if (!accessToken) {
        throw new Error("Missing access token for probe.");
      }
      const response = await fetchWithTimeout(
        contentUrl,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Range: "bytes=0-1023",
          },
        },
        timeoutMs,
      );
      status = response.status;
      ok = response.ok;
      contentType = normalizeContentType(response.headers.get("content-type"));
      if (!response.ok) {
        const responseText = await response.text();
        error = responseText ? responseText.slice(0, 200) : "Non-OK response";
      }
    } catch (err) {
      error = err.message;
    }

    const latencyMs = Date.now() - start;
    totalLatency += latencyMs;

    const statusKey = status === null ? "error" : String(status);
    statusHistogram[statusKey] = (statusHistogram[statusKey] || 0) + 1;
    contentTypeHistogram[contentType] = (contentTypeHistogram[contentType] || 0) + 1;

    results.push({
      id: item.id,
      status,
      ok,
      content_type: contentType,
      latency_ms: latencyMs,
      error,
    });
  }

  const averageLatencyMs = sampleItems.length
    ? Math.round(totalLatency / sampleItems.length)
    : 0;

  return {
    sample_size: sampleItems.length,
    success_count: results.filter((entry) => entry.ok).length,
    failure_count: results.filter((entry) => !entry.ok).length,
    status_histogram: statusHistogram,
    content_type_histogram: contentTypeHistogram,
    avg_latency_ms: averageLatencyMs,
    sample_results: results,
  };
}

module.exports = {
  probeUrls,
  sampleWithReservoir,
};
