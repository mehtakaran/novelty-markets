// This is the orchestration layer. It decides the order things happen in, but never touches
// the database, the AI, or anything else with real side effects directly (that's all in
// temporal/activities.ts). Temporal runs this file inside a sandboxed, deterministic replay
// engine, which is why it only imports the activity proxy and Temporal's own primitives.
//
// Each shortlisted candidate gets its own long-running workflow: it runs compliance and
// pricing, then just waits, possibly for hours or days, until a trader approves, rejects, or
// overrides it. Nothing publishes before that happens. Because the wait state lives on the
// Temporal server rather than in this process's memory, it survives a worker restart.

import { proxyActivities, defineSignal, setHandler, condition, startChild, ParentClosePolicy, uuid4 } from "@temporalio/workflow";
import type * as activities from "./activities";
import type { DecisionInput, RawFeedItem, TriagedCandidate } from "@/lib/types";
import type { MonitorCheckOutcome } from "@/lib/deterministic/priceMonitor";

const { discoverBatch, createSweepRecord, triageActivity, finalizeSweepRecord } = proxyActivities<typeof activities>({
  startToCloseTimeout: "2 minutes",
});

const { persistCandidateShell, resolveCompliance, resolvePricing, recordDecisionActivity, publishActivity } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: "2 minutes",
    retry: { maximumAttempts: 2 },
  });

const { runCompetitorPriceCheckActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 seconds",
});

export const decideSignal = defineSignal<[DecisionInput]>("decide");

export interface CandidateWorkflowInput {
  id: string;
  sweepId: string;
  candidate: TriagedCandidate;
  sweepBatch: RawFeedItem[];
}

/**
 * One of these runs per shortlisted candidate. It runs compliance and pricing, then just
 * waits for a human decision. Publish never happens before that.
 */
export async function candidateWorkflow(input: CandidateWorkflowInput): Promise<{ published: boolean }> {
  await persistCandidateShell(input.sweepId, input.id, input.candidate);
  await resolveCompliance(input.id, input.candidate);
  const price = await resolvePricing(input.id, input.candidate, input.sweepBatch);

  let decision: DecisionInput | undefined;
  setHandler(decideSignal, (incoming) => {
    decision = incoming;
  });
  await condition(() => decision !== undefined);

  await recordDecisionActivity(input.id, decision!);

  if (decision!.action === "approve" || decision!.action === "override_approve") {
    const finalPrice = decision!.priceOverride ?? price.value;
    await publishActivity(input.id, finalPrice);
    return { published: true };
  }
  return { published: false };
}

/**
 * Runs twice a day (8:00 / 15:00) and can also be triggered on demand. Kicks off one
 * candidateWorkflow per shortlisted item and doesn't wait around for them. They keep running
 * (waiting for a human) long after this one finishes, which is why the children use ABANDON
 * instead of Temporal's default of terminating them when the parent completes.
 */
export async function discoverySweepWorkflow(
  triggeredBy: "manual" | "schedule" = "schedule"
): Promise<{ itemsIn: number; shortlisted: number }> {
  const batch = await discoverBatch();
  const sweep = await createSweepRecord(batch.length, triggeredBy);
  const shortlisted = await triageActivity(sweep.id, batch);

  for (const candidate of shortlisted) {
    // We reuse this same id as both the Temporal workflow id and the candidates.id DB row, so
    // the API can later signal the right workflow using the same id the UI already shows.
    const candidateId = `candidate-${uuid4()}`;
    await startChild(candidateWorkflow, {
      workflowId: candidateId,
      args: [{ id: candidateId, sweepId: sweep.id, candidate, sweepBatch: batch }],
      parentClosePolicy: ParentClosePolicy.PARENT_CLOSE_POLICY_ABANDON,
    });
  }

  await finalizeSweepRecord(sweep.id, { shortlistedCount: shortlisted.length });
  return { itemsIn: batch.length, shortlisted: shortlisted.length };
}

/** Runs hourly and can also be triggered on demand. Just comparing prices and alerting, no AI. */
export async function priceMonitorWorkflow(): Promise<MonitorCheckOutcome[]> {
  return runCompetitorPriceCheckActivity();
}
