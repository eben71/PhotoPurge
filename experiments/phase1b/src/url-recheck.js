const fs = require("fs/promises");
const path = require("path");
const { getValidAccessToken } = require("./auth");
const { listMediaItems } = require("./picker-api");
const { fetchWithTimeout } = require("./http");

const PAGE_SIZE = 100;

function parseArgs(argv) {
  const args = {
    runFile: null,
    tokenId: "default",
    label: "recheck",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run-file") {
      args.runFile = argv[index + 1];
      index += 1;
    } else if (arg === "--token-id") {
      args.tokenId = argv[index + 1];
      index += 1;
    } else if (arg === "--label") {
      args.label = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.runFile) {
    throw new Error("--run-file is required");
  }

  return args;
}

async function fetchUrlStatus(url, timeoutMs = 20000) {
  const start = Date.now();
  try {
    const response = await fetchWithTimeout(
      url,
      { method: "GET", headers: { Range: "bytes=0-0" } },
      timeoutMs,
    );
    return {
      ok: response.ok,
      status: response.status,
      content_type: response.headers.get("content-type"),
      latency_ms: Date.now() - start,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      content_type: null,
      latency_ms: Date.now() - start,
      error: error.message,
    };
  }
}

async function listAllItems({ accessToken, sessionId }) {
  let pageToken = null;
  const items = new Map();

  do {
    const response = await listMediaItems({
      accessToken,
      sessionId,
      pageSize: PAGE_SIZE,
      pageToken,
    });

    (response.mediaItems || []).forEach((item) => {
      items.set(item.id, item);
    });

    pageToken = response.nextPageToken || null;
  } while (pageToken);

  return items;
}

async function runRecheck() {
  const args = parseArgs(process.argv.slice(2));
  const runData = JSON.parse(await fs.readFile(args.runFile, "utf8"));
  const sampleItems = (runData.url_probe && runData.url_probe.sample_items) || [];

  if (!runData.session || !runData.session.id) {
    throw new Error("Run file is missing session.id");
  }

  if (sampleItems.length === 0) {
    throw new Error("Run file has no url_probe sample items to recheck");
  }

  const accessToken = await getValidAccessToken({ tokenId: args.tokenId });
  const itemsById = await listAllItems({
    accessToken,
    sessionId: runData.session.id,
  });

  const results = [];
  let refreshedUrlChanged = 0;

  for (const sample of sampleItems) {
    const latest = itemsById.get(sample.id);
    const refreshedUrl = latest ? latest.baseUrl : null;
    if (refreshedUrl && refreshedUrl !== sample.baseUrl) {
      refreshedUrlChanged += 1;
    }

    const originalStatus = await fetchUrlStatus(sample.baseUrl);
    const refreshedStatus = refreshedUrl
      ? await fetchUrlStatus(refreshedUrl)
      : null;

    results.push({
      id: sample.id,
      original_url: sample.baseUrl,
      refreshed_url: refreshedUrl,
      original_status: originalStatus,
      refreshed_status: refreshedStatus,
    });
  }

  const output = {
    label: args.label,
    run_id: runData.run_id,
    checked_at: new Date().toISOString(),
    refreshed_url_changed_count: refreshedUrlChanged,
    sample_count: sampleItems.length,
    results,
  };

  const outputPath = path.join(
    path.dirname(args.runFile),
    `${runData.run_id}-${args.label}-url-recheck.json`,
  );
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(`URL recheck saved to ${outputPath}`);
}

if (require.main === module) {
  runRecheck().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
};
