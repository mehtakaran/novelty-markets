import { NextResponse } from "next/server";
import { getLiveMarkets, getLatestCompetitorCheck } from "@/lib/db";

export async function GET() {
  const markets = getLiveMarkets().map((m) => ({
    ...m,
    latestCheck: getLatestCompetitorCheck(m.id),
  }));
  return NextResponse.json({ markets });
}
