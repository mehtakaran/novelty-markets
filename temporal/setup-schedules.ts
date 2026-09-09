// Sets up the two real cron schedules confirmed with the business: discovery sweeps at
// 8:00/15:00 daily, competitor price checks hourly. Safe to run more than once. The
// "Run Discovery Sweep" / "Simulate hourly check" buttons in the UI trigger workflows
// directly for demo purposes; these schedules are what fires them unattended in production.
//
// Run with: npm run temporal:setup

import { ScheduleAlreadyRunning, NamespaceNotFoundError } from "@temporalio/client";
import { getTemporalClient, connectWithRetry } from "./client";
import { config } from "@/lib/config";

/**
 * A fresh Temporal server (e.g. after `docker compose up` with a wiped Postgres volume) opens
 * its gRPC port slightly before its "default" namespace finishes registering. It's a brief but
 * real race, so we retry specifically on that error rather than treating it as fatal.
 */
async function retryOnNamespaceNotFound<T>(fn: () => Promise<T>, maxAttempts = 15, delayMs = 2000): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof NamespaceNotFoundError && attempt < maxAttempts) {
        console.log(`[schedules] namespace not ready yet, retrying (attempt ${attempt}/${maxAttempts})…`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

async function upsertSchedule(scheduleId: string, cron: string, workflowType: string) {
  const client = await getTemporalClient();
  const action = {
    type: "startWorkflow" as const,
    workflowType,
    taskQueue: config.temporalTaskQueue,
    workflowId: `${scheduleId}-run`,
    args: workflowType === "discoverySweepWorkflow" ? ["schedule"] : [],
  };

  try {
    await client.schedule.create({
      scheduleId,
      spec: { cronExpressions: [cron] },
      action,
    });
    console.log(`[schedules] created "${scheduleId}" (${cron})`);
  } catch (err) {
    if (err instanceof ScheduleAlreadyRunning) {
      const handle = client.schedule.getHandle(scheduleId);
      await handle.update((prev) => ({
        ...prev,
        spec: { cronExpressions: [cron] },
        action,
      }));
      console.log(`[schedules] updated existing "${scheduleId}" (${cron})`);
    } else {
      throw err;
    }
  }
}

async function main() {
  // Wait for Temporal's gRPC port to actually be reachable before touching the real client.
  // In Docker Compose it can take a while (Postgres schema migration) before it's up.
  const probe = await connectWithRetry();
  await probe.close();

  await retryOnNamespaceNotFound(() => upsertSchedule("discovery-sweep-schedule", config.discoverySweepCron, "discoverySweepWorkflow"));
  await retryOnNamespaceNotFound(() => upsertSchedule("price-monitor-schedule", config.priceMonitorCadenceCron, "priceMonitorWorkflow"));
  console.log("[schedules] done. View them at the Temporal Web UI (default http://localhost:8233).");
  process.exit(0);
}

main().catch((err) => {
  console.error("[schedules] failed", err);
  process.exit(1);
});
