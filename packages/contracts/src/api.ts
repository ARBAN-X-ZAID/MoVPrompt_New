import { z } from "zod";
import { PublicCapabilitySchema } from "./capabilities.js";

export const MongoObjectIdSchema = z.string().regex(/^[0-9a-f]{24}$/i);

export const RequestIdSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);

export const IdempotencyKeySchema = z
  .string()
  .min(8)
  .max(200)
  .regex(/^[A-Za-z0-9._:-]+$/);

export const ApiErrorBodySchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
    requestId: RequestIdSchema,
    details: z.unknown().optional(),
  })
  .strict();

export const ApiErrorEnvelopeSchema = z
  .object({
    error: ApiErrorBodySchema,
  })
  .strict();

export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;

export const ServiceHealthSchema = z
  .object({
    service: z.string().min(1),
    status: z.enum(["ok", "degraded", "unavailable"]),
    version: z.string().min(1),
    environment: z.string().min(1),
    timestamp: z.iso.datetime(),
    requestId: RequestIdSchema,
    dependencies: z
      .array(
        z
          .object({
            name: z.string().min(1),
            status: z.enum(["ok", "unavailable"]),
            latencyMs: z.number().nonnegative().optional(),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;

export const ServiceVersionSchema = z
  .object({
    service: z.string().min(1),
    version: z.string().min(1),
    commitSha: z.string().min(1),
    builtAt: z.iso.datetime().nullable(),
    environment: z.string().min(1),
  })
  .strict();

export type ServiceVersion = z.infer<typeof ServiceVersionSchema>;

export const ProductFeatureFlagsSchema = z
  .object({
    authentication: z.boolean(),
    assets: z.boolean(),
    templateMode: z.boolean(),
    advancedMode: z.boolean(),
    generation: z.boolean(),
    exports: z.boolean(),
    billing: z.boolean(),
  })
  .strict();

export type ProductFeatureFlags = z.infer<typeof ProductFeatureFlagsSchema>;

export const FirstCampaignVerificationPolicySchema = z.literal(
  "deferred_until_after_first_campaign",
);

export type FirstCampaignVerificationPolicy = z.infer<
  typeof FirstCampaignVerificationPolicySchema
>;

export const AuthCapabilitySchema = z
  .object({
    emailPassword: z.literal(true),
    configuredProviders: z.array(z.enum(["google", "apple"])),
    firstCampaignVerificationPolicy: FirstCampaignVerificationPolicySchema,
  })
  .strict();

export type AuthCapability = z.infer<typeof AuthCapabilitySchema>;

export const GenerationAvailabilitySchema = z
  .object({
    status: z.enum(["ready", "unavailable"]),
    reason: z
      .enum([
        "disabled",
        "pricing_unavailable",
        "capability_unavailable",
        "worker_unavailable",
        "storage_unavailable",
        "quality_unavailable",
      ])
      .nullable(),
    retryable: z.boolean(),
  })
  .strict();

export type GenerationAvailability = z.infer<typeof GenerationAvailabilitySchema>;

export const FeatureFlagsResponseSchema = z
  .object({
    features: ProductFeatureFlagsSchema,
    auth: AuthCapabilitySchema.nullable(),
    capabilities: z.array(PublicCapabilitySchema),
    generationAvailability: GenerationAvailabilitySchema,
    evaluatedAt: z.iso.datetime(),
  })
  .strict();

export type FeatureFlagsResponse = z.infer<typeof FeatureFlagsResponseSchema>;
