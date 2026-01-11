const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildRunId,
  buildRunPaths,
  createRunRecord,
  formatTimestamp,
} = require("../src/run-artifacts");

test("buildRunId includes tier and prefix", () => {
  const now = new Date("2026-01-06T12:34:56.789Z");
  const runId = buildRunId({ tier: "test", outputPrefix: "picker", now });
  assert.equal(runId, `picker-${formatTimestamp(now)}-test`);
});

test("buildRunPaths uses run id", () => {
  const paths = buildRunPaths("sample-run");
  assert.ok(paths.runJsonPath.endsWith("sample-run-run.json"));
  assert.ok(paths.itemsPath.endsWith("sample-run-items.ndjson"));
});

test("createRunRecord has required sections", () => {
  const record = createRunRecord({
    tier: "test",
    maxItemCount: 10,
    sampleSize: 5,
    runId: "sample",
  });
  assert.equal(record.phase, "phase1b");
  assert.equal(record.tier, "test");
  assert.equal(record.max_item_count, 10);
  assert.equal(record.sample_size, 5);
  assert.ok(record.polling);
  assert.ok(record.listing);
  assert.ok(record.auth);
});
