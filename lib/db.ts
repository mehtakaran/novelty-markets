// All the app's data lives in one SQLite file, using Node's built-in node:sqlite module —
// no extra database package to install. Every page (Review Queue, Monitoring, Audit Log)
// reads from here, and the Temporal activities are the only code that writes to it.

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./config";
import type {
  AuditActor,
  AuditEntry,
  CandidateRow,
  CompetitorCheckRow,
  ComplianceResult,
  LiveMarketRow,
  PriceResult,
  SweepRow,
  TraderAction,
  TriagedCandidate,
} from "./types";

let db: DatabaseSync | null = null;

function schema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sweeps (
      id TEXT PRIMARY KEY,
      run_at TEXT NOT NULL,
      items_in_count INTEGER NOT NULL DEFAULT 0,
      shortlisted_count INTEGER NOT NULL DEFAULT 0,
      flagged_count INTEGER NOT NULL DEFAULT 0,
      blocked_count INTEGER NOT NULL DEFAULT 0,
      ai_call_failures INTEGER NOT NULL DEFAULT 0,
      triggered_by TEXT NOT NULL DEFAULT 'manual'
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      sweep_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_item_id TEXT NOT NULL,
      event_description TEXT NOT NULL,
      market_question TEXT NOT NULL,
      category TEXT NOT NULL,
      resolution_date TEXT,
      resolution_criteria TEXT,
      triage_reasoning TEXT NOT NULL,
      compliance_status TEXT NOT NULL DEFAULT 'pending',
      compliance_tier INTEGER,
      compliance_reasoning TEXT,
      price_value REAL,
      price_source TEXT,
      price_reasoning TEXT,
      price_reference_market TEXT,
      trader_action TEXT NOT NULL DEFAULT 'pending',
      trader_price_override REAL,
      override_reason TEXT,
      decided_by TEXT,
      decided_at TEXT,
      published_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      actor TEXT NOT NULL,
      event_type TEXT NOT NULL,
      candidate_id TEXT,
      details_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS live_markets (
      id TEXT PRIMARY KEY,
      candidate_id TEXT,
      market_question TEXT NOT NULL,
      category TEXT NOT NULL,
      our_price REAL NOT NULL,
      published_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS competitor_price_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      live_market_id TEXT NOT NULL,
      checked_at TEXT NOT NULL,
      competitor_price REAL NOT NULL,
      diff_pct REAL NOT NULL,
      alert INTEGER NOT NULL
    );
  `);
}

/** Opens the database on first use and makes sure the tables exist. Reused after that. */
export function getDb(): DatabaseSync {
  if (db) return db;
  const resolvedPath = path.resolve(process.cwd(), config.dbPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  db = new DatabaseSync(resolvedPath);
  schema(db);
  return db;
}

// ---------- sweeps ----------

export function createSweep(itemsInCount: number, triggeredBy: "manual" | "schedule"): SweepRow {
  const db = getDb();
  const sweep: SweepRow = {
    id: randomUUID(),
    runAt: new Date().toISOString(),
    itemsInCount,
    shortlistedCount: 0,
    flaggedCount: 0,
    blockedCount: 0,
    aiCallFailures: 0,
    triggeredBy,
  };
  db.prepare(
    `INSERT INTO sweeps (id, run_at, items_in_count, shortlisted_count, flagged_count, blocked_count, ai_call_failures, triggered_by)
     VALUES (?, ?, ?, 0, 0, 0, 0, ?)`
  ).run(sweep.id, sweep.runAt, sweep.itemsInCount, sweep.triggeredBy);
  return sweep;
}

/** Updates whichever counters are passed in, leaving the rest of the row untouched. */
export function finalizeSweep(
  sweepId: string,
  fields: Partial<Pick<SweepRow, "shortlistedCount" | "flaggedCount" | "blockedCount" | "aiCallFailures">>
) {
  const db = getDb();
  const current = db.prepare("SELECT * FROM sweeps WHERE id = ?").get(sweepId) as Record<string, unknown>;
  if (!current) return;
  const merged = {
    shortlisted_count: fields.shortlistedCount ?? current.shortlisted_count,
    flagged_count: fields.flaggedCount ?? current.flagged_count,
    blocked_count: fields.blockedCount ?? current.blocked_count,
    ai_call_failures: fields.aiCallFailures ?? current.ai_call_failures,
  };
  db.prepare(
    `UPDATE sweeps SET shortlisted_count = ?, flagged_count = ?, blocked_count = ?, ai_call_failures = ? WHERE id = ?`
  ).run(merged.shortlisted_count as number, merged.flagged_count as number, merged.blocked_count as number, merged.ai_call_failures as number, sweepId);
}

export function getSweeps(limit = 10): SweepRow[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM sweeps ORDER BY run_at DESC LIMIT ?").all(limit) as Record<string, unknown>[];
  return rows.map(rowToSweep);
}

function rowToSweep(row: Record<string, unknown>): SweepRow {
  return {
    id: row.id as string,
    runAt: row.run_at as string,
    itemsInCount: row.items_in_count as number,
    shortlistedCount: row.shortlisted_count as number,
    flaggedCount: row.flagged_count as number,
    blockedCount: row.blocked_count as number,
    aiCallFailures: row.ai_call_failures as number,
    triggeredBy: row.triggered_by as "manual" | "schedule",
  };
}

// ---------- candidates ----------

/** Which source items already produced a candidate, so a re-run of discovery doesn't duplicate them. */
export function existingSourceItemIds(): Set<string> {
  const db = getDb();
  const rows = db.prepare("SELECT DISTINCT source_item_id FROM candidates").all() as { source_item_id: string }[];
  return new Set(rows.map((row) => row.source_item_id));
}

export function insertCandidateShell(sweepId: string, id: string, candidate: TriagedCandidate): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO candidates (
      id, sweep_id, source_type, source_item_id, event_description, market_question, category,
      resolution_date, resolution_criteria, triage_reasoning, compliance_status, trader_action, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?)`
  ).run(
    id,
    sweepId,
    candidate.sourceType,
    candidate.sourceItemId,
    candidate.eventDescription,
    candidate.marketQuestion,
    candidate.category,
    candidate.resolutionDate,
    candidate.resolutionCriteria,
    candidate.triageReasoning,
    new Date().toISOString()
  );
}

