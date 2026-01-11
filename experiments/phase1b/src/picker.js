const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const { once } = require("events");
const { finished } = require("stream/promises");
const { parseArgs } = require("./args");
const { getRequestedScopes, getValidAccessToken } = require("./auth");
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
const NDJSON_SELF_CHECK_LINES = 3;

function nextPollDelayMs(attempt) {
  return Math.min(POLL_MAX_DELAY_MS, POLL_BASE_DELAY_MS * 2 ** (attempt - 1));
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function getFirstValue(item, paths) {
  for (const pathParts of paths) {
    let current = item;
    for (const key of pathParts) {
      if (!current || current[key] === undefined) {
        current = undefined;
        break;
      }
      current = current[key];
    }
    if (hasValue(current)) {
      return current;
    }
  }
  return undefined;
}

async function writeNdjsonLine(stream, line) {
  if (!stream.write(line)) {
    await once(stream, "drain");
  }
}

async function validateNdjsonSample(filePath, maxLines) {
  const data = await fsPromises.readFile(filePath, "utf8");
  const lines = data.split(/\r?\n/).filter((line) => line.length > 0);
  const sample = lines.slice(0, maxLines);
  for (const line of sample) {
    try {
      JSON.parse(line);
    } catch (error) {
      throw new Error(
        "Invalid NDJSON output (first lines not parseable). Aborting.",
      );
    }
  }
}

function logPickedItemShape(item, run) {
  if (run.picked_item_shape) {
    return;
  }
  const topLevelKeys = Object.keys(item || {});
  const mediaFileKeys = item && item.mediaFile ? Object.keys(item.mediaFile) : null;
  run.picked_item_shape = {
    top_level_keys: topLevelKeys,
    mediaFile_keys: mediaFileKeys,
  };

  const id = getFirstValue(item, [["id"], ["mediaFile", "id"]]);
  const baseUrl = getFirstValue(item, [["mediaFile", "baseUrl"], ["baseUrl"]]);
  const mimeType = getFirstValue(item, [["mediaFile", "mimeType"], ["mimeType"]]);
  const filename = getFirstValue(item, [["mediaFile", "filename"], ["filename"]]);
  const creationTime = getFirstValue(item, [
    ["mediaFile", "creationTime"],
    ["mediaFile", "createTime"],
    ["mediaMetadata", "creationTime"],
  ]);
  const width = getFirstValue(item, [["mediaFile", "width"], ["mediaMetadata", "width"]]);
  const height = getFirstValue(item, [["mediaFile", "height"], ["mediaMetadata", "height"]]);

  console.log(
    `[diag] picked_item_top_level_keys=${JSON.stringify(topLevelKeys)}`,
  );
  if (mediaFileKeys) {
    console.log(
      `[diag] picked_item_mediaFile_keys=${JSON.stringify(mediaFileKeys)}`,
    );
  } else {
    console.log("[diag] picked_item_mediaFile_keys=null");
  }
  console.log(
    `[diag] picked_item_fields hasId=${hasValue(id)} hasMediaFile=${Boolean(
      item && item.mediaFile,
    )} hasBaseUrl=${hasValue(baseUrl)} hasMimeType=${hasValue(
      mimeType,
    )} hasFilename=${hasValue(filename)} hasCreationTime=${hasValue(
      creationTime,
    )} hasWidth=${hasValue(width)} hasHeight=${hasValue(height)}`,
  );
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
  itemsPath,
  run,
  metadataStats,
  sampleSize,
}) {
  let pageToken = null;
  const seenTokens = new Set();
  let itemIndex = 0;
  const sampleItems = [];
  let ndjsonValidated = false;

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
    if (!ndjsonValidated && items.length > 0) {
      logPickedItemShape(items[0], run);
    }

    for (const item of items) {
      await writeNdjsonLine(itemsStream, `${JSON.stringify(item)}\n`);
      run.listing.selected_count_total += 1;
      recordItemMetadata(metadataStats, item);
      const itemId = getFirstValue(item, [["id"], ["mediaFile", "id"]]);
      sampleWithReservoir(sampleItems, {
        id: itemId,
        baseUrl: getFirstValue(item, [["mediaFile", "baseUrl"], ["baseUrl"]]),
        mimeType: getFirstValue(item, [["mediaFile", "mimeType"], ["mimeType"]]),
      }, itemIndex, sampleSize);
      itemIndex += 1;
    }

    console.log(
      `[diag] wrote ${items.length} items this page (total ${run.listing.selected_count_total})`,
    );

    if (!ndjsonValidated && run.listing.selected_count_total > 0) {
      try {
        await validateNdjsonSample(itemsPath, NDJSON_SELF_CHECK_LINES);
        ndjsonValidated = true;
      } catch (error) {
        run.termination_reason = "ndjson_invalid";
        throw error;
      }
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
    console.log(`[diag] requested_scopes=${getRequestedScopes()}`);
    const accessToken = await getValidAccessToken({
      tokenId: args.tokenId,
      metrics: run.auth,
    });

    console.log("[phase1b] create session");
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
    console.log("[phase1b] open picker url");
    console.log(`Open picker URL: ${session.pickerUri}`);
    console.log("Select media, then return here to continue polling.");

    console.log("[phase1b] poll session");
    await pollForCompletion({
      accessToken,
      sessionId: session.id,
      run,
      timeoutMs: tierConfig.pollTimeoutMs,
    });

    console.log("[phase1b] list selected media items");
    itemsStream = fs.createWriteStream(paths.itemsPath, { flags: "w" });
    run.listing.started_at = new Date().toISOString();
    const listStart = Date.now();

    const sampleItems = await listAllMediaItems({
      accessToken,
      sessionId: session.id,
      itemsStream,
      itemsPath: paths.itemsPath,
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
      itemsStream.end();
      await finished(itemsStream);
      const stat = await fsPromises.stat(paths.itemsPath);
      console.log(
        `[diag] items file path=${paths.itemsPath} size_bytes=${stat.size}`,
      );
    }
    run.completed_at = new Date().toISOString();
    await writeRunJson(paths.runJsonPath, run);
  }

  process.exit(exitCode);
}

if (require.main === module) {
  runPicker();
}
