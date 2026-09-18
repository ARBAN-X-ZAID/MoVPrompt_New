import { CapabilityAliasSchema, MongoObjectIdSchema, WORKER_JOB_NAMES, type GenerationJobPayload } from "@movprompt/contracts";
import { COLLECTIONS, type MongoDatabase } from "@movprompt/db";
import { z } from "zod";

import type { WorkerLogger } from "./logger.js";

const RenderStartOutboxPayloadSchema = z
  .object({
    runId: MongoObjectIdSchema.or(z.uuid()),
    userId: MongoObjectIdSchema.or(z.uuid()),
    projectId: MongoObjectIdSchema.or(z.uuid()),
    projectVersionId: MongoObjectIdSchema.or(z.uuid()),
    quoteId: MongoObjectIdSchema.or(z.uuid()),
    capabilityAlias: CapabilityAliasSchema,
    configurationHash: z.string().regex(/^[a-f0-9]{64}$/),
    qualityAttempt: z.number().int().min(0).max(3).optional(),
  })
  .strict();

type ClaimedOutboxJob = {
  id: string;
  topic: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
};

export interface GenerationQueue {
  enqueueGeneration(
    payload: GenerationJobPayload,
    options?: { singletonKey?: string; delaySeconds?: number; singletonNextSlot?: boolean },
  ): Promise<string | null>;
}

