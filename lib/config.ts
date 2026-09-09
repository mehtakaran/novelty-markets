// Everything configurable lives here: env vars, plus the small set of hard-coded business
// numbers that back the deterministic (non-AI) rules.

export const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",

  temporalAddress: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
  temporalNamespace: process.env.TEMPORAL_NAMESPACE ?? "default",
  temporalTaskQueue: "novelty-markets",

  dbPath: process.env.DB_PATH ?? "data/novelty-markets.sqlite",

  // Price monitoring cadence and alert band, both confirmed with the business.
  priceMonitorCadenceCron: "0 * * * *", // hourly
  discoverySweepCron: "0 8,15 * * *", // 8:00am and 3:00pm daily
  priceAlertBandPct: 10,

  // How much keyword overlap counts as "close enough" to reuse a reference market's price.
  pricingMatchThreshold: 0.34,
} as const;

export function requireAnthropicKey(): string {
  if (!config.anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (see .env.local.example)."
    );
  }
  return config.anthropicApiKey;
}
