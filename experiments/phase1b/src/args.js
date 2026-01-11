function parseArgs(argv) {
  const args = {
    tier: "test",
    tokenId: "default",
    outputPrefix: null,
    maxItemCount: null,
    sampleSize: 25,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--tier") {
      args.tier = argv[index + 1];
      index += 1;
    } else if (arg === "--token-id") {
      args.tokenId = argv[index + 1];
      index += 1;
    } else if (arg === "--output-prefix") {
      args.outputPrefix = argv[index + 1];
      index += 1;
    } else if (arg === "--max-item-count") {
      args.maxItemCount = Number(argv[index + 1]);
      index += 1;
    } else if (arg === "--sample-size") {
      args.sampleSize = Number(argv[index + 1]);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.tier) {
    throw new Error("tier is required");
  }
  if (!args.tokenId) {
    throw new Error("token-id is required");
  }
  if (Number.isNaN(args.maxItemCount)) {
    throw new Error("max-item-count must be a number");
  }
  if (Number.isNaN(args.sampleSize) || args.sampleSize <= 0) {
    throw new Error("sample-size must be a positive number");
  }

  return args;
}

module.exports = {
  parseArgs,
};
