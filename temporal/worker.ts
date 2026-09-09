// A standalone process that polls Temporal's task queue and actually runs the workflow and
// activity code. Needs to be running alongside the Temporal server and the Next.js app — see
// README for how to start everything together.
//
// Run with: npm run worker (or as the `worker` service in docker-compose.yml)

import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities";
import { config } from "@/lib/config";

// The worker uses its own NativeConnection type (different from @temporalio/client's
// Connection used elsewhere) — retries for the same reason as connectWithRetry in
// temporal/client.ts: in Docker Compose, Temporal's gRPC port isn't ready right away.
// 90 tries x 3s = 4.5 minutes — plenty of room for a cold `docker compose up` (pulling images
// plus that first-run Postgres migration). Every run after the first connects in a few seconds.
async function connectWithRetry(maxAttempts = 90, delayMs = 3000): Promise<NativeConnection> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await NativeConnection.connect({ address: config.temporalAddress });
    } catch (err) {
      lastErr = err;
      console.log(`[worker] waiting for Temporal at ${config.temporalAddress} (attempt ${attempt}/${maxAttempts})…`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}

async function main() {
  const connection = await connectWithRetry();
  const worker = await Worker.create({
    connection,
    workflowsPath: require.resolve("./workflows"),
    activities,
    taskQueue: config.temporalTaskQueue,
  });
  console.log(`[worker] listening on task queue "${config.temporalTaskQueue}" at ${config.temporalAddress}`);
  await worker.run();
}

main().catch((err) => {
  console.error("[worker] fatal error", err);
  process.exit(1);
});
