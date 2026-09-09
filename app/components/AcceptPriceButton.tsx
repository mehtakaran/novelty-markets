"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcceptPriceButton({ liveMarketId }: { liveMarketId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/monitoring/${liveMarketId}/accept-price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decidedBy: "trader (demo)" }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={accept}
        disabled={loading}
        className="rounded-md bg-neutral-900 text-white text-xs px-2.5 py-1 font-medium hover:bg-neutral-700 disabled:opacity-50 whitespace-nowrap"
      >
        {loading ? "Accepting…" : "Accept new price"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
