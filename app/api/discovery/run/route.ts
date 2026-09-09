import { NextResponse } from "next/server";
import { getTemporalClient } from "@/temporal/client";
import { config } from "@/lib/config";

export async function POST() {
  try {
    const client = await getTemporalClient();
    const result = await client.workflow.execute("discoverySweepWorkflow", {
      taskQueue: config.temporalTaskQueue,
      workflowId: `discovery-sweep-manual-${Date.now()}`,
      args: ["manual"],
      workflowExecutionTimeout: "2 minutes",
    });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message, hint: "Is `temporal server start-dev` and `npm run worker` running?" },
      { status: 502 }
    );
  }
}
