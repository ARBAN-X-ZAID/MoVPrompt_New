import type {
  ExportJobPayload,
  GenerationJobPayload,
  HealthJobPayload,
  WorkerJobName,
} from "@movprompt/contracts";
import type { WorkerLogger } from "./logger.js";

export type WorkerJobContext = {
  jobId: string;
  jobName: WorkerJobName;
  workerId: string;
  retryCount: number;
  retryLimit: number;
  signal: AbortSignal;
  logger: WorkerLogger;
};

export type HealthJobResult = {
  status: "ok";
  workerId: string;
  requestId: string;
  completedAt: string;
};

export type GenerationJobResult = {
  renderRunId: string;
  outcome: "accepted" | "reconciled";
};

export type ExportJobResult = {
  exportId: string;
  outputObjectKey: string;
  checksum?: string;
};

export interface HealthJobHandler {
  handle(payload: HealthJobPayload, context: WorkerJobContext): Promise<HealthJobResult>;
}

export interface GenerationJobHandler {
  handle(payload: GenerationJobPayload, context: WorkerJobContext): Promise<GenerationJobResult>;
}

export interface ExportJobHandler {
  handle(payload: ExportJobPayload, context: WorkerJobContext): Promise<ExportJobResult>;
}

export type WorkerHandlers = {
  health: HealthJobHandler;
  generation?: GenerationJobHandler;
  export?: ExportJobHandler;
};

export function createHealthJobHandler(now: () => Date = () => new Date()): HealthJobHandler {
  return {
    async handle(payload, context) {
      context.logger.info("worker_health_job_completed", {
        jobId: context.jobId,
        requestId: payload.requestId,
      });

      return {
        status: "ok",
        workerId: context.workerId,
        requestId: payload.requestId,
        completedAt: now().toISOString(),
      };
    },
  };
}
