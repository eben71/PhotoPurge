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

async function probeUrls(sampleItems, timeoutMs = 20000) {
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
      const response = await fetchWithTimeout(
        item.baseUrl,
        {
          method: "GET",
          headers: {
            Range: "bytes=0-0",
          },
        },
        timeoutMs,
      );
      status = response.status;
      ok = response.ok;
      contentType = normalizeContentType(response.headers.get("content-type"));
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
