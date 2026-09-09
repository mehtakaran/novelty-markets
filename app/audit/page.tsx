import { getAuditLog } from "@/lib/db";
import { AuditLogTable } from "@/app/components/AuditLogTable";

export const dynamic = "force-dynamic";

export default function AuditPage() {
  const entries = getAuditLog();
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Audit Log</h1>
        <p className="text-sm text-neutral-900">
          Every decision the system makes — discovery, triage, compliance, pricing — and every trader action, queryable here. Most recent
          {" "}{entries.length} entries shown.
        </p>
      </div>
      <AuditLogTable entries={entries} />
    </div>
  );
}
