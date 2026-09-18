import { describe, expect, it, vi } from "vitest";
import { WORKER_JOB_NAMES } from "@movprompt/contracts";
import { createHealthJobHandler } from "./handlers.js";
import type { WorkerLogger } from "./logger.js";

describe("worker handler contracts", () => {
  it("returns a traceable health result", async () => {
    const logger: WorkerLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const handler = createHealthJobHandler(() => new Date("2026-08-12T08:00:00.000Z"));
    const result = await handler.handle(
      {
        requestedAt: "2026-08-12T07:59:59.000Z",
        requestId: "request-1234",
      },
      {
        jobId: "job-1",
        jobName: WORKER_JOB_NAMES.health,
        workerId: "worker-1",
        retryCount: 0,
        retryLimit: 0,
        signal: new AbortController().signal,
        logger,
      },
    );

    expect(result).toEqual({
      status: "ok",
      workerId: "worker-1",
      requestId: "request-1234",
      completedAt: "2026-08-12T08:00:00.000Z",
    });
    expect(logger.info).toHaveBeenCalledWith("worker_health_job_completed", {
      jobId: "job-1",
      requestId: "request-1234",
    });
  });
});
