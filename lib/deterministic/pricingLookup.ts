// Step 3, the deterministic half: if a similar market already exists in the reference data,
// just use its price. This is plain keyword/category overlap scoring — no AI needed to look
// something up that's already sitting in a table.

import predictionMarketReference from "@/data/fixtures/predictionMarketReference.json";
import { config } from "@/lib/config";
import type { PriceResult, TriagedCandidate } from "@/lib/types";

interface ReferenceMarket {
  id: string;
  question: string;
  category: string;
  impliedPrice: number;
  source: string;
  volume: number;
}

const STOPWORDS = new Set([
  "will", "the", "a", "an", "be", "is", "are", "to", "of", "in", "on", "for", "this",
  "at", "this", "year", "their", "and", "or", "by", "within", "before",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word))
  );
}

/** How many words two sets share, as a fraction of the smaller set's size. */
function overlapScore(candidateTokens: Set<string>, referenceTokens: Set<string>): number {
  if (candidateTokens.size === 0 || referenceTokens.size === 0) return 0;
  let shared = 0;
  for (const word of candidateTokens) if (referenceTokens.has(word)) shared++;
  return shared / Math.min(candidateTokens.size, referenceTokens.size);
}

/** Returns a sourced price if a reference market is a close enough match, otherwise null. */
export function lookupReferencePrice(candidate: TriagedCandidate): PriceResult | null {
  const candidateTokens = tokenize(`${candidate.marketQuestion} ${candidate.eventDescription}`);

  let best: { market: ReferenceMarket; score: number } | null = null;
  for (const market of predictionMarketReference as ReferenceMarket[]) {
    const categoryBonus = market.category.toLowerCase() === candidate.category.toLowerCase() ? 0.15 : 0;
    const score = overlapScore(candidateTokens, tokenize(market.question)) + categoryBonus;
    if (!best || score > best.score) best = { market, score };
  }

  if (!best || best.score < config.pricingMatchThreshold) return null;

  return {
    value: best.market.impliedPrice,
    source: "sourced",
    referenceMarket: best.market.question,
    reasoning: `Matched an existing reference market ("${best.market.question}", ${best.market.source}, volume ${best.market.volume.toLocaleString()}) with keyword/category overlap score ${best.score.toFixed(2)}. Using its implied price directly.`,
  };
}
