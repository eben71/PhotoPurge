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
const TEST_PAGE_LIMIT = 5;
const DIAG_PREFIX = "[diag]";

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
    emptyPageLimit: null,
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
      case "--empty-page-limit":
        options.emptyPageLimit = Number(argv[i + 1]);
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

function resolveEmptyPageLimit(tier, emptyPageLimit) {
  if (Number.isFinite(emptyPageLimit)) {
    if (emptyPageLimit <= 0) {
      throw new Error("--empty-page-limit must be a positive integer");
    }
    return Math.floor(emptyPageLimit);
  }
  if (tier === "test") {
    return 5;
  }
  return 20;
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
  const emptyPageLimit = resolveEmptyPageLimit(
    options.tier,
    options.emptyPageLimit,
  );
  const runId = options.outputPrefix || createRunId();

  await ensureRunsDir();

  console.log(`${DIAG_PREFIX} emptyPageLimit=${emptyPageLimit}`);

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
  let totalItemsReceived = 0;
  let totalItemsWritten = 0;
  let totalPagesFetched = 0;
  let consecutiveEmptyPages = 0;
  let totalEmptyPages = 0;
  let nextPageToken;
  let loggedFirstItem = false;
  let lastItemsFileSize = 0;
  let runError;
  let terminationReason = "completed";
  let terminationDetails = {};

  const dateFilter = options.searchSince
    ? buildDateFilter(options.searchSince)
    : null;
  const responseLabel = dateFilter ? "mediaItems.search" : "mediaItems.list";

  try {
    while (true) {
      if (options.tier === "test" && totalPagesFetched >= TEST_PAGE_LIMIT) {
        console.log(
          `${DIAG_PREFIX} test tier page limit ${TEST_PAGE_LIMIT} reached; stopping early`,
        );
        terminationReason = "test_page_limit";
        terminationDetails = {
          page_limit: TEST_PAGE_LIMIT,
        };
        break;
      }

      const currentPageToken = nextPageToken;
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
      totalPagesFetched += 1;

      const responseKeys =
        response && typeof response === "object" ? Object.keys(response) : [];
      const responseItems = Array.isArray(response?.mediaItems)
        ? response.mediaItems
        : null;
      const responseItemsLength =
        responseItems === null ? "missing" : responseItems.length;
      console.log(
        `${DIAG_PREFIX} ${responseLabel} keys=${responseKeys.join(
          ",",
        )} mediaItems=${responseItemsLength} nextPageToken=${
          response?.nextPageToken ? "[present]" : "[none]"
        }`,
      );

      if (!loggedFirstItem && responseItems?.length) {
        const firstItem = responseItems[0];
        console.log(
          `${DIAG_PREFIX} firstItem keys=${Object.keys(
            firstItem,
          ).join(",")} id=${firstItem.id || "[missing]"} baseUrl=${
            firstItem.baseUrl || "[missing]"
          }`,
        );
        loggedFirstItem = true;
      }

      const items = responseItems || [];
      const itemsCount = responseItems ? responseItems.length : 0;
      if (itemsCount === 0) {
        consecutiveEmptyPages += 1;
        totalEmptyPages += 1;
      } else {
        consecutiveEmptyPages = 0;
      }
      totalItemsReceived += items.length;
      let itemsWrittenThisPage = 0;
      const filteredCounts = {
        maxItemsReached: 0,
      };

      if (consecutiveEmptyPages >= emptyPageLimit) {
        terminationReason = "empty_pages_threshold";
        terminationDetails = {
          empty_page_limit: emptyPageLimit,
          consecutive_empty_pages: consecutiveEmptyPages,
          total_requests_so_far: metrics.total_requests,
          pages_fetched_so_far: totalPagesFetched,
        };
        console.warn(
          `[warn] Aborting scan: empty mediaItems for ${consecutiveEmptyPages} consecutive pages (limit=${emptyPageLimit}).`,
        );
        break;
      }

      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (totalItemsWritten >= maxItems) {
          filteredCounts.maxItemsReached += items.length - i;
          break;
        }

        totalItemsWritten += 1;
        itemsWrittenThisPage += 1;
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
      }

      if (items.length > 0 && itemsWrittenThisPage === 0) {
        console.log(
          `${DIAG_PREFIX} wrote 0 items this page; filtered reasons=${JSON.stringify(
            filteredCounts,
          )}`,
        );
      }
      try {
        lastItemsFileSize = fs.statSync(itemsFile).size;
      } catch (error) {
        lastItemsFileSize = 0;
      }
      console.log(
        `${DIAG_PREFIX} wrote ${itemsWrittenThisPage} items this page (total ${totalItemsWritten}) fileSize=${lastItemsFileSize} bytes`,
      );

      if (
        response?.nextPageToken &&
        response.nextPageToken === currentPageToken
      ) {
        const tokenPrefix = (currentPageToken || "").slice(0, 12);
        terminationReason = "repeated_page_token";
        terminationDetails = {
          repeated_page_token_detected: true,
          repeated_page_token_prefix: tokenPrefix,
          pages_fetched_so_far: totalPagesFetched,
          total_requests_so_far: metrics.total_requests,
        };
        console.warn(
          `[warn] Aborting scan: repeated nextPageToken detected (prefix=${tokenPrefix ||
            "none"}).`,
        );
        break;
      }

      nextPageToken = response.nextPageToken;
      if (totalItemsWritten >= maxItems) {
        terminationReason = "max_items_reached";
        terminationDetails = {
          max_items: maxItems,
          total_items_written: totalItemsWritten,
        };
        break;
      }
      if (!nextPageToken) {
        terminationReason = "no_next_page_token";
        terminationDetails = {
          pages_fetched: totalPagesFetched,
        };
        break;
      }
    }
  } catch (error) {
    runError = error;
    throw error;
  } finally {
    itemsStream.end();
    if (baselineStream) {
      baselineStream.end();
    }

    const durationSeconds = (new Date() - startedAt) / 1000;
    if (!lastItemsFileSize) {
      try {
        lastItemsFileSize = fs.statSync(itemsFile).size;
      } catch (error) {
        lastItemsFileSize = 0;
      }
    }

    console.log(
      `${DIAG_PREFIX} summary pages=${totalPagesFetched} received=${totalItemsReceived} written=${totalItemsWritten} output=${itemsFile} size=${lastItemsFileSize} bytes duration=${durationSeconds.toFixed(
        2,
      )}s`,
    );
    if (totalItemsReceived === 0) {
      console.warn(
        `${DIAG_PREFIX} **WARNING** No mediaItems received across all pages. This likely means there are no app-created items available under the appcreateddata scope.`,
      );
    }

    if (runError) {
      console.warn(
        `${DIAG_PREFIX} run ended with error: ${runError.message}`,
      );
    }
  }

  const completedAt = new Date();
  const durationSeconds = (completedAt - startedAt) / 1000;
  const runReport = {
    run_id: runId,
    mode: dateFilter ? "search" : "list",
    tier: options.tier,
    max_items: maxItems,
    empty_page_limit: emptyPageLimit,
    started_at: startedAt.toISOString(),
    completed_at: completedAt.toISOString(),
    wall_clock_time_seconds: durationSeconds,
    total_items_seen: totalItemsReceived,
    total_mediaItems_received: totalItemsReceived,
    pages_fetched: totalPagesFetched,
    total_empty_pages: totalEmptyPages,
    termination_reason: terminationReason,
    termination_details: terminationDetails,
    avg_items_per_request: totalItemsReceived
      ? Math.round((totalItemsReceived / metrics.total_requests) * 100) / 100
      : 0,
    request_metrics: metrics,
    metadata_completeness: buildMetadataCompleteness(
      metadataCounters,
      totalItemsWritten,
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
    `Scan complete: items=${totalItemsWritten} requests=${metrics.total_requests} duration=${durationSeconds.toFixed(
      2,
    )}s avgItemsPerReq=${runReport.avg_items_per_request}`,
  );
}

run().catch((error) => {
  console.error("Scan failed:", error.message);
  process.exitCode = 1;
});
