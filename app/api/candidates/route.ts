import { NextResponse } from "next/server";
import { getCandidates } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ candidates: getCandidates() });
}
