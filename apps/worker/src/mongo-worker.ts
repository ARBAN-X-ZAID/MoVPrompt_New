import { ExportJobPayloadSchema, GenerationJobPayloadSchema, HealthJobPayloadSchema, WORKER_JOB_NAMES, type WorkerJobName } from "@movprompt/contracts";
import { COLLECTIONS, newMongoObjectId, type MongoDatabase } from "@movprompt/db";
import type { Document } from "mongodb";
import type { WorkerConfig } from "./config.js";
import type { WorkerHandlers, WorkerJobContext } from "./handlers.js";
import { jsonWorkerLogger, type WorkerLogger } from "./logger.js";

const ABANDONED_CLAIM_CLEANUP_JOB = "abandoned-claim-cleanup.v1";

export class MongoWorker {
  readonly #database: MongoDatabase;
  readonly #config: WorkerConfig;
  readonly #handlers: WorkerHandlers;
  readonly #cleanup: { cleanOne(input: { jobId: string; workerId: string; requestId: string }): Promise<unknown> } | undefined;
  readonly #logger: WorkerLogger;
  #timer: ReturnType<typeof setInterval> | undefined;
  #cleanupTimer: ReturnType<typeof setInterval> | undefined;
  #running = false;
  #inFlight: Promise<void> | undefined;

  constructor(options: { database: MongoDatabase; config: WorkerConfig; handlers: WorkerHandlers; abandonedClaimCleanup?: { cleanOne(input: { jobId: string; workerId: string; requestId: string }): Promise<unknown> }; logger?: WorkerLogger }) {
    this.#database = options.database; this.#config = options.config; this.#handlers = options.handlers; this.#cleanup = options.abandonedClaimCleanup; this.#logger = options.logger ?? jsonWorkerLogger;
  }