export interface OutboxRepository {
  claimRenderStartJobs(input: {
    workerId: string;
    batchSize: number;
    leaseMs: number;
    now: Date;
  }): Promise<ClaimedOutboxJob[]>;
  complete(jobId: string, workerId: string, now: Date): Promise<boolean>;
  fail(input: {
    job: ClaimedOutboxJob;
    workerId: string;
    error: string;
    permanent: boolean;
    retryAt: Date;
    now: Date;
  }): Promise<boolean>;
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label}_must_be_positive`);
  return value;
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 2_000);
}

function retryDelayMs(attempt: number): number {
  return Math.min(15 * 60_000, 5_000 * 2 ** Math.min(8, Math.max(0, attempt - 1)));
}

export function createMongoOutboxRepository(database: MongoDatabase): OutboxRepository {
  const jobs = database.collection(COLLECTIONS.outboxJobs);
  return {
    async claimRenderStartJobs(input) {
      positiveInteger(input.batchSize, "outbox_batch_size");
      positiveInteger(input.leaseMs, "outbox_lease_ms");
      const leaseCutoff = new Date(input.now.getTime() - input.leaseMs);
      await jobs.updateMany(
        { topic: "render.start", status: "processing", lockedAt: { $lt: leaseCutoff }, $expr: { $gte: ["$attempts", "$maxAttempts"] } },
        { $set: { status: "dead", lockedAt: null, lockedBy: null, lastError: "outbox_lease_exhausted", updatedAt: input.now } },
      );
      const claimed: ClaimedOutboxJob[] = [];
      for (let index = 0; index < input.batchSize; index += 1) {
        const row = await jobs.findOneAndUpdate(
          { topic: "render.start", $expr: { $lt: ["$attempts", { $ifNull: ["$maxAttempts", 10] }] }, $or: [{ status: { $in: ["pending", "failed"] }, availableAt: { $lte: input.now } }, { status: "processing", lockedAt: { $lt: leaseCutoff } }] },
          { $set: { status: "processing", lockedAt: input.now, lockedBy: input.workerId, lastError: null, updatedAt: input.now }, $inc: { attempts: 1 } },
          { sort: { availableAt: 1, createdAt: 1 }, returnDocument: "after" },
        );
        if (!row) break;
        claimed.push({ id: String(row.id), topic: String(row.topic), payload: row.payload, attempts: Number(row.attempts), maxAttempts: Number(row.maxAttempts ?? 10) });
      }
      return claimed;
    },
    async complete(jobId, workerId, now) {
      const result = await jobs.updateOne({ id: jobId, status: "processing", lockedBy: workerId }, { $set: { status: "completed", lockedAt: null, lockedBy: null, updatedAt: now } });
      return result.modifiedCount === 1;
    },
    async fail(input) {
      const dead = input.permanent || input.job.attempts >= input.job.maxAttempts;
      const result = await jobs.updateOne({ id: input.job.id, status: "processing", lockedBy: input.workerId }, { $set: { status: dead ? "dead" : "failed", availableAt: input.retryAt, lockedAt: null, lockedBy: null, lastError: input.error, updatedAt: input.now } });
      return result.modifiedCount === 1;
    },
  };
}

export type OutboxDispatcherOptions = {
  repository: OutboxRepository;
  queue: GenerationQueue;
  workerId: string;
  logger: WorkerLogger;
  batchSize?: number;
  leaseMs?: number;
  pollIntervalMs?: number;
  now?: () => Date;
};

export class OutboxDispatcher {
  readonly #repository: OutboxRepository;
  readonly #queue: GenerationQueue;
  readonly #workerId: string;
  readonly #logger: WorkerLogger;
  readonly #batchSize: number;
  readonly #leaseMs: number;
  readonly #pollIntervalMs: number;
  readonly #now: () => Date;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #inFlight: Promise<void> | undefined;
  #running = false;

  constructor(options: OutboxDispatcherOptions) {
    this.#repository = options.repository;
    this.#queue = options.queue;
    this.#workerId = options.workerId;
    this.#logger = options.logger;
    this.#batchSize = positiveInteger(options.batchSize ?? 20, "outbox_batch_size");
    this.#leaseMs = positiveInteger(options.leaseMs ?? 60_000, "outbox_lease_ms");
    this.#pollIntervalMs = positiveInteger(options.pollIntervalMs ?? 1_000, "outbox_poll_interval_ms");
    this.#now = options.now ?? (() => new Date());
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#schedule(0);
  }

  async stop(): Promise<void> {
    this.#running = false;
    if (this.#timer) clearTimeout(this.#timer);
    await this.#inFlight;
  }

  async dispatchOnce(): Promise<number> {
    const claimed = await this.#repository.claimRenderStartJobs({
      workerId: this.#workerId,
      batchSize: this.#batchSize,
      leaseMs: this.#leaseMs,
      now: this.#now(),
    });

    for (const job of claimed) await this.#dispatch(job);
    return claimed.length;
  }

  #schedule(delayMs: number): void {
    this.#timer = setTimeout(() => {
      this.#inFlight = this.dispatchOnce()
        .then((count) => {
          if (count > 0) this.#logger.info("render_outbox_dispatched", { count, workerId: this.#workerId });
        })
        .catch((error) => {
          this.#logger.error("render_outbox_poll_failed", {
            workerId: this.#workerId,
            error: errorMessage(error),
          });
        })
        .finally(() => {
          this.#inFlight = undefined;
          if (this.#running) this.#schedule(this.#pollIntervalMs);
        });
    }, delayMs);
  }

  async #dispatch(job: ClaimedOutboxJob): Promise<void> {
    const parsed = RenderStartOutboxPayloadSchema.safeParse(job.payload);
    if (!parsed.success) {
      await this.#repository.fail({
        job,
        workerId: this.#workerId,
        error: `invalid_render_start_payload:${z.prettifyError(parsed.error)}`.slice(0, 2_000),
        permanent: true,
        retryAt: this.#now(),
        now: this.#now(),
      });
      return;
    }

    const payload: GenerationJobPayload = {
      renderRunId: parsed.data.runId,
      userId: parsed.data.userId,
      projectId: parsed.data.projectId,
      projectVersionId: parsed.data.projectVersionId,
      quoteId: parsed.data.quoteId,
      capability: parsed.data.capabilityAlias,
      idempotencyKey: `render.start:${parsed.data.runId}`,
      requestId: job.id,
    };

    try {
      // A null result means the durable queue already has this singleton. Delivery is
      // therefore satisfied; the render handler is idempotent as a second floor.
      await this.#queue.enqueueGeneration(payload, {
        singletonKey: `submit:${parsed.data.runId}:${parsed.data.qualityAttempt ?? 0}`,
      });
      const completed = await this.#repository.complete(job.id, this.#workerId, this.#now());
      if (!completed) {
        this.#logger.warn("render_outbox_lease_lost_after_enqueue", { outboxJobId: job.id });
      }
    } catch (error) {
      const now = this.#now();
      await this.#repository.fail({
        job,
        workerId: this.#workerId,
        error: errorMessage(error),
        permanent: false,
        retryAt: new Date(now.getTime() + retryDelayMs(job.attempts)),
        now,
      });
    }
  }
}

export const RENDER_START_OUTBOX_TOPIC = "render.start";
export const RENDER_GENERATION_QUEUE = WORKER_JOB_NAMES.generation;
