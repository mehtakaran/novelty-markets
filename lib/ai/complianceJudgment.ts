// Step 2, Tier 2, the AI half: a judgment call for anything the hard-coded topic, jurisdiction,
// and resolution rules didn't already block. Always comes back as a recommendation with
// reasoning attached. Never a bare score, and never treated as the final word. If the call
// fails, we throw and the caller (temporal/activities.ts) treats that as a failure, not a pass.

import { z } from "zod";
import { callClaudeForJson } from "./client";
import { buildCompliancePrompt } from "./prompts";
import pastMarkets from "@/data/fixtures/pastMarkets.json";
import type { ComplianceResult, TriagedCandidate } from "@/lib/types";

const schema = z.object({
  status: z.enum(["pass", "flag"]),
  reasoning: z.string().min(1),
});

interface PastMarketExample {
  marketQuestion: string;
  category: string;
  decision: string;
  reason: string;
}

export async function runTier2ComplianceJudgment(candidate: TriagedCandidate): Promise<ComplianceResult> {
  const prompt = buildCompliancePrompt(candidate, pastMarkets as PastMarketExample[]);
  const result = await callClaudeForJson(prompt, schema);
  return { status: result.status, tier: 2, reasoning: result.reasoning };
}