export function updateCandidateCompliance(id: string, result: ComplianceResult): void {
  const db = getDb();
  db.prepare(
    `UPDATE candidates SET compliance_status = ?, compliance_tier = ?, compliance_reasoning = ? WHERE id = ?`
  ).run(result.status, result.tier, result.reasoning, id);
}

export function updateCandidatePrice(id: string, result: PriceResult): void {
  const db = getDb();
  db.prepare(
    `UPDATE candidates SET price_value = ?, price_source = ?, price_reasoning = ?, price_reference_market = ? WHERE id = ?`
  ).run(result.value, result.source, result.reasoning, result.referenceMarket ?? null, id);
}

export function recordDecision(
  id: string,
  fields: {
    traderAction: TraderAction;
    traderPriceOverride: number | null;
    overrideReason: string | null;
    decidedBy: string;
  }
): void {
  const db = getDb();
  db.prepare(
    `UPDATE candidates SET trader_action = ?, trader_price_override = ?, override_reason = ?, decided_by = ?, decided_at = ? WHERE id = ?`
  ).run(fields.traderAction, fields.traderPriceOverride, fields.overrideReason, fields.decidedBy, new Date().toISOString(), id);
}

export function markPublished(id: string, publishedAt: string): void {
  const db = getDb();
  db.prepare(`UPDATE candidates SET published_at = ? WHERE id = ?`).run(publishedAt, id);
}

export function getCandidateById(id: string): CandidateRow | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM candidates WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToCandidate(row) : null;
}

