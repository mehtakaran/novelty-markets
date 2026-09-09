// This is the only place workflow code actually touches the database, calls the Anthropic
// API, or hits the mocked publish stub. It runs as a normal Node process, unlike
// temporal/workflows.ts, which is sandboxed.
//
// Each function here is a small wrapper: call into lib/deterministic or lib/ai, write the
// result to the DB, log it to the audit trail. For the AI ones specifically, a failure never
// gets treated as a pass. We catch it, log it, bump the sweep's failure counter, and hand
// back a clearly-labeled fallback so the rest of the sweep can keep going instead of crashing
// over one bad model call.

import { gatherDiscoveryBatch } from "@/lib/deterministic/discovery";
import { runTier1ComplianceCheck } from "@/lib/deterministic/complianceRules";
import { lookupReferencePrice } from "@/lib/deterministic/pricingLookup";
import { runCompetitorPriceCheck, type MonitorCheckOutcome } from "@/lib/deterministic/priceMonitor";
import { triageBatch } from "@/lib/ai/triage";
import { runTier2ComplianceJudgment } from "@/lib/ai/complianceJudgment";
import { estimatePriceWithAi } from "@/lib/ai/pricingEstimate";
import { publishMarket } from "@/lib/publish";
import {
  createSweep,
  finalizeSweep,
  getCandidateById,
  insertAudit,
  insertCandidateShell,
  markPublished,
  recordDecision as dbRecordDecision,
  updateCandidateCompliance,
  updateCandidatePrice,
} from "@/lib/db";
import type { ComplianceResult, DecisionInput, PriceResult, RawFeedItem, SweepRow, TraderAction, TriagedCandidate } from "@/lib/types";

// ---------- discovery + triage ----------

export async function discoverBatch(): Promise<RawFeedItem[]> {
  return gatherDiscoveryBatch();
}

export async function createSweepRecord(itemsInCount: number, triggeredBy: "manual" | "schedule"): Promise<SweepRow> {
  const sweep = createSweep(itemsInCount, triggeredBy);
  insertAudit("system", "sweep.started", null, { sweepId: sweep.id, itemsInCount, triggeredBy });
  return sweep;
}

export async function triageActivity(sweepId: string, batch: RawFeedItem[]): Promise<TriagedCandidate[]> {
  try {
    const shortlisted = await triageBatch(batch);
    insertAudit("ai", "triage.completed", null, {
      sweepId,
      itemsIn: batch.length,
      shortlisted: shortlisted.length,
      candidates: shortlisted.map((item) => ({ sourceItemId: item.sourceItemId, marketQuestion: item.marketQuestion, reasoning: item.triageReasoning })),
    });
    return shortlisted;
  } catch (error) {
    insertAudit("system", "triage.ai_call_failed", null, { sweepId, error: (error as Error).message });
    finalizeSweep(sweepId, { aiCallFailures: 1 });
    return [];
  }
}

export async function finalizeSweepRecord(
  sweepId: string,
  fields: Partial<Pick<SweepRow, "shortlistedCount" | "flaggedCount" | "blockedCount">>
): Promise<void> {
  finalizeSweep(sweepId, fields);
  insertAudit("system", "sweep.completed", null, { sweepId, ...fields });
}

// ---------- per-candidate: persistence + compliance + pricing ----------

export async function persistCandidateShell(sweepId: string, candidateId: string, candidate: TriagedCandidate): Promise<void> {
  insertCandidateShell(sweepId, candidateId, candidate);
  insertAudit("ai", "candidate.triaged", candidateId, {
    sourceType: candidate.sourceType,
    sourceItemId: candidate.sourceItemId,
    marketQuestion: candidate.marketQuestion,
    reasoning: candidate.triageReasoning,
    injectionFlag: candidate.injectionFlag ?? null,
  });
}

/**
 * Runs the Tier 1 hard rules first. If they don't already block it, runs Tier 2 (the AI
 * judgment call) as well. If the injection screen caught something, the result never goes
 * below "flag," no matter what Tier 2 concludes, and we keep both reasonings, not just one.
 */
