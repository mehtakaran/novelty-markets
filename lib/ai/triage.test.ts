import { test } from "node:test";
import assert from "node:assert/strict";
import { isPlaceholderShortlistItem } from "./triage";

test("an 'N/A' market question is recognized as a placeholder", () => {
  assert.equal(isPlaceholderShortlistItem({ marketQuestion: "N/A", category: "awards" }), true);
});

test("an 'N/A' category is recognized as a placeholder", () => {
  assert.equal(isPlaceholderShortlistItem({ marketQuestion: "Will the film win the top award?", category: "n/a" }), true);
});

test("a real candidate is not flagged as a placeholder", () => {
  assert.equal(isPlaceholderShortlistItem({ marketQuestion: "Will the film win the top award?", category: "awards" }), false);
});
