import { z } from "zod";

export const CapabilityAliasSchema = z.enum([
  "video.cinematic",
  "video.product_fidelity",
  "image.product",
  "presenter.ai_ugc",
  "avatar.enroll",
  "avatar.perform",
  "voice.clone",
  "speech.generate",
  "speech.lip_sync",
  "media.transcribe",
  "media.moderate",
]);

export type CapabilityAlias = z.infer<typeof CapabilityAliasSchema>;

export const CapabilityKindSchema = z.enum([
  "video",
  "image",
  "presenter",
  "avatar",
  "voice",
  "speech",
  "media",
]);

export type CapabilityKind = z.infer<typeof CapabilityKindSchema>;

/**
 * Public capability information. Provider names and provider model IDs are
 * deliberately absent and must never cross the API boundary.
 */
export const PublicCapabilitySchema = z
  .object({
    alias: CapabilityAliasSchema,
    kind: CapabilityKindSchema,
    available: z.boolean(),
  })
  .strict();

export type PublicCapability = z.infer<typeof PublicCapabilitySchema>;

/**
 * Public semantic capabilities. Provider identities stay server-side.
 */
export const VideoModelCapabilitiesSchema = z
  .object({
    durations: z.array(z.number().int().min(1).max(60)),
    minimumDurationSeconds: z.number().int().min(1).max(60),
    maximumDurationSeconds: z.number().int().min(1).max(60),
  })
  .strict();

export type VideoModelCapabilities = z.infer<typeof VideoModelCapabilitiesSchema>;

export const VideoCapabilitiesResponseSchema = z
  .object({
    active: VideoModelCapabilitiesSchema,
    templateReady: z.boolean(),
    evaluatedAt: z.string(),
  })
  .strict();

export type VideoCapabilitiesResponse = z.infer<typeof VideoCapabilitiesResponseSchema>;
