const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { writeReport } = require("../report");

test("writeReport emits core html files", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "phase1b-report-"));
  const itemsById = new Map([
    [
      "a",
      {
        id: "a",
        baseUrl: "https://example.test/a",
        localImage: "images/a.jpg",
        filename: "a.jpg",
        createTime: "2026-01-01T00:00:00Z",
        dimensions: "100x100",
      },
    ],
    [
      "b",
      {
        id: "b",
        baseUrl: "https://example.test/b",
        filename: "b.jpg",
        createTime: "2026-01-02T00:00:00Z",
        dimensions: "100x100",
      },
    ],
  ]);
  const clusters = [
    {
      cluster_id: "cluster1",
      representative_id: "a",
      members: [{ id: "a" }, { id: "b" }],
    },
  ];
  const pairs = [
    {
      id_a: "a",
      id_b: "b",
      similarity_percent: 88,
      hamming_distance: 8,
      hash_bits: 64,
    },
  ];

  await writeReport({
    outputDir: tempDir,
    runId: "sample",
    itemsById,
    clusters,
    pairs,
    threshold: 70,
    topPairsCount: 100,
  });

  const indexHtml = await fs.readFile(path.join(tempDir, "index.html"), "utf8");
  const clusterHtml = await fs.readFile(
    path.join(tempDir, "cluster-cluster1.html"),
    "utf8",
  );
  assert.ok(indexHtml.includes("Phase 1b Report"));
  assert.ok(clusterHtml.includes("Cluster cluster1"));
  assert.ok(clusterHtml.includes("images/a.jpg"));
});
