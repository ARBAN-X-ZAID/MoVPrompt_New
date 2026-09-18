import { z } from "zod";
import { CapabilityAliasSchema } from "./capabilities.js";

export const WORKER_JOB_NAMES = {
  health: "worker.health.v1",
  generation: "generation.render.v1",
  export: "export.render.v1",
} as const;

export type WorkerJobName = (typeof WORKER_JOB_NAMES)[keyof typeof WORKER_JOB_NAMES];

const EntityIdSchema = z.string().min(1).max(128);
const IdempotencyKeySchema = z
  .string()
  .min(8)
  .max(200)
  .regex(/^[A-Za-z0-9._:-]+$/);

export const HealthJobPayloadSchema = z
  .object({
    requestedAt: z.iso.datetime(),
    requestId: z.string().min(8).max(128),
  })
  .strict();

export type HealthJobPayload = z.infer<typeof HealthJobPayloadSchema>;

export const GenerationJobPayloadSchema = z
  .object({
    renderRunId: EntityIdSchema,
    userId: EntityIdSchema,
    projectId: EntityIdSchema,
    projectVersionId: EntityIdSchema,
    quoteId: EntityIdSchema,
    capability: CapabilityAliasSchema,
    idempotencyKey: IdempotencyKeySchema,
    requestId: z.string().min(8).max(128),
  })
  .strict();

export type GenerationJobPayload = z.infer<typeof GenerationJobPayloadSchema>;

export const AspectRatioSchema = z.enum(["9:16", "1:1", "4:5", "16:9"]);
export const ExportResolutionSchema = z.enum(["720p", "1080p"]);

export const ExportJobPayloadSchema = z
  .object({
    exportId: EntityIdSchema,
    userId: EntityIdSchema,
    projectId: EntityIdSchema,
    projectVersionId: EntityIdSchema,
    sourceObjectKey: z.string().min(1).max(1024),
    outputObjectKey: z.string().min(1).max(1024),
    aspectRatio: AspectRatioSchema,
    resolution: ExportResolutionSchema,
    idempotencyKey: IdempotencyKeySchema,
    requestId: z.string().min(8).max(128),
  })
  .strict();

export type ExportJobPayload = z.infer<typeof ExportJobPayloadSchema>;
