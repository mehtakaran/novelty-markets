// A quick check for prompt injection: news/social/trending-market text comes from the open
// internet, not from the trader, and it gets sent straight into AI prompts as data to judge.
// So we scan it for known instruction-hijack phrasing before it ever reaches the model.
// This is a plain pattern match, not a judgment call, which is why it lives here as a
// deterministic check rather than behind another AI call (that would just reintroduce the
// exact problem it's supposed to catch).
//
// If something matches, we don't try to clean it up or quietly drop it — it just forces a
// human to review it, the same way a blocked topic would.

const SUSPICIOUS_PATTERNS: RegExp[] = [
  /ignore (all|any|the)? ?(previous|prior|above) instructions/i,
  /disregard (all|any|the)? ?(previous|prior|above)/i,
  /new (system )?instructions?:/i,
  /you are now/i,
  /act as (a|an)/i,
  /system prompt/i,
  /override your instructions/i,
  /this is (a|an) (test|override)/i,
  /do not flag this/i,
  /automatically (approve|pass|mark)/i,
];

export function screenForInjectionPatterns(text: string): string | null {
  for (const pattern of SUSPICIOUS_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}