  async start(): Promise<void> {
    if (this.#running) return; await this.#database.connect(); this.#running = true;
    this.#timer = setInterval(() => { if (!this.#inFlight) this.#inFlight = this.#workOne().finally(() => { this.#inFlight = undefined; }); }, 250); this.#timer.unref?.();
    if (this.#cleanup) { this.#cleanupTimer = setInterval(() => void this.#enqueueCleanup(), 15 * 60 * 1_000); this.#cleanupTimer.unref?.(); await this.#enqueueCleanup(); }
    this.#logger.info("worker_started", { workerId: this.#config.workerId, database: "mongodb", generationHandler: Boolean(this.#handlers.generation), exportHandler: Boolean(this.#handlers.export), abandonedClaimCleanup: Boolean(this.#cleanup) });
  }

  async stop(): Promise<void> { this.#running = false; if (this.#timer) clearInterval(this.#timer); if (this.#cleanupTimer) clearInterval(this.#cleanupTimer); await this.#inFlight; this.#logger.info("worker_stopped", { workerId: this.#config.workerId }); }

  async enqueueHealthCheck(requestId: string): Promise<string> {
    return this.#enqueue(WORKER_JOB_NAMES.health, HealthJobPayloadSchema.parse({ requestedAt: new Date().toISOString(), requestId }), {});
  }

  async enqueueGeneration(payload: unknown, options: { singletonKey?: string; delaySeconds?: number; singletonNextSlot?: boolean } = {}): Promise<string | null> {
    try { return await this.#enqueue(WORKER_JOB_NAMES.generation, GenerationJobPayloadSchema.parse(payload), options); }
    catch (error) { if ((error as { code?: number }).code === 11000) return null; throw error; }
  }

  async #enqueue(name: string, data: object, options: { singletonKey?: string; delaySeconds?: number; singletonNextSlot?: boolean }): Promise<string> {
    const id = newMongoObjectId(); const now = new Date();
    const jobs = this.#database.collection(COLLECTIONS.workerJobs);
    const document = { id, name, data, status: "queued", retryCount: 0, retryLimit: name === WORKER_JOB_NAMES.generation ? 5 : 0, startAfter: new Date(now.getTime() + (options.delaySeconds ?? 0) * 1_000), ...(options.singletonKey ? { singletonKey: options.singletonKey } : {}), leaseOwner: null, leaseExpiresAt: null, createdAt: now, updatedAt: now };
    if (options.singletonNextSlot && options.singletonKey) {
      // An active poll may schedule its successor. Transfer the unique key
      // atomically; duplicate callers still cannot create two queued polls.
      await this.#database.transaction(async session => {
        await jobs.updateOne({ name, singletonKey: options.singletonKey, status: "active", leaseOwner: this.#config.workerId }, { $unset: { singletonKey: "" } }, { session });
        await jobs.insertOne(document, { session });
      });
    } else await jobs.insertOne(document);
    return id;
  }

  async #enqueueCleanup() { if (!this.#cleanup) return; await this.#enqueue(ABANDONED_CLAIM_CLEANUP_JOB, { requestId: "scheduled" }, {}).catch(() => undefined); }

  async #workOne(): Promise<void> {
    if (!this.#running) return; const now = new Date(); const jobs = this.#database.collection(COLLECTIONS.workerJobs);
    const job = await jobs.findOneAndUpdate({ status: "queued", startAfter: { $lte: now }, $or: [{ leaseExpiresAt: null }, { leaseExpiresAt: { $lte: now } }] }, { $set: { status: "active", leaseOwner: this.#config.workerId, leaseExpiresAt: new Date(now.getTime() + 120_000), updatedAt: now } }, { sort: { startAfter: 1, createdAt: 1 }, returnDocument: "after" });
    if (!job) return;
    this.#logger.info("worker_job_picked", { jobId: String(job.id), jobName: String(job.name), workerId: this.#config.workerId, renderRunId: job.data?.renderRunId, requestId: job.data?.requestId, retryCount: job.retryCount });
    try { await this.#handle(job); await jobs.updateOne({ id: job.id, leaseOwner: this.#config.workerId }, { $set: { status: "completed", completedAt: new Date(), leaseOwner: null, leaseExpiresAt: null, updatedAt: new Date() }, $unset: { singletonKey: "" } }); }
    catch (error) {
      const retryCount = Number(job.retryCount ?? 0) + 1; const retryLimit = Number(job.retryLimit ?? 0); const retry = retryCount <= retryLimit;
      await jobs.updateOne({ id: job.id, leaseOwner: this.#config.workerId }, { $set: { status: retry ? "queued" : "failed", retryCount, startAfter: new Date(Date.now() + Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, retryCount - 1))), leaseOwner: null, leaseExpiresAt: null, ...(retry ? {} : { failedAt: new Date() }), error: error instanceof Error ? error.message : String(error), updatedAt: new Date() }, ...(retry ? {} : { $unset: { singletonKey: "" } }) });
      this.#logger.error("worker_job_failed", { jobId: String(job.id), jobName: String(job.name), workerId: this.#config.workerId, renderRunId: job.data?.renderRunId, requestId: job.data?.requestId, errorCode: typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : "worker_handler_failed", retryCount, retry, nextRetryAt: retry ? new Date(Date.now() + Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, retryCount - 1))).toISOString() : null });
    }
  }

  async #handle(job: Document) {
    if (job.name === ABANDONED_CLAIM_CLEANUP_JOB && this.#cleanup) return this.#cleanup.cleanOne({ jobId: String(job.id), workerId: this.#config.workerId, requestId: typeof job.data?.requestId === "string" ? job.data.requestId : String(job.id) });
    const handlers = { [WORKER_JOB_NAMES.health]: { schema: HealthJobPayloadSchema, handler: this.#handlers.health }, ...(this.#handlers.generation ? { [WORKER_JOB_NAMES.generation]: { schema: GenerationJobPayloadSchema, handler: this.#handlers.generation } } : {}), ...(this.#handlers.export ? { [WORKER_JOB_NAMES.export]: { schema: ExportJobPayloadSchema, handler: this.#handlers.export } } : {}) };
    const selected = handlers[job.name as WorkerJobName]; if (!selected) throw new Error("worker_job_handler_missing");
    const context: WorkerJobContext = { jobId: String(job.id), jobName: job.name as WorkerJobName, workerId: this.#config.workerId, retryCount: Number(job.retryCount ?? 0), retryLimit: Number(job.retryLimit ?? 0), signal: new AbortController().signal, logger: this.#logger };
    return selected.handler.handle(selected.schema.parse(job.data) as never, context);
  }
}
