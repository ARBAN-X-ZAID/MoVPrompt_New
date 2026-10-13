import { describe, expect, it, vi } from "vitest";
import { WORKER_JOB_NAMES } from "@movprompt/contracts";
import { claimableWorkerJobFilter, MongoWorker } from "./mongo-worker.js";
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

  it("claims a queued job or an active job whose lease has expired", () => {
    const now = new Date("2026-10-13T05:40:00.000Z");
    expect(claimableWorkerJobFilter(now)).toEqual({
      startAfter: { $lte: now },
      $or: [
        { status: "queued", leaseExpiresAt: null },
        { status: "queued", leaseExpiresAt: { $lte: now } },
        { status: "active", leaseExpiresAt: { $lte: now } },
      ],
    });
  });

  it("renews the lease until the running handler finishes", async () => {
    vi.useFakeTimers();
    try {
      let release = () => undefined as void;
      const running = new Promise<void>((resolve) => { release = resolve; });
      let claimed = false;
      const renewals: Array<Record<string, unknown>> = [];
      const findOneAndUpdate = vi.fn(async () => {
        if (claimed) return null;
        claimed = true;
        return {
          id: "job-1",
          name: WORKER_JOB_NAMES.health,
          data: { requestedAt: "2026-10-13T05:00:00.000Z", requestId: "request-1" },
          status: "active",
          retryCount: 0,
          retryLimit: 0,
        };
      });
      const updateOne = vi.fn(async (filter: Record<string, unknown>, update: Record<string, unknown>) => {
        renewals.push({ filter, update });
      });
      const database = {
        connect: async () => undefined,
        collection: () => ({ findOneAndUpdate, updateOne }),
        transaction: async (fn: (session: unknown) => Promise<unknown>) => fn({}),
      } as unknown as MongoDatabase;
      const worker = new MongoWorker({
        database,
        config: loadWorkerConfig({ MONGODB_URI: "mongodb://localhost", WORKER_ID: "test-worker" }),
        handlers: {
          health: {
            handle: async () => {
              await running;
              return { status: "ok", workerId: "test-worker", requestId: "request-1", completedAt: "2026-10-13T05:01:00.000Z" };
            },
          },
        },
      });
      const started = worker.start();
      await vi.advanceTimersByTimeAsync(250);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(updateOne).toHaveBeenCalledWith(
        { id: "job-1", status: "active", leaseOwner: "test-worker" },
        expect.objectContaining({ $set: expect.objectContaining({ leaseExpiresAt: expect.any(Date) }) }),
      );
      release();
      await vi.advanceTimersByTimeAsync(0);
      await started;
      await worker.stop();
      expect(renewals.some((entry) => (entry.update.$set as { status?: string } | undefined)?.status === "completed")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
