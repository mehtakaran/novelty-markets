// Step 3, the AI fallback: only runs when the deterministic reference-price lookup found
// nothing to match against. Estimates a starting probability from soft coverage signals. If
// the call fails, we throw rather than quietly defaulting to "0.5 with full confidence" — see
// temporal/activities.ts for how the caller labels that fallback clearly instead.

import { z } from "zod";
import { callClaudeForJson } from "./client";
import { buildPricingEstimatePrompt } from "./prompts";
import type { PriceResult, RawFeedItem, TriagedCandidate } from "@/lib/types";

const schema = z.object({
  value: z.number().min(0).max(1),
  reasoning: z.string().min(1),
});

/** Finds other feed items that look like the same story, by plain keyword overlap. */
function findRelatedItems(candidate: TriagedCandidate, batch: RawFeedItem[]): RawFeedItem[] {
  const candidateWords = new Set(
    candidate.marketQuestion
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3)
  );
  return batch
    .filter((item) => item.sourceItemId !== candidate.sourceItemId)
    .filter((item) => {
      const text = `${item.headline} ${item.detail}`.toLowerCase();
      return [...candidateWords].some((word) => text.includes(word));
    })
    .slice(0, 5);
}

function summarizeSignals(candidate: TriagedCandidate, relatedItems: RawFeedItem[]): string {
  if (relatedItems.length === 0) {
    return "No additional coverage signals found beyond the single sourcing item for this candidate.";
  }
  const lines = relatedItems.map(
    (item) => `- [${item.sourceType}] ${item.headline}${item.engagementSignal ? ` (${item.engagementSignal})` : ""}`
  );
  return `${relatedItems.length} related item(s) found across feeds for this story:\n${lines.join("\n")}`;
}

export async function estimatePriceWithAi(candidate: TriagedCandidate, sweepBatch: RawFeedItem[]): Promise<PriceResult> {
  const relatedItems = findRelatedItems(candidate, sweepBatch);
  const signalSummary = summarizeSignals(candidate, relatedItems);
  const prompt = buildPricingEstimatePrompt(candidate, signalSummary);
  const result = await callClaudeForJson(prompt, schema);
  return {
    value: result.value,
    source: "estimated",
    reasoning: result.reasoning,
  };
}
