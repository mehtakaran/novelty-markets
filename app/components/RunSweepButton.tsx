"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunSweepButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ itemsIn: number; shortlisted: number } | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/discovery/run", { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error + (data.hint ? ` (${data.hint})` : ""));
      setLastResult(data.result);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={loading}
        className="rounded-md bg-neutral-900 text-white text-sm px-4 py-2 font-medium hover:bg-neutral-700 disabled:opacity-50"
      >
        {loading ? "Running sweep… (discovery → AI triage → compliance → pricing)" : "Run Discovery Sweep"}
      </button>
      {lastResult && !error && (
        <span className="text-xs text-neutral-800">
          Last sweep: {lastResult.itemsIn} items in → {lastResult.shortlisted} shortlisted
        </span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
