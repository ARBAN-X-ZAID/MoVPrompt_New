import { describe, expect, it, vi } from "vitest";
import { MongoWorker } from "./mongo-worker.js";
import { loadWorkerConfig } from "./config.js";
import { createHealthJobHandler } from "./handlers.js";
import type { MongoDatabase } from "@movprompt/db";

describe("MongoDB reconciliation successor", () => {
  it("atomically moves an active singleton to one queued follow-up", async () => {
    const session = {};
    let activeKey: string | undefined = "reconcile:111111111111111111111111";
    let queuedKey: string | undefined;
    const insertOne = vi.fn(async (job, options) => {
      if (activeKey === job.singletonKey || queuedKey === job.singletonKey) throw Object.assign(new Error("duplicate"), { code: 11000 });
      expect(options?.session).toBe(session);
      queuedKey = job.singletonKey;
    });
    const updateOne = vi.fn(async (filter, _update, options) => {
      expect(filter).toMatchObject({ status: "active", leaseOwner: "test-worker" });
      expect(options.session).toBe(session);
      activeKey = undefined;
    });
    const database = { collection: () => ({ insertOne, updateOne }), transaction: vi.fn(async fn => fn(session)) } as unknown as MongoDatabase;
    const worker = new MongoWorker({ database, config: loadWorkerConfig({ MONGODB_URI: "mongodb://localhost", WORKER_ID: "test-worker" }), handlers: { health: createHealthJobHandler() } });
    const payload = { renderRunId: "111111111111111111111111", userId: "222222222222222222222222", projectId: "333333333333333333333333", projectVersionId: "444444444444444444444444", quoteId: "555555555555555555555555", capability: "video.product_fidelity", idempotencyKey: "existing-run", requestId: "test-request" };
    const options = { singletonKey: activeKey, singletonNextSlot: true, delaySeconds: 15 };
    expect(await worker.enqueueGeneration(payload, options)).not.toBeNull();
    expect(await worker.enqueueGeneration(payload, options)).toBeNull();
    expect(database.transaction).toHaveBeenCalledTimes(2);
    expect(queuedKey).toBe(options.singletonKey);
  });
});
