import type { PriceSource } from "@/lib/types";

export function PriceBadge({ value, source }: { value: number | null; source: PriceSource | null }) {
  if (value === null || source === null) {
    return <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-900 border-neutral-300">Pricing pending</span>;
  }
  const pct = Math.round(value * 100);
  if (source === "sourced") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 border-blue-300">
        {pct}% · Sourced from reference market
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 border-purple-300">
      {pct}% · AI Estimate (no reference market)
    </span>
  );
}