export function getCandidates(): CandidateRow[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM candidates ORDER BY created_at DESC").all() as Record<string, unknown>[];
  return rows.map(rowToCandidate);
}

function rowToCandidate(row: Record<string, unknown>): CandidateRow {
  return {
    id: row.id as string,
    sweepId: row.sweep_id as string,
    sourceType: row.source_type as CandidateRow["sourceType"],
    sourceItemId: row.source_item_id as string,
    eventDescription: row.event_description as string,
    marketQuestion: row.market_question as string,
    category: row.category as string,
    resolutionDate: (row.resolution_date as string) ?? null,
    resolutionCriteria: (row.resolution_criteria as string) ?? null,
    triageReasoning: row.triage_reasoning as string,
    complianceStatus: row.compliance_status as CandidateRow["complianceStatus"],
    complianceTier: (row.compliance_tier as CandidateRow["complianceTier"]) ?? null,
    complianceReasoning: (row.compliance_reasoning as string) ?? null,
    priceValue: (row.price_value as number) ?? null,
    priceSource: (row.price_source as CandidateRow["priceSource"]) ?? null,
    priceReasoning: (row.price_reasoning as string) ?? null,
    priceReferenceMarket: (row.price_reference_market as string) ?? null,
    traderAction: row.trader_action as TraderAction,
    traderPriceOverride: (row.trader_price_override as number) ?? null,
    overrideReason: (row.override_reason as string) ?? null,
    decidedBy: (row.decided_by as string) ?? null,
    decidedAt: (row.decided_at as string) ?? null,
    publishedAt: (row.published_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

// ---------- audit log ----------

export function insertAudit(actor: AuditActor, eventType: string, candidateId: string | null, details: Record<string, unknown>): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO audit_log (ts, actor, event_type, candidate_id, details_json) VALUES (?, ?, ?, ?, ?)`
  ).run(new Date().toISOString(), actor, eventType, candidateId, JSON.stringify(details));
}

export function getAuditLog(limit = 500): AuditEntry[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?").all(limit) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as number,
    ts: row.ts as string,
    actor: row.actor as AuditActor,
    eventType: row.event_type as string,
    candidateId: (row.candidate_id as string) ?? null,
    details: JSON.parse(row.details_json as string),
  }));
}

// ---------- live markets / price monitoring ----------

export function insertLiveMarket(row: Omit<LiveMarketRow, "id"> & { id?: string }): LiveMarketRow {
  const db = getDb();
  const id = row.id ?? randomUUID();
  db.prepare(
    `INSERT INTO live_markets (id, candidate_id, market_question, category, our_price, published_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, row.candidateId, row.marketQuestion, row.category, row.ourPrice, row.publishedAt);
  return { ...row, id };
}

export function getLiveMarkets(): LiveMarketRow[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM live_markets ORDER BY published_at DESC").all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    candidateId: (row.candidate_id as string) ?? "",
    marketQuestion: row.market_question as string,
    category: row.category as string,
    ourPrice: row.our_price as number,
    publishedAt: row.published_at as string,
  }));
}

export function insertCompetitorCheck(row: Omit<CompetitorCheckRow, "id">): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO competitor_price_checks (live_market_id, checked_at, competitor_price, diff_pct, alert) VALUES (?, ?, ?, ?, ?)`
  ).run(row.liveMarketId, row.checkedAt, row.competitorPrice, row.diffPct, row.alert ? 1 : 0);
}

export function getLatestCompetitorCheck(liveMarketId: string): CompetitorCheckRow | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM competitor_price_checks WHERE live_market_id = ? ORDER BY id DESC LIMIT 1")
    .get(liveMarketId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as number,
    liveMarketId: row.live_market_id as string,
    checkedAt: row.checked_at as string,
    competitorPrice: row.competitor_price as number,
    diffPct: row.diff_pct as number,
    alert: Boolean(row.alert),
  };
}
