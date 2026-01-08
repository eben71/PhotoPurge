const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const { getValidAccessToken, requireEnv } = require("./auth");
const {
  createMetrics,
  listMediaItems,
  searchMediaItems,
} = require("./google-photos");

const RUNS_DIR = path.join(__dirname, "..", "runs");
const SAMPLE_URL_LIMIT = 100;
const DAILY_QUOTA_REQUESTS = 10000;

const TIER_LIMITS = {
  test: 10,
  small: 1000,
  medium: 10000,
  large: 50000,
};

function parseArgs(argv) {
  const options = {
    tier: null,
    maxItems: null,
    tokenId: "default",
    outputPrefix: null,
    saveBaseline: false,
    searchSince: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--tier":
        options.tier = argv[i + 1];
        i += 1;
        break;
      case "--max-items":
        options.maxItems = Number(argv[i + 1]);
        i += 1;
        break;
      case "--token-id":
        options.tokenId = argv[i + 1];
        i += 1;
        break;
      case "--output-prefix":
        options.outputPrefix = argv[i + 1];
        i += 1;
        break;
      case "--save-baseline":
        options.saveBaseline = true;
        break;
      case "--search-since":
        options.searchSince = argv[i + 1];
        i += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function resolveMaxItems(tier, maxItems) {
  if (maxItems) {
    return maxItems;
  }
  if (!tier) {
    throw new Error("Either --tier or --max-items is required");
  }
  const limit = TIER_LIMITS[tier];
  if (!limit) {
    throw new Error(`Unknown tier: ${tier}`);
  }
  return limit;
}

function toDateParts(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function buildDateFilter(searchSince) {
  const start = new Date(`${searchSince}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) {
    throw new Error("Invalid --search-since date (expected YYYY-MM-DD)");
  }
  const end = new Date();
  return {
    ranges: [
      {
        startDate: toDateParts(start),
        endDate: toDateParts(end),
      },
    ],
  };
}

function createRunId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function initMetadataCounters() {
  return {
    id: 0,
    filename: 0,
    mimeType: 0,
    baseUrl: 0,
    creationTime: 0,
    width: 0,
    height: 0,
  };
}

function updateMetadataCounters(counters, item) {
  if (item.id) counters.id += 1;
  if (item.filename) counters.filename += 1;
  if (item.mimeType) counters.mimeType += 1;
  if (item.baseUrl) counters.baseUrl += 1;
  if (item.mediaMetadata?.creationTime) counters.creationTime += 1;
  if (item.mediaMetadata?.width) counters.width += 1;
  if (item.mediaMetadata?.height) counters.height += 1;
}

function buildMetadataCompleteness(counters, totalItems) {
  const safeTotal = totalItems || 1;
  const toPercent = (value) => Math.round((value / safeTotal) * 10000) / 100;
  return Object.fromEntries(
    Object.entries(counters).map(([key, value]) => [
      key,
      {
        count: value,
        percent: toPercent(value),
      },
    ]),
  );
}

async function ensureRunsDir() {
  await fsp.mkdir(RUNS_DIR, { recursive: true });
}

async function run() {
  requireEnv("CLIENT_ID");
  requireEnv("CLIENT_SECRET");
  requireEnv("REDIRECT_URI");

  const options = parseArgs(process.argv.slice(2));
  const maxItems = resolveMaxItems(options.tier, options.maxItems);
  const runId = options.outputPrefix || createRunId();

  await ensureRunsDir();

  const runFile = path.join(RUNS_DIR, `${runId}-run.json`);
  const itemsFile = path.join(RUNS_DIR, `${runId}-items.ndjson`);
  const baselineFile = options.saveBaseline
    ? path.join(RUNS_DIR, `${runId}-baseline-ids.ndjson`)
    : null;

  const metrics = createMetrics();
  const metadataCounters = initMetadataCounters();
  const sampleUrls = [];

  const itemsStream = fs.createWriteStream(itemsFile, { flags: "a" });
  const baselineStream = baselineFile
    ? fs.createWriteStream(baselineFile, { flags: "a" })
    : null;

  const getAccessToken = ({ forceRefresh = false } = {}) =>
    getValidAccessToken({ tokenId: options.tokenId, metrics, forceRefresh });

  const startedAt = new Date();
  let totalItems = 0;
  let nextPageToken;

  const dateFilter = options.searchSince
    ? buildDateFilter(options.searchSince)
    : null;

  while (true) {
    const response = dateFilter
      ? await searchMediaItems({
          getAccessToken,
          metrics,
          pageToken: nextPageToken,
          pageSize: 100,
          dateFilter,
        })
      : await listMediaItems({
          getAccessToken,
          metrics,
          pageToken: nextPageToken,
          pageSize: 100,
        });

    const items = response.mediaItems || [];
    for (const item of items) {
      totalItems += 1;
      updateMetadataCounters(metadataCounters, item);

      if (sampleUrls.length < SAMPLE_URL_LIMIT && item.baseUrl) {
        sampleUrls.push({ id: item.id, baseUrl: item.baseUrl });
      }

      itemsStream.write(
        `${JSON.stringify({
          id: item.id,
          filename: item.filename,
          mimeType: item.mimeType,
          baseUrl: item.baseUrl,
          creationTime: item.mediaMetadata?.creationTime,
          width: item.mediaMetadata?.width,
          height: item.mediaMetadata?.height,
        })}\n`,
      );

      if (baselineStream) {
        baselineStream.write(
          `${JSON.stringify({
            id: item.id,
            creationTime: item.mediaMetadata?.creationTime,
          })}\n`,
        );
      }

      if (totalItems >= maxItems) {
        break;
      }
    }

    nextPageToken = response.nextPageToken;
    if (!nextPageToken || totalItems >= maxItems) {
      break;
    }
  }

  itemsStream.end();
  if (baselineStream) {
    baselineStream.end();
  }

  const completedAt = new Date();
  const durationSeconds = (completedAt - startedAt) / 1000;

  const runReport = {
    run_id: runId,
    mode: dateFilter ? "search" : "list",
    tier: options.tier,
    max_items: maxItems,
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
    wall_clock_time_seconds: durationSeconds,
    total_items_seen: totalItems,
    avg_items_per_request: totalItems
      ? Math.round((totalItems / metrics.total_requests) * 100) / 100
      : 0,
    request_metrics: metrics,
    metadata_completeness: buildMetadataCompleteness(
      metadataCounters,
      totalItems,
    ),
    url_samples: sampleUrls,
    memory_usage_estimate: {
      rss_mb: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
    },
    quota_analysis: {
      daily_quota_requests: DAILY_QUOTA_REQUESTS,
      requests_per_scan: metrics.total_requests,
      scans_per_day_ceiling: metrics.total_requests
        ? Math.floor(DAILY_QUOTA_REQUESTS / metrics.total_requests)
        : 0,
    },
  };

  await fsp.writeFile(runFile, JSON.stringify(runReport, null, 2));

  console.log(
    `Scan complete: items=${totalItems} requests=${metrics.total_requests} duration=${durationSeconds.toFixed(
      2,
    )}s avgItemsPerReq=${runReport.avg_items_per_request}`,
  );
}

run().catch((error) => {
  console.error("Scan failed:", error.message);
  process.exitCode = 1;
});
