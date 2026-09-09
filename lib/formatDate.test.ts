import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDateTime } from "./formatDate";

// The exact wall-clock time depends on this machine's local timezone (that's expected,
// it's a display helper), so we check the shape of the output rather than an exact string,
// and that the locale is pinned (see the file's own comment for why that matters).
const MEDIUM_DATE_SHORT_TIME = /^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2}\s?(AM|PM)$/;

test("formats as a medium date + short time string", () => {
  const result = formatDateTime("2026-01-15T14:30:00Z");
  assert.match(result, MEDIUM_DATE_SHORT_TIME);
});

test("is deterministic for the same input", () => {
  const a = formatDateTime("2026-06-01T09:00:00Z");
  const b = formatDateTime("2026-06-01T09:00:00Z");
  assert.equal(a, b);
});
