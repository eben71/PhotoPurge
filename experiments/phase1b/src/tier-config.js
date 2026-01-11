const TIER_CONFIGS = {
  test: {
    maxItemCount: 10,
    pollTimeoutMs: 5 * 60 * 1000,
  },
  small: {
    maxItemCount: 200,
    pollTimeoutMs: 5 * 60 * 1000,
  },
  large: {
    maxItemCount: 2000,
    pollTimeoutMs: 5 * 60 * 1000,
  },
};

function resolveTierConfig(tier, overrideMaxItemCount) {
  const config = TIER_CONFIGS[tier];
  if (!config) {
    throw new Error(`Unknown tier: ${tier}`);
  }
  const maxItemCount = overrideMaxItemCount ?? config.maxItemCount;
  return {
    ...config,
    maxItemCount,
  };
}

module.exports = {
  TIER_CONFIGS,
  resolveTierConfig,
};
