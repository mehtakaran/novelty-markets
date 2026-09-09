import { getCandidates, getSweeps } from "@/lib/db";
import { RunSweepButton } from "@/app/components/RunSweepButton";
import { ReviewQueueList } from "@/app/components/ReviewQueueList";

export const dynamic = "force-dynamic";

export default function ReviewQueuePage() {
  const candidates = getCandidates();
  const sweeps = getSweeps(1);
  const lastSweep = sweeps[0];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Trader Review Queue</h1>
        <p className="text-sm text-neutral-900">
          Every candidate found by discovery stays visible here — approved, rejected, flagged, or blocked — with its full reasoning. Nothing
          reaches a live market without an explicit decision below.
        </p>
      </div>

      <RunSweepButton />

      {lastSweep && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          <Stat label="Items in" value={lastSweep.itemsInCount} />
          <Stat label="Shortlisted" value={lastSweep.shortlistedCount} />
          <Stat label="Flagged" value={candidates.filter((c) => c.sweepId === lastSweep.id && c.complianceStatus === "flag").length} />
          <Stat label="Blocked" value={candidates.filter((c) => c.sweepId === lastSweep.id && c.complianceStatus === "block").length} />
          <Stat label="AI call failures" value={lastSweep.aiCallFailures} warn={lastSweep.aiCallFailures > 0} />
        </div>
      )}

      <ReviewQueueList candidates={candidates} />
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${warn ? "border-red-300 bg-red-50" : "border-neutral-200 bg-white"}`}>
      <p className={`text-xl font-semibold ${warn ? "text-red-700" : "text-neutral-900"}`}>{value}</p>
      <p className="text-xs text-neutral-800">{label}</p>
    </div>
  );
}
