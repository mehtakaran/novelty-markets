import { NextResponse } from "next/server";
import { getTemporalClient } from "@/temporal/client";
import type { DecisionInput } from "@/lib/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as Partial<DecisionInput>;

  if (!body.action || !["approve", "reject", "override_approve"].includes(body.action)) {
    return NextResponse.json({ ok: false, error: "action must be approve, reject, or override_approve" }, { status: 400 });
  }
  if (body.action === "override_approve" && !body.reason?.trim()) {
    return NextResponse.json({ ok: false, error: "A reason is required to override a flag." }, { status: 400 });
  }
  if (body.priceOverride !== undefined && (body.priceOverride < 0 || body.priceOverride > 1)) {
    return NextResponse.json({ ok: false, error: "priceOverride must be between 0 and 1" }, { status: 400 });
  }

  const decision: DecisionInput = {
    action: body.action,
    reason: body.reason?.trim() || undefined,
    priceOverride: body.priceOverride,
    decidedBy: body.decidedBy?.trim() || "trader (demo)",
  };

  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(id);
    await handle.signal("decide", decision);
    const result = await handle.result();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message, hint: "Is `temporal server start-dev` and `npm run worker` running, and is this candidate's workflow still active?" },
      { status: 502 }
    );
  }
}
