import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import type { WorkerLogger } from "./logger.js";
import {
  OutboxDispatcher,
  type GenerationQueue,
  type OutboxRepository,
} from "./outbox-dispatcher.js";

const logger: WorkerLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function claimed(payload: unknown, attempts = 1) {
  return {
    id: randomUUID(),
    topic: "render.start",
    payload,
    attempts,
    maxAttempts: 3,
  };
}

function validPayload() {
  return {
    runId: randomUUID(),
    userId: randomUUID(),
    projectId: randomUUID(),
    projectVersionId: randomUUID(),
    quoteId: randomUUID(),
    capabilityAlias: "video.cinematic",
    configurationHash: "a".repeat(64),
  };
}

function setup(job: ReturnType<typeof claimed>, enqueue = vi.fn(async () => "mongodb-job")) {
  const repository: OutboxRepository = {
    claimRenderStartJobs: vi.fn(async () => [job]),
    complete: vi.fn(async () => true),
    fail: vi.fn(async () => true),
  };
  const queue: GenerationQueue = { enqueueGeneration: enqueue };
  const dispatcher = new OutboxDispatcher({
    repository,
    queue,
    workerId: "worker-1",
    logger,
    now: () => new Date("2026-08-12T12:00:00.000Z"),
  });
  return { dispatcher, repository, enqueue };
}

describe("render outbox dispatcher", () => {
  it("bridges one claimed outbox row into the MongoDB generation queue", async () => {
    const job = claimed(validPayload());
    const { dispatcher, repository, enqueue } = setup(job);

    expect(await dispatcher.dispatchOnce()).toBe(1);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        renderRunId: (job.payload as ReturnType<typeof validPayload>).runId,
        idempotencyKey: `render.start:${(job.payload as ReturnType<typeof validPayload>).runId}`,
        requestId: job.id,
      }),
      { singletonKey: `submit:${(job.payload as ReturnType<typeof validPayload>).runId}:0` },
    );
    expect(repository.complete).toHaveBeenCalledWith(
      job.id,
      "worker-1",
      new Date("2026-08-12T12:00:00.000Z"),
    );
    expect(repository.fail).not.toHaveBeenCalled();
  });

  it("dead-letters malformed payloads without putting them on the MongoDB queue", async () => {
    const job = claimed({ runId: "not-a-uuid" });
    const { dispatcher, repository, enqueue } = setup(job);

    await dispatcher.dispatchOnce();
    expect(enqueue).not.toHaveBeenCalled();
    expect(repository.fail).toHaveBeenCalledWith(
      expect.objectContaining({ job, permanent: true, workerId: "worker-1" }),
    );
  });

  it("returns queue failures to the durable outbox retry schedule", async () => {
    const job = claimed(validPayload(), 2);
    const enqueue = vi.fn(async () => {
      throw new Error("MongoDB queue unavailable");
    });
    const { dispatcher, repository } = setup(job, enqueue);

    await dispatcher.dispatchOnce();
    expect(repository.complete).not.toHaveBeenCalled();
    expect(repository.fail).toHaveBeenCalledWith(
      expect.objectContaining({
        job,
        permanent: false,
        error: "MongoDB queue unavailable",
        retryAt: new Date("2026-08-12T12:00:10.000Z"),
      }),
    );
  });
});
