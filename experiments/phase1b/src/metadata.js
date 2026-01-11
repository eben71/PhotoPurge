function createMetadataStats() {
  return {
    total_items: 0,
    field_counts: {
      id: 0,
      filename: 0,
      createTime: 0,
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

function getNestedValue(item, path) {
  return path.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), item);
}

function getFirstValue(item, paths) {
  for (const path of paths) {
    const value = getNestedValue(item, path);
    if (hasValue(value)) {
      return value;
    }
  }
  return undefined;
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

  const id = getFirstValue(item, [["id"], ["mediaFile", "id"]]);
  if (hasValue(id)) {
    stats.field_counts.id += 1;
  } else {
    missing.push("id");
  }

  const filename = getFirstValue(item, [["mediaFile", "filename"], ["filename"]]);
  if (hasValue(filename)) {
    stats.field_counts.filename += 1;
  } else {
    missing.push("filename");
  }

  const mimeType = getFirstValue(item, [["mediaFile", "mimeType"], ["mimeType"]]);
  if (hasValue(mimeType)) {
    stats.field_counts.mimeType += 1;
  } else {
    missing.push("mimeType");
  }

  const createTime = getFirstValue(item, [
    ["createTime"],
    ["mediaFile", "createTime"],
    ["mediaMetadata", "creationTime"],
  ]);
  if (hasValue(createTime)) {
    stats.field_counts.createTime += 1;
  } else {
    missing.push("createTime");
  }

  const width = getFirstValue(item, [
    ["mediaFile", "mediaFileMetadata", "width"],
    ["mediaFile", "width"],
    ["mediaMetadata", "width"],
  ]);
  if (hasValue(width)) {
    stats.field_counts.width += 1;
  } else {
    missing.push("width");
  }

  const height = getFirstValue(item, [
    ["mediaFile", "mediaFileMetadata", "height"],
    ["mediaFile", "height"],
    ["mediaMetadata", "height"],
  ]);
  if (hasValue(height)) {
    stats.field_counts.height += 1;
  } else {
    missing.push("height");
  }

  const baseUrl = getFirstValue(item, [["mediaFile", "baseUrl"], ["baseUrl"]]);
  if (hasValue(baseUrl)) {
    stats.field_counts.baseUrl += 1;
  } else {
    missing.push("baseUrl");
  }

  if (missing.length > 0 && stats.missing_samples.length < 10) {
    stats.missing_samples.push({
      id: id || null,
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
