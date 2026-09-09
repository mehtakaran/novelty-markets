import { getLiveMarkets, getLatestCompetitorCheck, getCandidateById } from "@/lib/db";
import { config } from "@/lib/config";
import { formatDateTime } from "@/lib/formatDate";
import { RefreshMonitoringButton } from "@/app/components/RefreshMonitoringButton";
import { AcceptPriceButton } from "@/app/components/AcceptPriceButton";

export const dynamic = "force-dynamic";

export default function MonitoringPage() {
  const rows = getLiveMarkets().map((market) => ({
    market,
    check: getLatestCompetitorCheck(market.id),
    candidate: market.candidateId ? getCandidateById(market.candidateId) : null,
  }));
  const alertCount = rows.filter((r) => r.check?.alert).length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Live Markets</h1>
        <p className="text-sm text-neutral-900">
          Every market that has gone live, who approved it, and how it compares to a competitor reference price (checked hourly on a
          real Temporal schedule). Anything outside +/-{config.priceAlertBandPct}% is flagged below.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <RefreshMonitoringButton />
        {alertCount > 0 && (
          <span className="text-sm text-red-700 font-medium">
            {alertCount} market{alertCount > 1 ? "s" : ""} outside the +/-{config.priceAlertBandPct}% band
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-800">
              <th className="px-4 py-2 font-medium">Market</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Approved</th>
              <th className="px-4 py-2 font-medium">Our price</th>
              <th className="px-4 py-2 font-medium">Competitor price</th>
              <th className="px-4 py-2 font-medium">Diff</th>
              <th className="px-4 py-2 font-medium">Last checked</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ market, check, candidate }) => (
              <tr key={market.id} className={`border-b border-neutral-100 last:border-0 align-top ${check?.alert ? "bg-red-50" : ""}`}>
                <td className="px-4 py-2">{market.marketQuestion}</td>
                <td className="px-4 py-2 text-neutral-800">{market.category}</td>
                <td className="px-4 py-2 text-neutral-800">
                  {candidate?.decidedBy ? (
                    <>
                      <div>{candidate.decidedBy}</div>
                      {candidate.decidedAt && <div className="text-xs text-neutral-500">{formatDateTime(candidate.decidedAt)}</div>}
                      {candidate.overrideReason && (
                        <div className="text-xs text-neutral-500 mt-0.5">Override: {candidate.overrideReason}</div>
                      )}
                    </>
                  ) : (
                    "N/A"
                  )}
                </td>
                <td className="px-4 py-2">{Math.round(market.ourPrice * 100)}%</td>
                <td className="px-4 py-2">{check ? `${Math.round(check.competitorPrice * 100)}%` : "N/A"}</td>
                <td className={`px-4 py-2 font-medium ${check?.alert ? "text-red-700" : "text-neutral-900"}`}>
                  {check ? `${check.diffPct > 0 ? "+" : ""}${check.diffPct.toFixed(1)}%` : "N/A"}
                </td>
                <td className="px-4 py-2 text-neutral-800">{check ? formatDateTime(check.checkedAt) : "N/A"}</td>
                <td className="px-4 py-2">
                  {!check ? (
                    <span className="inline-flex items-center rounded-full border border-neutral-300 bg-neutral-100 text-neutral-900 px-2.5 py-0.5 text-xs font-medium">
                      No data yet
                    </span>
                  ) : check.alert ? (
                    <span className="inline-flex items-center rounded-full border border-red-300 bg-red-100 text-red-800 px-2.5 py-0.5 text-xs font-medium">
                      ALERT
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-green-300 bg-green-100 text-green-800 px-2.5 py-0.5 text-xs font-medium">
                      OK
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">{check?.alert && <AcceptPriceButton liveMarketId={market.id} />}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-neutral-800">
                  No live markets yet. Approve a candidate in the Review Queue to publish one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
