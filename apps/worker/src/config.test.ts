import { describe, expect, it } from "vitest";
import { loadWorkerConfig } from "./config.js";

describe("worker configuration", () => {
  it("loads the MongoDB replica-set connection used by infrastructure", () => {
    const config = loadWorkerConfig({
      MONGODB_URI: "mongodb://localhost:27017/movprompt?replicaSet=rs0",
      MONGODB_DATABASE: "movprompt_test",
      WORKER_ID: "worker-1",
    });

    expect(config.databaseUrl).toBe("mongodb://localhost:27017/movprompt?replicaSet=rs0");
    expect(config.databaseName).toBe("movprompt_test");
    expect(config.outboxBatchSize).toBe(20);
    expect(config.outboxLeaseMs).toBe(60_000);
    expect(config.outboxPollIntervalMs).toBe(1_000);
    expect(config.renderReconciliationDelaySeconds).toBe(15);
    expect(config.heartbeatIntervalSeconds).toBe(15);
  });

  it("uses the default database name", () => {
    const config = loadWorkerConfig({
      MONGODB_URI: "mongodb://localhost:27017",
      WORKER_ID: "worker-1",
    });

    expect(config.databaseName).toBe("movprompt");
  });

  it("fails fast without a direct database connection", () => {
    expect(() => loadWorkerConfig({})).toThrow("MONGODB_URI is required");
  });

  it("validates durable worker timing controls", () => {
    expect(() =>
      loadWorkerConfig({
        MONGODB_URI: "mongodb://database",
        WORKER_OUTBOX_LEASE_MS: "0",
      }),
    ).toThrow("WORKER_OUTBOX_LEASE_MS must be a positive integer");
  });
});
