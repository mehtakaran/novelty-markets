"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CandidateRow } from "@/lib/types";
import { formatDateTime } from "@/lib/formatDate";
import { ComplianceBadge } from "./ComplianceBadge";
import { PriceBadge } from "./PriceBadge";

export function CandidateCard({ candidate }: { candidate: CandidateRow }) {
  const router = useRouter();
  const [showReasoning, setShowReasoning] = useState(false);
  const [reason, setReason] = useState("");
  const [price, setPrice] = useState(candidate.priceValue ?? 0.5);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const needsOverride = candidate.complianceStatus === "flag" || candidate.complianceStatus === "block";
  const decided = candidate.traderAction !== "pending";

  async function decide(action: "approve" | "reject" | "override_approve") {
    setError(null);
    if (action === "override_approve" && !reason.trim()) {
      setError("A reason is required to override a flagged/blocked candidate.");
      return;
    }
    setBusy(action);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reason: reason.trim() || undefined,
          priceOverride: action === "reject" ? undefined : price,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error + (data.hint ? ` (${data.hint})` : ""));
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-neutral-900">{candidate.marketQuestion}</p>
          <p className="text-xs text-neutral-800 mt-0.5">
            {candidate.category} · source: {candidate.sourceType} ({candidate.sourceItemId})
            {candidate.resolutionDate && <> · resolves {candidate.resolutionDate}</>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <ComplianceBadge status={candidate.complianceStatus} tier={candidate.complianceTier} />
          <PriceBadge value={candidate.priceValue} source={candidate.priceSource} />
        </div>
      </div>

      <button onClick={() => setShowReasoning((s) => !s)} className="text-xs text-neutral-800 underline underline-offset-2">
        {showReasoning ? "Hide reasoning" : "Show reasoning"}
      </button>

      {showReasoning && (
        <div className="text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-md p-3 space-y-2">
          <p>
            <span className="font-medium">Why shortlisted (AI triage):</span> {candidate.triageReasoning}
          </p>
          {candidate.complianceReasoning && (
            <p>
              <span className="font-medium">Compliance reasoning:</span> {candidate.complianceReasoning}
            </p>
          )}
          {candidate.priceReasoning && (
            <p>
              <span className="font-medium">Pricing reasoning:</span> {candidate.priceReasoning}
            </p>
          )}
        </div>
      )}

      {decided ? (
        <div className="text-xs rounded-md bg-neutral-50 border border-neutral-200 p-3">
          <p>
            <span className="font-medium capitalize">{candidate.traderAction.replace("_", " ")}</span> by {candidate.decidedBy} at{" "}
            {candidate.decidedAt && formatDateTime(candidate.decidedAt)}
            {candidate.traderPriceOverride !== null && <> · price: {Math.round(candidate.traderPriceOverride * 100)}%</>}
          </p>
          {candidate.overrideReason && <p className="mt-1">Reason: {candidate.overrideReason}</p>}
          {candidate.publishedAt && <p className="mt-1 text-green-700">Published at {formatDateTime(candidate.publishedAt)}</p>}
        </div>
      ) : (
        <div className="border-t border-neutral-100 pt-3 space-y-2">
          <div className="flex items-center gap-3">
            <label className="text-xs text-neutral-900">
              Price:
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="ml-2 w-20 rounded border border-neutral-300 px-1.5 py-0.5 text-xs"
              />
              <span className="ml-1 text-neutral-700">({Math.round(price * 100)}%)</span>
            </label>
          </div>

          {needsOverride && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Required: reason for overriding this flag/block…"
              className="w-full rounded border border-neutral-300 px-2 py-1.5 text-xs"
              rows={2}
            />
          )}

          <div className="flex gap-2">
            <button
              onClick={() => decide(needsOverride ? "override_approve" : "approve")}
              disabled={busy !== null}
              className="rounded-md bg-neutral-900 text-white text-xs px-3 py-1.5 font-medium hover:bg-neutral-700 disabled:opacity-50"
            >
              {busy === "approve" || busy === "override_approve" ? "Working…" : needsOverride ? "Override & Approve" : "Approve"}
            </button>
            <button
              onClick={() => decide("reject")}
              disabled={busy !== null}
              className="rounded-md border border-neutral-300 text-xs px-3 py-1.5 font-medium hover:bg-neutral-100 disabled:opacity-50"
            >
              {busy === "reject" ? "Working…" : "Reject"}
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
