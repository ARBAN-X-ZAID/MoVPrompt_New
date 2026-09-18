import { z } from "zod";

import { CapabilityAliasSchema } from "./capabilities.js";
import { MongoObjectIdSchema, RequestIdSchema } from "./api.js";

const EntityIdSchema = MongoObjectIdSchema.or(z.uuid());

const JsonPrimitiveSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);

export type JsonValue =
  | z.infer<typeof JsonPrimitiveSchema>
  | JsonValue[]
  | { [key: string]: JsonValue };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([JsonPrimitiveSchema, z.array(JsonValueSchema), z.record(z.string(), JsonValueSchema)]),
);

export const GenerationConfigurationSchema = z
  .object({
    prompt: z.string().trim().min(1).max(8_000),
    durationSeconds: z.number().int().min(1).max(60).optional(),
    aspectRatio: z.enum(["9:16", "1:1", "4:5", "16:9"]).optional(),
    resolution: z.enum(["480p", "720p"]).default("720p"),
    audio: z.boolean().default(true),
    references: z
      .array(
        z
          .object({
            objectKey: z.string().trim().min(1).max(1_024),
            mimeType: z.string().trim().min(1).max(255),
          })
          .strict(),
      )
      .max(12)
      .default([]),
  })
  .catchall(JsonValueSchema);

export type GenerationConfiguration = z.infer<typeof GenerationConfigurationSchema>;

export const CreateGenerationQuoteRequestSchema = z
  .object({
    /**
     * Template quotes resolve their capability from the published immutable
     * template policy. This remains optional only for Advanced versions that
     * do not use a template, where the server validates it separately.
     */
    capability: CapabilityAliasSchema.optional(),
    templateVersionId: EntityIdSchema.optional(),
    projectVersionId: EntityIdSchema.optional(),
    configuration: GenerationConfigurationSchema.optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const authoritativeProjectQuote = input.projectVersionId !== undefined;
    const guestConfigurationQuote = input.configuration !== undefined;
    if (authoritativeProjectQuote === guestConfigurationQuote) {
      context.addIssue({
        code: "custom",
        message: "Provide either projectVersionId or configuration, but not both.",
        path: ["projectVersionId"],
      });
    }
    if (authoritativeProjectQuote && input.templateVersionId !== undefined) {
      context.addIssue({
        code: "custom",
        message: "Template version is resolved from the owned project version.",
        path: ["templateVersionId"],
      });
    }
  });

export type CreateGenerationQuoteRequest = z.infer<typeof CreateGenerationQuoteRequestSchema>;

export const GenerationQuoteBreakdownItemSchema = z
  .object({
    label: z.string().trim().min(1).max(200),
    credits: z.number().int().nonnegative(),
  })
  .strict();

export const GenerationQuoteSchema = z
  .object({
    quoteId: EntityIdSchema.nullable(),
    capability: CapabilityAliasSchema,
    credits: z.number().int().nonnegative(),
    entitlementEligible: z.boolean(),
    configurationHash: z.string().regex(/^[0-9a-f]{64}$/),
    pricingVersion: z.string().trim().min(1).max(100),
    expiresAt: z.iso.datetime(),
    breakdown: z.array(GenerationQuoteBreakdownItemSchema).min(1),
    estimateOnly: z.boolean(),
  })
  .strict();

export const GenerationQuoteResponseSchema = z
  .object({
    quote: GenerationQuoteSchema,
    requestId: RequestIdSchema,
  })
  .strict();

export type GenerationQuoteResponse = z.infer<typeof GenerationQuoteResponseSchema>;

export const StartRenderRunRequestSchema = z
  .object({
    projectId: EntityIdSchema,
    projectVersionId: EntityIdSchema,
    quoteId: EntityIdSchema,
    rightsAttested: z.literal(true),
  })
  .strict();

export type StartRenderRunRequest = z.infer<typeof StartRenderRunRequestSchema>;

export const RenderRunParametersSchema = z.object({ id: EntityIdSchema }).strict();

export const CancelRenderRunRequestSchema = z.object({}).strict();

export const RetryRenderOutputRequestSchema = z.object({}).strict();

export const RenderRunStatusSchema = z.enum([
  "submitting",
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelling",
  "cancelled",
]);

export const RenderProcessingStageSchema = z.enum([
  "preparing",
  "rendering",
  "securing_output",
  "quality_review",
  "ready",
  "cancelling",
  "failed",
  "cancelled",
]);

export type RenderProcessingStage = z.infer<typeof RenderProcessingStageSchema>;

export const PublicRenderRunSchema = z
  .object({
    id: EntityIdSchema,
    projectId: EntityIdSchema,
    projectVersionId: EntityIdSchema,
    capability: CapabilityAliasSchema,
    quoteId: EntityIdSchema,
    quotedCredits: z.number().int().nonnegative(),
    chargedCredits: z.number().int().nonnegative(),
    starterEntitlementUsed: z.boolean(),
    status: RenderRunStatusSchema,
    processingStage: RenderProcessingStageSchema,
    outputAvailable: z.boolean(),
    error: z
      .object({
        code: z.string().trim().min(1),
        message: z.string().trim().min(1).optional(),
      })
      .strict()
      .nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
  })
  .strict();

export type PublicRenderRun = z.infer<typeof PublicRenderRunSchema>;

export const RenderRunResponseSchema = z
  .object({
    run: PublicRenderRunSchema,
    requestId: RequestIdSchema,
  })
  .strict();

export type RenderRunResponse = z.infer<typeof RenderRunResponseSchema>;

export const RenderRunListQuerySchema = z
  .object({
    projectId: EntityIdSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const RenderRunListResponseSchema = z
  .object({
    runs: z.array(PublicRenderRunSchema),
    requestId: RequestIdSchema,
  })
  .strict();

export type RenderRunListResponse = z.infer<typeof RenderRunListResponseSchema>;
