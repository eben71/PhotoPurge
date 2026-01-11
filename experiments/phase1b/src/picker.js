const fs = require("fs");
const path = require("path");
const { parseArgs } = require("./args");
const { getValidAccessToken } = require("./auth");
const { sleep } = require("./http");
const { createSession, getSession, listMediaItems } = require("./picker-api");
const {
  createMetadataStats,
  finalizeMetadataStats,
  recordItemMetadata,
} = require("./metadata");
const { probeUrls, sampleWithReservoir } = require("./url-probe");
const {
  buildRunId,
  buildRunPaths,
  createRunRecord,
  writeRunJson,
} = require("./run-artifacts");
const { resolveTierConfig } = require("./tier-config");

const PAGE_SIZE = 100;
const POLL_BASE_DELAY_MS = 1000;
const POLL_MAX_DELAY_MS = 10000;

function nextPollDelayMs(attempt) {
  return Math.min(POLL_MAX_DELAY_MS, POLL_BASE_DELAY_MS * 2 ** (attempt - 1));
}

async function pollForCompletion({ accessToken, sessionId, run, timeoutMs }) {
  const startedAt = Date.now();
  let attempt = 0;

  while (Date.now() - startedAt < timeoutMs) {
    attempt += 1;
    run.polling.poll_requests_count += 1;

    try {
      const session = await getSession({ accessToken, sessionId });
      run.session = {
        ...run.session,
        media_items_set: session.mediaItemsSet,
      };

      if (session.mediaItemsSet) {
        run.polling.time_to_complete_seconds = Number(
          ((Date.now() - startedAt) / 1000).toFixed(2),
        );
        return;
      }
    } catch (error) {
      run.polling.errors.push({
        message: error.message,
        at: new Date().toISOString(),
      });
    }

    const delay = nextPollDelayMs(attempt);
    await sleep(delay);
  }

  run.termination_reason = "poll_timeout";
  throw new Error("Polling timed out before session completed.");
}

async function listAllMediaItems({
  accessToken,
  sessionId,
  itemsStream,
  run,
  metadataStats,
  sampleSize,
}) {
  let pageToken = null;
  const seenTokens = new Set();
  let itemIndex = 0;
  const sampleItems = [];

  do {
    const response = await listMediaItems({
      accessToken,
      sessionId,
      pageSize: PAGE_SIZE,
      pageToken,
    });

    run.listing.requests_for_list += 1;

    const items = response.mediaItems || [];
    run.listing.items_per_page.push(items.length);

    for (const item of items) {
      itemsStream.write(`${JSON.stringify(item)}\n`);
      run.listing.selected_count_total += 1;
      recordItemMetadata(metadataStats, item);
      sampleWithReservoir(sampleItems, {
        id: item.id,
        baseUrl: item.baseUrl,
        mimeType: item.mimeType,
      }, itemIndex, sampleSize);
      itemIndex += 1;
    }

    pageToken = response.nextPageToken || null;
    if (pageToken) {
      if (seenTokens.has(pageToken)) {
        throw new Error("Repeated page token detected; aborting list loop.");
      }
      seenTokens.add(pageToken);
    }
  } while (pageToken);

  return sampleItems;
}

async function runPicker() {
  const args = parseArgs(process.argv.slice(2));
  const tierConfig = resolveTierConfig(args.tier, args.maxItemCount);
  const runId = buildRunId({
    tier: args.tier,
    outputPrefix: args.outputPrefix,
  });
  const paths = buildRunPaths(runId);
  const run = createRunRecord({
    tier: args.tier,
    maxItemCount: tierConfig.maxItemCount,
    sampleSize: args.sampleSize,
    runId,
  });
  run.artifacts = {
    run_json: paths.runJsonPath,
    items_ndjson: paths.itemsPath,
  };

  const metadataStats = createMetadataStats();
  let itemsStream = null;
  let exitCode = 0;

  try {
    const accessToken = await getValidAccessToken({
      tokenId: args.tokenId,
      metrics: run.auth,
    });

    const session = await createSession({
      accessToken,
      maxItemCount: tierConfig.maxItemCount,
    });

    run.session = {
      id: session.id,
      picker_uri: session.pickerUri,
      expire_time: session.expireTime || null,
      media_items_set: session.mediaItemsSet || false,
    };

    console.log(`Session created: ${session.id}`);
    console.log(`Open picker URL: ${session.pickerUri}`);
    console.log("Select media, then return here to continue polling.");

    await pollForCompletion({
      accessToken,
      sessionId: session.id,
      run,
      timeoutMs: tierConfig.pollTimeoutMs,
    });

    itemsStream = fs.createWriteStream(paths.itemsPath, { flags: "w" });
    run.listing.started_at = new Date().toISOString();
    const listStart = Date.now();

    const sampleItems = await listAllMediaItems({
      accessToken,
      sessionId: session.id,
      itemsStream,
      run,
      metadataStats,
      sampleSize: args.sampleSize,
    });
    run.listing.completed_at = new Date().toISOString();
    run.listing.duration_seconds = Number(
      ((Date.now() - listStart) / 1000).toFixed(2),
    );

    run.metadata_completeness = finalizeMetadataStats(metadataStats);

    const validSample = sampleItems.filter((item) => item.baseUrl);
    run.url_probe = {
      sample_items: validSample,
      ...(await probeUrls(validSample)),
    };

    console.log("Run complete.");
    console.log(`Run JSON: ${paths.runJsonPath}`);
    console.log(`Items NDJSON: ${paths.itemsPath}`);
    console.log(
      `Re-check URLs with: node experiments/phase1b/src/url-recheck.js --run-file ${paths.runJsonPath} --token-id ${args.tokenId} --label T+15`,
    );
  } catch (error) {
    exitCode = 1;
    run.error = error.message;
    run.termination_reason = run.termination_reason || "error";
    console.error(error.message);
  } finally {
    if (itemsStream) {
      await new Promise((resolve) => itemsStream.end(resolve));
    }
    run.completed_at = new Date().toISOString();
    await writeRunJson(paths.runJsonPath, run);
  }

  process.exit(exitCode);
}

if (require.main === module) {
  runPicker();
}
