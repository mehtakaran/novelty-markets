// Types shared across the deterministic logic, the AI logic, the Temporal workflows and
// activities, and the UI.

export type SourceType = "news" | "social" | "trending_market";

/** One raw item from a discovery feed, before AI triage has looked at it. */
export interface RawFeedItem {
  sourceType: SourceType;
  sourceItemId: string;
  headline: string;
  detail: string;
  observedAt: string;
  engagementSignal?: string; // e.g. "high social engagement", "trending #3 on Kalshi-style board"
  injectionFlag?: string; // set when the injection screen thinks this text looks like an instruction to the model
}

/** What Step 1 triage produces for one item it decided to shortlist. */
export interface TriagedCandidate {
  sourceType: SourceType;
  sourceItemId: string;
  eventDescription: string;
  marketQuestion: string;
  category: string;
  resolutionDate: string | null; // ISO date; null means the AI couldn't find one, which Tier 1 will block on
  resolutionCriteria: string | null;
  triageReasoning: string;
  injectionFlag?: string; // carried over from the source RawFeedItem, independent of what the AI concluded
}

export type ComplianceStatus = "pass" | "flag" | "block";
export type ComplianceTier = 1 | 2;

export interface ComplianceResult {
  status: ComplianceStatus;
  tier: ComplianceTier;
  reasoning: string;
  ruleId?: string; // set when Tier 1 fired
}

export type PriceSource = "sourced" | "estimated";

export interface PriceResult {
  value: number; // 0..1 implied probability
  source: PriceSource;
  reasoning: string;
  referenceMarket?: string; // set when sourced from prediction_market_reference.json
}

export type TraderAction = "pending" | "approved" | "rejected" | "overridden_approved";

export interface DecisionInput {
  action: "approve" | "reject" | "override_approve";
  reason?: string; // required for override_approve, optional otherwise
  priceOverride?: number;
  decidedBy: string; // trader identifier (email), for the audit trail
}

export interface CandidateRow {
  id: string;
  sweepId: string;
  sourceType: SourceType;
  sourceItemId: string;
  eventDescription: string;
  marketQuestion: string;
  category: string;
  resolutionDate: string | null;
  resolutionCriteria: string | null;
  triageReasoning: string;
  complianceStatus: ComplianceStatus | "pending";
  complianceTier: ComplianceTier | null;
  complianceReasoning: string | null;
  priceValue: number | null;
  priceSource: PriceSource | null;
  priceReasoning: string | null;
  priceReferenceMarket: string | null;
  traderAction: TraderAction;
  traderPriceOverride: number | null;
  overrideReason: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface SweepRow {
  id: string;
  runAt: string;
  itemsInCount: number;
  shortlistedCount: number;
  flaggedCount: number;
  blockedCount: number;
  aiCallFailures: number;
  triggeredBy: "manual" | "schedule";
}

export type AuditActor = "system" | "ai" | "trader";

export interface AuditEntry {
  id: number;
  ts: string;
  actor: AuditActor;
  eventType: string;
  candidateId: string | null;
  details: Record<string, unknown>;
}

export interface LiveMarketRow {
  id: string;
  candidateId: string;
  marketQuestion: string;
  category: string;
  ourPrice: number;
  publishedAt: string;
}

export interface CompetitorCheckRow {
  id: number;
  liveMarketId: string;
  checkedAt: string;
  competitorPrice: number;
  diffPct: number;
  alert: boolean;
}
