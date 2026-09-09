import { NextResponse } from "next/server";
import { getLiveMarkets, getLatestCompetitorCheck, updateLiveMarketPrice, insertCompetitorCheck, insertAudit } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { decidedBy?: string };

  const market = getLiveMarkets().find((m) => m.id === id);
  if (!market) {
    return NextResponse.json({ ok: false, error: "Live market not found" }, { status: 404 });
  }

  const check = getLatestCompetitorCheck(id);
  if (!check) {
    return NextResponse.json({ ok: false, error: "No competitor price to accept yet" }, { status: 400 });
  }

  const oldPrice = market.ourPrice;
  const newPrice = check.competitorPrice;
  updateLiveMarketPrice(id, newPrice);

  // Record a fresh, in-band check against the price we just adopted, so the row shows OK
  // immediately instead of still showing the old alert until the next scheduled check.
  const now = new Date().toISOString();
  insertCompetitorCheck({ liveMarketId: id, checkedAt: now, competitorPrice: newPrice, diffPct: 0, alert: false });

  insertAudit("trader", "price_monitor.price_accepted", market.candidateId || null, {
    liveMarketId: id,
    marketQuestion: market.marketQuestion,
    oldPrice,
    newPrice,
    decidedBy: body.decidedBy?.trim() || "trader (demo)",
  });

  return NextResponse.json({ ok: true });
}
