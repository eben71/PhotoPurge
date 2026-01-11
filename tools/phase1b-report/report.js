const fs = require("fs/promises");
const path = require("path");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildImageTag(item, sizeParam) {
  if (!item || (!item.baseUrl && !item.localImage)) {
    return `<div class="missing">missing image</div>`;
  }
  const src = item.localImage ? item.localImage : `${item.baseUrl}${sizeParam}`;
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(item.id)}" loading="lazy" />`;
}

function layoutPage(title, body) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 24px; color: #111; }
      a { color: #0a58ca; text-decoration: none; }
      table { border-collapse: collapse; width: 100%; margin-top: 16px; }
      th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
      img { max-width: 100%; border-radius: 6px; border: 1px solid #ddd; }
      .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
      .meta { font-size: 12px; color: #444; }
      .pill { display: inline-block; padding: 2px 6px; border-radius: 999px; background: #eef; font-size: 12px; margin-right: 4px; }
      .missing { color: #999; font-style: italic; padding: 12px; border: 1px dashed #ccc; }
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>`;
}

function buildIndexPage({ runId, counts }) {
  const body = `
    <h1>Phase 1b Report — ${escapeHtml(runId)}</h1>
    <p>Items: ${counts.items} · Pairs: ${counts.pairs} · Threshold: ${counts.threshold}% · Clusters: ${counts.clusters}</p>
    <ul>
      <li><a href="clusters.html">Cluster list</a></li>
      <li><a href="top-pairs.html">Top pairs</a></li>
    </ul>
  `;
  return layoutPage(`Phase 1b Report ${runId}`, body);
}

function buildClusterListPage({ clusters, itemsById, clusterStats }) {
  const rows = clusters
    .map((cluster) => {
      const representative = itemsById.get(cluster.representative_id);
      const stats = clusterStats.get(cluster.cluster_id) || {};
      const thumb = buildImageTag(representative, "=w200-h200");
      return `
        <tr>
          <td><a href="cluster-${cluster.cluster_id}.html">${cluster.cluster_id}</a></td>
          <td>${cluster.members.length}</td>
          <td>${thumb}</td>
          <td>${stats.maxSimilarity ?? "-"}</td>
        </tr>
      `;
    })
    .join("\n");

  const body = `
    <h1>Clusters</h1>
    <a href="index.html">← Back to summary</a>
    <table>
      <thead>
        <tr><th>Cluster</th><th>Size</th><th>Representative</th><th>Max similarity</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  return layoutPage("Cluster list", body);
}

function buildClusterDetailPage({ cluster, itemsById, topPairs }) {
  const grid = cluster.members
    .map((member) => {
      const item = itemsById.get(member.id);
      const thumb = buildImageTag(item, "=w200-h200");
      return `<div>${thumb}<div class="meta">${escapeHtml(member.id)}</div></div>`;
    })
    .join("\n");

  const pairRows = topPairs
    .map(
      (pair) => `
        <tr>
          <td><a href="compare-${pair.index}.html">${pair.id_a} vs ${pair.id_b}</a></td>
          <td>${pair.similarity_percent}%</td>
          <td>${pair.hamming_distance}</td>
        </tr>
      `,
    )
    .join("\n");

  const body = `
    <h1>Cluster ${cluster.cluster_id}</h1>
    <a href="clusters.html">← Back to clusters</a>
    <div class="grid">${grid}</div>
    <h2>Top pairs</h2>
    <table>
      <thead><tr><th>Pair</th><th>Similarity</th><th>Hamming</th></tr></thead>
      <tbody>${pairRows}</tbody>
    </table>
  `;
  return layoutPage(`Cluster ${cluster.cluster_id}`, body);
}

function buildTopPairsPage({ pairs }) {
  const rows = pairs
    .map(
      (pair) => `
        <tr>
          <td><a href="compare-${pair.index}.html">${pair.id_a} vs ${pair.id_b}</a></td>
          <td>${pair.similarity_percent}%</td>
          <td>${pair.hamming_distance}</td>
        </tr>
      `,
    )
    .join("\n");

  const body = `
    <h1>Top pairs</h1>
    <a href="index.html">← Back to summary</a>
    <table>
      <thead><tr><th>Pair</th><th>Similarity</th><th>Hamming</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  return layoutPage("Top pairs", body);
}

function buildComparePage({ pair, itemA, itemB, totalPairs }) {
  const left = buildImageTag(itemA, "=w600-h600");
  const right = buildImageTag(itemB, "=w600-h600");
  const prevIndex = pair.index > 0 ? pair.index - 1 : null;
  const nextIndex = pair.index < totalPairs - 1 ? pair.index + 1 : null;

  const meta = (item) =>
    item
      ? `
        <div class="meta">
          <div><span class="pill">ID</span>${escapeHtml(item.id)}</div>
          <div><span class="pill">Filename</span>${escapeHtml(item.filename || "-")}</div>
          <div><span class="pill">CreateTime</span>${escapeHtml(item.createTime || "-")}</div>
          <div><span class="pill">Dimensions</span>${escapeHtml(item.dimensions || "-")}</div>
        </div>
      `
      : `<div class="meta">No metadata available.</div>`;

  const body = `
    <h1>Compare pair</h1>
    <p>
      Similarity: <strong>${pair.similarity_percent}%</strong> · Hamming: ${pair.hamming_distance}
      · Hash bits: ${pair.hash_bits}
    </p>
    <div>
      ${prevIndex !== null ? `<a href="compare-${prevIndex}.html">← Prev</a>` : ""}
      ${nextIndex !== null ? `<a href="compare-${nextIndex}.html">Next →</a>` : ""}
    </div>
    <div class="pair">
      <div>${left}${meta(itemA)}</div>
      <div>${right}${meta(itemB)}</div>
    </div>
    <p><a href="top-pairs.html">Back to top pairs</a></p>
  `;
  return layoutPage(`Compare ${pair.id_a} vs ${pair.id_b}`, body);
}

async function writeReport({
  outputDir,
  runId,
  itemsById,
  clusters,
  pairs,
  threshold,
  topPairsCount,
}) {
  await fs.mkdir(outputDir, { recursive: true });

  const pairsSorted = [...pairs].sort(
    (a, b) => b.similarity_percent - a.similarity_percent,
  );
  const pairsWithIndex = pairsSorted.map((pair, index) => ({
    ...pair,
    index,
  }));
  const topPairs = pairsWithIndex.slice(0, topPairsCount);

  const clusterStats = new Map();
  clusters.forEach((cluster) => {
    const memberSet = new Set(cluster.members.map((m) => m.id));
    let maxSimilarity = null;
    pairsSorted.forEach((pair) => {
      if (memberSet.has(pair.id_a) && memberSet.has(pair.id_b)) {
        maxSimilarity =
          maxSimilarity === null
            ? pair.similarity_percent
            : Math.max(maxSimilarity, pair.similarity_percent);
      }
    });
    clusterStats.set(cluster.cluster_id, { maxSimilarity });
  });

  await fs.writeFile(
    path.join(outputDir, "index.html"),
    buildIndexPage({
      runId,
      counts: {
        items: itemsById.size,
        pairs: pairs.length,
        threshold,
        clusters: clusters.length,
      },
    }),
  );

  await fs.writeFile(
    path.join(outputDir, "clusters.html"),
    buildClusterListPage({ clusters, itemsById, clusterStats }),
  );

  for (const cluster of clusters) {
    const memberSet = new Set(cluster.members.map((m) => m.id));
    const clusterPairs = pairsWithIndex
      .filter((pair) => memberSet.has(pair.id_a) && memberSet.has(pair.id_b))
      .slice(0, 10);
    await fs.writeFile(
      path.join(outputDir, `cluster-${cluster.cluster_id}.html`),
      buildClusterDetailPage({
        cluster,
        itemsById,
        topPairs: clusterPairs,
      }),
    );
  }

  await fs.writeFile(
    path.join(outputDir, "top-pairs.html"),
    buildTopPairsPage({ pairs: topPairs }),
  );

  for (const pair of pairsWithIndex) {
    const itemA = itemsById.get(pair.id_a);
    const itemB = itemsById.get(pair.id_b);
    await fs.writeFile(
      path.join(outputDir, `compare-${pair.index}.html`),
      buildComparePage({
        pair: {
          ...pair,
          hash_bits: pair.hash_bits,
        },
        itemA,
        itemB,
        totalPairs: pairsWithIndex.length,
      }),
    );
  }
}

module.exports = {
  writeReport,
};
