// Step 6: a plain scheduled comparison, no AI involved. Cadence is hourly, alert band is
// +/-10%, both confirmed with the business.
//
// There's no real competitor odds feed to poll in this prototype, so each check nudges the
// competitor price for each market with a small random walk step, just to simulate
// normal hour-to-hour market movement. The step is seeded off the market id and timestamp so
// a given run is reproducible. The actual comparison and threshold logic is fully
// deterministic; only the fake competitor price is randomized.

import { config } from "@/lib/config";
import { getLatestCompetitorCheck, getLiveMarkets, insertCompetitorCheck, insertAudit } from "@/lib/db";

/** Turns a text seed into a number between 0 and 1. Same seed always gives the same result. */
function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  }
  // A few bit-shuffling passes so nearby seeds don't produce nearby results.
  hash ^= hash << 13;
  hash ^= hash >>> 17;
  hash ^= hash << 5;
  return ((hash >>> 0) % 10000) / 10000;
}

export interface MonitorCheckOutcome {
  liveMarketId: string;
  marketQuestion: string;
  ourPrice: number;
  competitorPrice: number;
  diffPct: number;
  alert: boolean;
  newlyBreached: boolean;
}

/** Runs one hourly competitor-price check across every live market. */
export function runCompetitorPriceCheck(): MonitorCheckOutcome[] {
  const now = new Date().toISOString();
  const outcomes: MonitorCheckOutcome[] = [];

  for (const market of getLiveMarkets()) {
    const previous = getLatestCompetitorCheck(market.id);
    const basePrice = previous?.competitorPrice ?? market.ourPrice;

    // A small step, up to +/- 6 percentage points, seeded so it's reproducible.
    const roll = seededRandom(`${market.id}:${now}`);
    const step = (roll - 0.5) * 0.12;
    const competitorPrice = Math.min(0.97, Math.max(0.03, basePrice + step));

    const diffPct = ((competitorPrice - market.ourPrice) / market.ourPrice) * 100;
    const alert = Math.abs(diffPct) >= config.priceAlertBandPct;
    const wasAlert = previous?.alert ?? false;

    insertCompetitorCheck({
      liveMarketId: market.id,
      checkedAt: now,
      competitorPrice,
      diffPct,
      alert,
    });

    const newlyBreached = alert && !wasAlert;
    if (newlyBreached) {
      insertAudit("system", "price_monitor.alert_breached", market.candidateId || null, {
        marketQuestion: market.marketQuestion,
        ourPrice: market.ourPrice,
        competitorPrice,
        diffPct: Number(diffPct.toFixed(1)),
      });
    }

    outcomes.push({
      liveMarketId: market.id,
      marketQuestion: market.marketQuestion,
      ourPrice: market.ourPrice,
      competitorPrice,
      diffPct,
      alert,
      newlyBreached,
    });
  }

  insertAudit("system", "price_monitor.check_completed", null, {
    marketsChecked: outcomes.length,
    breaches: outcomes.filter((outcome) => outcome.alert).length,
  });

  return outcomes;
}
