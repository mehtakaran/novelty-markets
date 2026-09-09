// One shared Temporal client, used by the Next.js API routes to start workflows, send
// decision signals, and trigger schedules on demand.

import { Connection, Client } from "@temporalio/client";
import { config } from "@/lib/config";

let clientPromise: Promise<Client> | null = null;

export function getTemporalClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = Connection.connect({ address: config.temporalAddress }).then(
      (connection) => new Client({ connection, namespace: config.temporalNamespace })
    );
  }
  return clientPromise;
}

/**
 * Only meant for startup-time callers: the worker process and the one-shot schedule-setup
 * script. Not for API routes, which should fail fast so a button click gives quick feedback.
 * In Docker Compose, Temporal can take a while to actually be ready (Postgres has to finish
 * its schema migration first), so these two callers retry instead of giving up immediately.
 */
// 90 tries x 3s = 4.5 minutes. That's plenty of room for a cold `docker compose up` (pulling
// images plus that first-run Postgres migration). Every run after the first connects in a few seconds.
export async function connectWithRetry(maxAttempts = 90, delayMs = 3000): Promise<Connection> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await Connection.connect({ address: config.temporalAddress });
    } catch (err) {
      lastErr = err;
      console.log(`[temporal] waiting for ${config.temporalAddress} (attempt ${attempt}/${maxAttempts})…`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}
