import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkerHeartbeat } from "./service-heartbeat.js";

afterEach(() => vi.useRealTimers());

describe("WorkerHeartbeat", () => {
  it("publishes ready heartbeats and marks the instance stopping", async () => {
    vi.useFakeTimers();
    const beat = vi.fn(async () => undefined);
    const heartbeat = new WorkerHeartbeat({
      repository: { beat, findFreshReady: vi.fn(), remove: vi.fn() },
      serviceName: "movprompt-worker",
      instanceId: "worker-1",
      intervalSeconds: 15,
      metadata: { generationReady: true },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    await heartbeat.start();
    expect(beat).toHaveBeenLastCalledWith(expect.objectContaining({ status: "ready" }));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(beat).toHaveBeenCalledTimes(2);
    await heartbeat.stop();
    expect(beat).toHaveBeenLastCalledWith(expect.objectContaining({ status: "stopping" }));
  });
});