export async function resolveCompliance(candidateId: string, candidate: TriagedCandidate): Promise<ComplianceResult> {
  const tier1 = runTier1ComplianceCheck(candidate);
  insertAudit("system", "compliance.tier1_checked", candidateId, { status: tier1.status, ruleId: tier1.ruleId ?? null, reasoning: tier1.reasoning });

  if (tier1.status === "block") {
    updateCandidateCompliance(candidateId, tier1);
    return tier1;
  }

  let tier2: ComplianceResult;
  try {
    tier2 = await runTier2ComplianceJudgment(candidate);
    insertAudit("ai", "compliance.tier2_judged", candidateId, { status: tier2.status, reasoning: tier2.reasoning });
  } catch (error) {
    insertAudit("system", "compliance.ai_call_failed", candidateId, { error: (error as Error).message });
    tier2 = {
      status: "flag",
      tier: 2,
      reasoning: `AI compliance judgment failed (${(error as Error).message}). Flagged automatically for mandatory manual review, since an AI failure is never treated as a pass.`,
    };
  }

  // The injection screen is an overlay on top of Tier 1, not a hard block by itself. We combine
  // it with Tier 2's independent judgment rather than letting either one silently win.
  const final: ComplianceResult =
    tier1.status === "flag"
      ? { status: "flag", tier: 2, reasoning: `${tier1.reasoning} Tier 2 AI judgment (informational, does not override the flag above): ${tier2.reasoning}` }
      : tier2;

  updateCandidateCompliance(candidateId, final);
  return final;
}

/** Tries the deterministic reference lookup first; only asks the AI to estimate if nothing matched. */
export async function resolvePricing(candidateId: string, candidate: TriagedCandidate, sweepBatch: RawFeedItem[]): Promise<PriceResult> {
  const sourced = lookupReferencePrice(candidate);
  if (sourced) {
    insertAudit("system", "pricing.sourced", candidateId, { value: sourced.value, referenceMarket: sourced.referenceMarket });
    updateCandidatePrice(candidateId, sourced);
    return sourced;
  }

  let estimated: PriceResult;
  try {
    estimated = await estimatePriceWithAi(candidate, sweepBatch);
    insertAudit("ai", "pricing.estimated", candidateId, { value: estimated.value, reasoning: estimated.reasoning });
  } catch (error) {
    insertAudit("system", "pricing.ai_call_failed", candidateId, { error: (error as Error).message });
    estimated = {
      value: 0.5,
      source: "estimated",
      reasoning: `AI price estimate failed (${(error as Error).message}). Defaulted to a neutral 0.5 placeholder, needs manual pricing before approval.`,
    };
  }
  updateCandidatePrice(candidateId, estimated);
  return estimated;
}

// ---------- human-in-the-loop decision + publish ----------

export async function recordDecisionActivity(candidateId: string, decision: DecisionInput): Promise<void> {
  const traderAction: TraderAction = decision.action === "approve" ? "approved" : decision.action === "reject" ? "rejected" : "overridden_approved";
  dbRecordDecision(candidateId, {
    traderAction,
    traderPriceOverride: decision.priceOverride ?? null,
    overrideReason: decision.reason ?? null,
    decidedBy: decision.decidedBy,
  });
  insertAudit("trader", `decision.${decision.action}`, candidateId, {
    reason: decision.reason ?? null,
    priceOverride: decision.priceOverride ?? null,
    decidedBy: decision.decidedBy,
  });
}

export async function publishActivity(candidateId: string, finalPrice: number): Promise<void> {
  const candidate = getCandidateById(candidateId);
  if (!candidate) throw new Error(`Cannot publish unknown candidate ${candidateId}`);
  const live = await publishMarket({
    candidateId,
    marketQuestion: candidate.marketQuestion,
    category: candidate.category,
    price: finalPrice,
  });
  markPublished(candidateId, live.publishedAt);
  insertAudit("system", "market.published", candidateId, { liveMarketId: live.id, price: finalPrice });
}

// ---------- price monitoring ----------

export async function runCompetitorPriceCheckActivity(): Promise<MonitorCheckOutcome[]> {
  return runCompetitorPriceCheck();
}
