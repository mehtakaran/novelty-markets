// Step 1, the AI half: take a sweep's raw batch and shortlist the handful worth turning into
// a market. This is the call that replaces the trader's current gut-feel picking. See
// prompts.ts for exactly what criteria we give the model.

import { z } from "zod";
import { callClaudeForJson } from "./client";
import { buildTriagePrompt } from "./prompts";
import type { RawFeedItem, TriagedCandidate } from "@/lib/types";

const triageSchema = z.object({
  shortlisted: z.array(
    z.object({
      sourceItemId: z.string().min(1),
      eventDescription: z.string().min(1),
      marketQuestion: z.string().min(1),
      category: z.string().min(1),
      resolutionDate: z.string().nullable(),
      resolutionCriteria: z.string().nullable(),
      reasoning: z.string().min(1),
    })
  ),
});

/**
 * Observed quirk: when the model decides nothing (or nothing more) should be shortlisted, it
 * sometimes emits a placeholder item instead of just leaving the array empty. The reasoning
 * field usually says as much ("placeholder", "should not be included").
 */
export function isPlaceholderShortlistItem(item: { marketQuestion: string; category: string }): boolean {
  return item.marketQuestion.trim().toLowerCase() === "n/a" || item.category.trim().toLowerCase() === "n/a";
}

/** Throws AiCallError if the call fails or the model's output doesn't parse. The caller decides how to degrade. */
export async function triageBatch(batch: RawFeedItem[]): Promise<TriagedCandidate[]> {
  if (batch.length === 0) return [];

  const prompt = buildTriagePrompt(batch);
  const result = await callClaudeForJson(prompt, triageSchema);
  const bySourceId = new Map(batch.map((item) => [item.sourceItemId, item]));

  return result.shortlisted
    // If the model cites a sourceItemId that wasn't actually in the batch we sent it, drop
    // that item rather than trust a reference we can't verify.
    .filter((item) => bySourceId.has(item.sourceItemId))
    // Filtering here, not at the schema level, so one placeholder item doesn't fail (and
    // discard) an otherwise-good batch of real candidates.
    .filter((item) => !isPlaceholderShortlistItem(item))
    .map((item) => {
      const source = bySourceId.get(item.sourceItemId)!;
      return {
        sourceType: source.sourceType,
        sourceItemId: item.sourceItemId,
        eventDescription: item.eventDescription,
        marketQuestion: item.marketQuestion,
        category: item.category,
        resolutionDate: item.resolutionDate,
        resolutionCriteria: item.resolutionCriteria,
        triageReasoning: item.reasoning,
        injectionFlag: source.injectionFlag,
      } satisfies TriagedCandidate;
    });
}
