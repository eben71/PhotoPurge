function createMetadataStats() {
  return {
    total_items: 0,
    field_counts: {
      id: 0,
      filename: 0,
      creationTime: 0,
      mimeType: 0,
      width: 0,
      height: 0,
      baseUrl: 0,
    },
    checksum_fields_present: new Set(),
    missing_samples: [],
  };
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function detectChecksumFields(item) {
  const fields = [];
  const queue = [{ path: "", value: item }];
  while (queue.length > 0) {
    const { path, value } = queue.pop();
    if (!value || typeof value !== "object") {
      continue;
    }
    for (const [key, child] of Object.entries(value)) {
      const nextPath = path ? `${path}.${key}` : key;
      if (/checksum|md5|sha/i.test(key)) {
        fields.push(nextPath);
      }
      if (child && typeof child === "object") {
        queue.push({ path: nextPath, value: child });
      }
    }
  }
  return fields;
}

function recordItemMetadata(stats, item) {
  stats.total_items += 1;
  const missing = [];

  if (hasValue(item.id)) {
    stats.field_counts.id += 1;
  } else {
    missing.push("id");
  }

  if (hasValue(item.filename)) {
    stats.field_counts.filename += 1;
  } else {
    missing.push("filename");
  }

  if (hasValue(item.mimeType)) {
    stats.field_counts.mimeType += 1;
  } else {
    missing.push("mimeType");
  }

  const metadata = item.mediaMetadata || {};
  if (hasValue(metadata.creationTime)) {
    stats.field_counts.creationTime += 1;
  } else {
    missing.push("creationTime");
  }

  if (hasValue(metadata.width)) {
    stats.field_counts.width += 1;
  } else {
    missing.push("width");
  }

  if (hasValue(metadata.height)) {
    stats.field_counts.height += 1;
  } else {
    missing.push("height");
  }

  if (hasValue(item.baseUrl)) {
    stats.field_counts.baseUrl += 1;
  } else {
    missing.push("baseUrl");
  }

  if (missing.length > 0 && stats.missing_samples.length < 10) {
    stats.missing_samples.push({
      id: item.id || null,
      missing,
    });
  }

  const checksumFields = detectChecksumFields(item);
  checksumFields.forEach((field) => stats.checksum_fields_present.add(field));
}

function finalizeMetadataStats(stats) {
  const percentages = {};
  const total = stats.total_items;
  Object.entries(stats.field_counts).forEach(([field, count]) => {
    const ratio = total === 0 ? 0 : count / total;
    percentages[field] = Number((ratio * 100).toFixed(2));
  });

  return {
    total_items: stats.total_items,
    field_counts: stats.field_counts,
    field_percentages: percentages,
    missing_samples: stats.missing_samples,
    checksum_fields_present: Array.from(stats.checksum_fields_present).sort(),
    checksum_present: stats.checksum_fields_present.size > 0,
  };
}

module.exports = {
  createMetadataStats,
  finalizeMetadataStats,
  recordItemMetadata,
};
