"use client";

import { useMemo, useState } from "react";
import type { CandidateRow } from "@/lib/types";
import { CandidateCard } from "./CandidateCard";

type Filter = "all" | "pending" | "flagged" | "blocked" | "decided";

const TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending review" },
  { key: "flagged", label: "Flagged" },
  { key: "blocked", label: "Blocked" },
  { key: "decided", label: "Decided" },
];

export function ReviewQueueList({ candidates }: { candidates: CandidateRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    switch (filter) {
      case "pending":
        return candidates.filter((candidate) => candidate.traderAction === "pending");
      case "flagged":
        return candidates.filter((candidate) => candidate.complianceStatus === "flag");
      case "blocked":
        return candidates.filter((candidate) => candidate.complianceStatus === "block");
      case "decided":
        return candidates.filter((candidate) => candidate.traderAction !== "pending");
      default:
        return candidates;
    }
  }, [candidates, filter]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium border ${
              filter === tab.key ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-900 border-neutral-300 hover:bg-neutral-100"
            }`}
          >
            {tab.label} ({countFor(candidates, tab.key)})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-800 py-8 text-center">No candidates in this view yet.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((candidate) => (
            <CandidateCard key={candidate.id} candidate={candidate} />
          ))}
        </div>
      )}
    </div>
  );
}

function countFor(candidates: CandidateRow[], key: Filter): number {
  switch (key) {
    case "pending":
      return candidates.filter((candidate) => candidate.traderAction === "pending").length;
    case "flagged":
      return candidates.filter((candidate) => candidate.complianceStatus === "flag").length;
    case "blocked":
      return candidates.filter((candidate) => candidate.complianceStatus === "block").length;
    case "decided":
      return candidates.filter((candidate) => candidate.traderAction !== "pending").length;
    default:
      return candidates.length;
  }
}
