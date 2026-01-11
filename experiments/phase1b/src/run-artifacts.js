const fs = require("fs/promises");
const path = require("path");

function formatTimestamp(date) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function buildRunId({ tier, outputPrefix, now = new Date() }) {
  const timestamp = formatTimestamp(now);
  const base = `${timestamp}-${tier}`;
  return outputPrefix ? `${outputPrefix}-${base}` : base;
}

function buildRunPaths(runId) {
  const runsDir = path.join(__dirname, "..", "runs");
  return {
    runsDir,
    runJsonPath: path.join(runsDir, `${runId}-run.json`),
    itemsPath: path.join(runsDir, `${runId}-items.ndjson`),
    urlRecheckPath: path.join(runsDir, `${runId}-url-recheck.json`),
  };
}

function createRunRecord({ tier, maxItemCount, sampleSize, runId }) {
  return {
    phase: "phase1b",
    tier,
    max_item_count: maxItemCount,
    sample_size: sampleSize,
    run_id: runId,
    started_at: new Date().toISOString(),
    completed_at: null,
    artifacts: {},
    auth: {
      token_refresh_events: 0,
    },
    session: null,
    polling: {
      poll_requests_count: 0,
      time_to_complete_seconds: null,
      errors: [],
    },
    listing: {
      selected_count_total: 0,
      requests_for_list: 0,
      items_per_page: [],
      started_at: null,
      completed_at: null,
      duration_seconds: null,
    },
    metadata_completeness: null,
    url_probe: null,
    user_friction_notes: "",
    error: null,
    termination_reason: null,
  };
}

async function writeRunJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
  buildRunId,
  buildRunPaths,
  createRunRecord,
  formatTimestamp,
  writeRunJson,
};
