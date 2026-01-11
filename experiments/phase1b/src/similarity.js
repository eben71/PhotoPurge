const fs = require("fs");
const { once } = require("events");
const { finished } = require("stream/promises");
const { fetchWithTimeout } = require("./http");

const DEFAULT_TIMEOUT_MS = 30000;
const TARGET_SIZE = { width: 9, height: 8 };
const DOWNLOAD_SIZE_PARAM = "=w256-h256";
const RANGE_HEADER = "bytes=0-65535";

function buildContentUrl(item) {
  if (!item.baseUrl) {
    return null;
  }
  return `${item.baseUrl}${DOWNLOAD_SIZE_PARAM}`;
}

let jpeg = null;
let png = null;

function getJpegDecoder() {
  if (!jpeg) {
    try {
      jpeg = require("jpeg-js");
    } catch (error) {
      throw new Error("Missing dependency: jpeg-js (run pnpm install).");
    }
  }
  return jpeg;
}

function getPngDecoder() {
  if (!png) {
    try {
      png = require("pngjs");
    } catch (error) {
      throw new Error("Missing dependency: pngjs (run pnpm install).");
    }
  }
  return png;
}

function decodeImage(buffer, mimeType) {
  if (mimeType && mimeType.includes("png")) {
    const decoder = getPngDecoder();
    const decoded = decoder.PNG.sync.read(buffer);
    return {
      data: decoded.data,
      width: decoded.width,
      height: decoded.height,
    };
  }
  const decoder = getJpegDecoder();
  const decoded = decoder.decode(buffer, { useTArray: true });
  return { data: decoded.data, width: decoded.width, height: decoded.height };
}

function resizeToGrayscale(data, width, height, targetWidth, targetHeight) {
  const pixels = new Array(targetWidth * targetHeight);
  for (let y = 0; y < targetHeight; y += 1) {
    const srcY = Math.min(height - 1, Math.floor((y * height) / targetHeight));
    for (let x = 0; x < targetWidth; x += 1) {
      const srcX = Math.min(width - 1, Math.floor((x * width) / targetWidth));
      const idx = (srcY * width + srcX) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      pixels[y * targetWidth + x] = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
    }
  }
  return pixels;
}

function computeDhash(data, width, height) {
  const gray = resizeToGrayscale(
    data,
    width,
    height,
    TARGET_SIZE.width,
    TARGET_SIZE.height,
  );
  let hash = 0n;
  for (let y = 0; y < TARGET_SIZE.height; y += 1) {
    for (let x = 0; x < TARGET_SIZE.width - 1; x += 1) {
      const left = gray[y * TARGET_SIZE.width + x];
      const right = gray[y * TARGET_SIZE.width + x + 1];
      const bit = left > right ? 1n : 0n;
      hash = (hash << 1n) | bit;
    }
  }
  const hex = hash.toString(16).padStart(16, "0");
  return { hash, hex, bits: 64 };
}

function hammingDistance(a, b) {
  let x = a ^ b;
  let count = 0;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

async function writeNdjsonLine(stream, line) {
  await new Promise((resolve, reject) => {
    stream.write(line, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  if (!stream.writableEnded && stream.writableLength > 0) {
    await once(stream, "drain");
  }
}

async function runSimilarityProbe({
  items,
  accessToken,
  outputPath,
  nearMatchThreshold = 70,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  writeAllPairsLimit = 50,
}) {
  const results = [];
  const failures = [];
  let downloadMs = 0;
  let hashMs = 0;
  let compareMs = 0;

  for (const item of items) {
    if (!item.mimeType || !item.mimeType.startsWith("image/")) {
      failures.push({
        id: item.id,
        error: "unsupported_mime_type",
      });
      continue;
    }
    const url = buildContentUrl(item);
    if (!url) {
      failures.push({ id: item.id, error: "missing_base_url" });
      continue;
    }

    try {
      const downloadStart = Date.now();
      const response = await fetchWithTimeout(
        url,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Range: RANGE_HEADER,
          },
        },
        timeoutMs,
      );
      downloadMs += Date.now() - downloadStart;

      if (!response.ok) {
        failures.push({
          id: item.id,
          error: `download_failed_${response.status}`,
        });
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const hashStart = Date.now();
      const { data, width, height } = decodeImage(buffer, item.mimeType);
      const { hash, hex, bits } = computeDhash(data, width, height);
      hashMs += Date.now() - hashStart;

      results.push({
        id: item.id,
        hash,
        hash_hex: hex,
        hash_bits: bits,
        width: TARGET_SIZE.width,
        height: TARGET_SIZE.height,
      });
    } catch (error) {
      failures.push({ id: item.id, error: error.message });
    }
  }

  const pairs = [];
  const compareStart = Date.now();
  for (let i = 0; i < results.length; i += 1) {
    for (let j = i + 1; j < results.length; j += 1) {
      const distance = hammingDistance(results[i].hash, results[j].hash);
      const similarity = Math.round(100 * (1 - distance / results[i].hash_bits));
      pairs.push({
        id_a: results[i].id,
        id_b: results[j].id,
        hamming_distance: distance,
        similarity_percent: similarity,
      });
    }
  }
  compareMs += Date.now() - compareStart;

  let stream = null;
  if (outputPath) {
    stream = fs.createWriteStream(outputPath, { flags: "w" });
    const pairsToWrite =
      results.length <= writeAllPairsLimit
        ? pairs
        : [...pairs]
            .sort((a, b) => b.similarity_percent - a.similarity_percent)
            .slice(0, 10);
    for (const pair of pairsToWrite) {
      await writeNdjsonLine(stream, `${JSON.stringify(pair)}\n`);
    }
    stream.end();
    await finished(stream);
  }

  const topPairs = [...pairs]
    .sort((a, b) => b.similarity_percent - a.similarity_percent)
    .slice(0, 10);

  return {
    algorithm: "dHash",
    hash_bits: 64,
    image_size: "256x256",
    items_hashed: results.length,
    near_match_threshold: nearMatchThreshold,
    pairs_evaluated: pairs.length,
    top_pairs: topPairs,
    failures,
    timing: {
      download_ms: downloadMs,
      hash_ms: hashMs,
      compare_ms: compareMs,
    },
    skipped: false,
  };
}

module.exports = {
  runSimilarityProbe,
};
