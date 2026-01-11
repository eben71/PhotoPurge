const test = require("node:test");
const assert = require("node:assert/strict");
const { parseArgs } = require("../src/args");
const { resolveTierConfig } = require("../src/tier-config");

test("parseArgs uses defaults", () => {
  const args = parseArgs([]);
  assert.equal(args.tier, "test");
  assert.equal(args.tokenId, "default");
  assert.equal(args.outputPrefix, null);
  assert.equal(args.maxItemCount, null);
  assert.equal(args.sampleSize, 25);
});

test("parseArgs reads overrides", () => {
  const args = parseArgs([
    "--tier",
    "large",
    "--token-id",
    "custom",
    "--output-prefix",
    "run",
    "--max-item-count",
    "500",
    "--sample-size",
    "12",
  ]);
  assert.equal(args.tier, "large");
  assert.equal(args.tokenId, "custom");
  assert.equal(args.outputPrefix, "run");
  assert.equal(args.maxItemCount, 500);
  assert.equal(args.sampleSize, 12);
});

test("resolveTierConfig respects overrides", () => {
  const config = resolveTierConfig("small", 300);
  assert.equal(config.maxItemCount, 300);
});
