import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupReferencePrice } from "./pricingLookup";
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

test("close match to a reference market returns a sourced price", () => {
  const result = lookupReferencePrice(
    candidate({ marketQuestion: "Will Salt Lake win Outstanding Limited Series at the Emmys?", category: "awards" })
  );
  assert.equal(result?.source, "sourced");
  assert.equal(result?.value, 0.62);
});

test("no overlapping reference market returns null (falls through to the AI estimate)", () => {
  const result = lookupReferencePrice(
    candidate({ marketQuestion: "Will the artisan cheese festival break attendance records this year?", category: "local-events" })
  );
  assert.equal(result, null);
});
