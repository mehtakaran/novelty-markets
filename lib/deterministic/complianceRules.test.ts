import { test } from "node:test";
import assert from "node:assert/strict";
import { runTier1ComplianceCheck } from "./complianceRules";
import type { TriagedCandidate } from "@/lib/types";

function candidate(overrides: Partial<TriagedCandidate>): TriagedCandidate {
  return {
    sourceType: "news",
    sourceItemId: "test-item",
    eventDescription: "A test fixture event.",
    marketQuestion: "Will the test fixture event happen?",
    category: "test",
    resolutionDate: "2026-12-01",
    resolutionCriteria: "Resolved by official announcement.",
    triageReasoning: "test fixture",
    ...overrides,
  };
}

test("war headline blocks", () => {
  const result = runTier1ComplianceCheck(candidate({ marketQuestion: "Will a ceasefire be declared in the border war within 30 days?" }));
  assert.equal(result.status, "block");
});

test("religion headline blocks", () => {
  const result = runTier1ComplianceCheck(candidate({ eventDescription: "The Pope's planned address to the religious community." }));
  assert.equal(result.status, "block");
});

test("tragedy headline blocks", () => {
  const result = runTier1ComplianceCheck(candidate({ eventDescription: "The death toll from the regional disaster continues to climb." }));
  assert.equal(result.status, "block");
});

test("South Australia jurisdiction blocks", () => {
  const result = runTier1ComplianceCheck(candidate({ marketQuestion: "Will the South Australia casino license be approved?" }));
  assert.equal(result.status, "block");
});

test("Adelaide (alternate jurisdiction keyword) also blocks", () => {
  const result = runTier1ComplianceCheck(candidate({ marketQuestion: "Will the new Adelaide stadium open on schedule?" }));
  assert.equal(result.status, "block");
});

test("missing resolution date blocks", () => {
  const result = runTier1ComplianceCheck(candidate({ resolutionDate: null }));
  assert.equal(result.status, "block");
});

test("missing resolution criteria blocks", () => {
  const result = runTier1ComplianceCheck(candidate({ resolutionCriteria: null }));
  assert.equal(result.status, "block");
});

test("clean well-formed candidate passes tier 1", () => {
  const result = runTier1ComplianceCheck(candidate({}));
  assert.equal(result.status, "pass");
});

test("'award' does not false-positive match the 'war' keyword", () => {
  const result = runTier1ComplianceCheck(candidate({ marketQuestion: "Will the film win the top award at this year's ceremony?" }));
  assert.equal(result.status, "pass");
});

test("injection-flagged candidate is floored at flag, not blocked or silently passed", () => {
  const result = runTier1ComplianceCheck(candidate({ injectionFlag: "ignore previous instructions" }));
  assert.equal(result.status, "flag");
});
