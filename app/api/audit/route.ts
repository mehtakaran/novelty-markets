import { NextResponse } from "next/server";
import { getAuditLog } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ entries: getAuditLog() });
}
