export type WorkerConfig = {
  serviceName: string;
  version: string;
  environment: string;
  databaseUrl: string;
  databaseName: string;
  workerId: string;
  smokeTestOnStart: boolean;
  outboxBatchSize: number;
  outboxLeaseMs: number;
  outboxPollIntervalMs: number;
  renderReconciliationDelaySeconds: number;
  heartbeatIntervalSeconds: number;
};

function readBoolean(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function readPositiveInteger(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

export function loadWorkerConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): WorkerConfig {
  const databaseUrl = environment.MONGODB_URI?.trim();
  if (!databaseUrl) {
    throw new Error("MONGODB_URI is required by the worker.");
  }

  return {
    serviceName: "movprompt-worker",
    version: environment.APP_VERSION?.trim() || "0.1.0-dev",
    environment: environment.APP_ENV?.trim() || "development",
    databaseUrl,
    databaseName: environment.MONGODB_DATABASE?.trim() || "movprompt",
    workerId: environment.WORKER_ID?.trim() || crypto.randomUUID(),
    smokeTestOnStart: readBoolean(environment.WORKER_SMOKE_TEST_ON_START),
    outboxBatchSize: readPositiveInteger(environment.WORKER_OUTBOX_BATCH_SIZE, 20, "WORKER_OUTBOX_BATCH_SIZE"),
    outboxLeaseMs: readPositiveInteger(environment.WORKER_OUTBOX_LEASE_MS, 60_000, "WORKER_OUTBOX_LEASE_MS"),
    outboxPollIntervalMs: readPositiveInteger(
      environment.WORKER_OUTBOX_POLL_INTERVAL_MS,
      1_000,
      "WORKER_OUTBOX_POLL_INTERVAL_MS",
    ),
    renderReconciliationDelaySeconds: readPositiveInteger(
      environment.WORKER_RENDER_RECONCILIATION_DELAY_SECONDS,
      15,
      "WORKER_RENDER_RECONCILIATION_DELAY_SECONDS",
    ),
    heartbeatIntervalSeconds: readPositiveInteger(
      environment.WORKER_HEARTBEAT_INTERVAL_SECONDS,
      15,
      "WORKER_HEARTBEAT_INTERVAL_SECONDS",
    ),
  };
}
