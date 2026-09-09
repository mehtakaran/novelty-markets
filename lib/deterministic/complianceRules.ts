// Step 2, Tier 1: the hard-coded rules. No AI, no ambiguity — these are the checks the
// business confirmed always apply. The reasoning we return here is just "which rule fired."

import policyRules from "@/data/fixtures/policyRules.json";
import type { ComplianceResult, TriagedCandidate } from "@/lib/types";

interface TopicRule {
  ruleId: string;
  label: string;
  keywords: string[];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches whole words only, not substrings — "war" shouldn't match inside "award", "pope"
 * shouldn't match inside some unrelated compound word. That's what \b does here, and it still
 * works for multi-word keywords like "south australia" since it matches across the phrase.
 */
function matchesKeyword(haystack: string, rule: TopicRule): string | null {
  const lower = haystack.toLowerCase();
  const hit = rule.keywords.find((keyword) => new RegExp(`\\b${escapeRegExp(keyword.toLowerCase())}\\b`).test(lower));
  return hit ?? null;
}

/**
 * Blocks the candidate if a hard rule fires. Otherwise it's a Tier 1 pass, which just means
 * "no hard rule blocked it" — the caller still sends it on to Tier 2 for an AI judgment call.
 */
export function runTier1ComplianceCheck(candidate: TriagedCandidate): ComplianceResult {
  const text = `${candidate.eventDescription} ${candidate.marketQuestion}`;

  if (candidate.injectionFlag) {
    return {
      status: "flag",
      tier: 1,
      ruleId: "injection-pattern-detected",
      reasoning: `Source content matched a known instruction-hijack pattern ("${candidate.injectionFlag}"). This doesn't necessarily mean the AI judgment below was compromised, but it's flagged for mandatory manual review regardless.`,
    };
  }

  for (const rule of policyRules.blockedTopics as TopicRule[]) {
    const hit = matchesKeyword(text, rule);
    if (hit) {
      return {
        status: "block",
        tier: 1,
        ruleId: rule.ruleId,
        reasoning: `Blocked by rule "${rule.label}": matched keyword "${hit}". Topics touching war, tragedy, or religion are always blocked per policy.`,
      };
    }
  }

  for (const rule of policyRules.blockedJurisdictions as TopicRule[]) {
    const hit = matchesKeyword(text, rule);
    if (hit) {
      return {
        status: "block",
        tier: 1,
        ruleId: rule.ruleId,
        reasoning: `Blocked by rule "${rule.label}": matched keyword "${hit}". This jurisdiction is excluded from novelty markets.`,
      };
    }
  }

  if (!candidate.resolutionDate || !candidate.resolutionCriteria) {
    return {
      status: "block",
      tier: 1,
      ruleId: policyRules.requiresVerifiableResolution.ruleId,
      reasoning:
        "Blocked by rule \"No verifiable resolution source\": no fixed resolution date and/or clear resolution criteria was identified for this event.",
    };
  }

  return {
    status: "pass",
    tier: 1,
    reasoning: "No Tier 1 rule fired (no blocked topic, no excluded jurisdiction, resolution date and criteria present).",
  };
}
