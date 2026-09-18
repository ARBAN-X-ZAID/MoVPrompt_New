import type { JsonObject, ServiceHeartbeatRepository } from "@movprompt/db";

import type { WorkerLogger } from "./logger.js";

export class WorkerHeartbeat {
  readonly #repository: ServiceHeartbeatRepository;
  readonly #serviceName: string;
  readonly #instanceId: string;
  readonly #intervalMs: number;
  readonly #metadata: JsonObject;
  readonly #logger: WorkerLogger;
  #timer: ReturnType<typeof setInterval> | undefined;
  #inFlight: Promise<void> | undefined;

  constructor(options: {
    repository: ServiceHeartbeatRepository;
    serviceName: string;
    instanceId: string;
    intervalSeconds: number;
    metadata: JsonObject;
    logger: WorkerLogger;
  }) {
    if (!Number.isSafeInteger(options.intervalSeconds) || options.intervalSeconds < 1) {
      throw new Error("worker_heartbeat_interval_invalid");
    }
    this.#repository = options.repository;
    this.#serviceName = options.serviceName;
    this.#instanceId = options.instanceId;
    this.#intervalMs = options.intervalSeconds * 1_000;
    this.#metadata = options.metadata;
    this.#logger = options.logger;
  }

  async start(): Promise<void> {
    if (this.#timer) return;
    await this.#beat("ready");
    this.#timer = setInterval(() => {
      if (this.#inFlight) return;
      this.#inFlight = this.#beat("ready")
        .catch((error) => {
          this.#logger.error("worker_heartbeat_failed", {
            workerId: this.#instanceId,
            error: error instanceof Error ? error.message : String(error),
          });
        })
        .finally(() => {
          this.#inFlight = undefined;
        });
    }, this.#intervalMs);
    this.#timer.unref?.();
  }

  async stop(): Promise<void> {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
    await this.#inFlight;
    await this.#beat("stopping");
  }

  async #beat(status: "ready" | "stopping"): Promise<void> {
    await this.#repository.beat({
      serviceName: this.#serviceName,
      instanceId: this.#instanceId,
      status,
      metadata: this.#metadata,
    });
  }
}
