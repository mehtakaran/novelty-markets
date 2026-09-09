import type { ComplianceStatus } from "@/lib/types";

const STYLES: Record<string, string> = {
  pass: "bg-green-100 text-green-800 border-green-300",
  flag: "bg-amber-100 text-amber-800 border-amber-300",
  block: "bg-red-100 text-red-800 border-red-300",
  pending: "bg-neutral-100 text-neutral-900 border-neutral-300",
};

const LABELS: Record<string, string> = {
  pass: "Compliance: Pass",
  flag: "Compliance: Flagged",
  block: "Compliance: Blocked",
  pending: "Compliance: Pending",
};

export function ComplianceBadge({ status, tier }: { status: ComplianceStatus | "pending"; tier: 1 | 2 | null }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
      {tier && <span className="opacity-70">· Tier {tier}</span>}
    </span>
  );
}
