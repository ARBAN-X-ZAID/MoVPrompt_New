import { z } from "zod";
import { MongoObjectIdSchema, RequestIdSchema } from "./api.js";

const EntityIdSchema = MongoObjectIdSchema.or(z.uuid());

export const CreatorAssetKindSchema = z.enum(["product", "logo", "audio", "reference", "footage"]);

export type CreatorAssetKind = z.infer<typeof CreatorAssetKindSchema>;

export const AssetUploadMetadataSchema = z
  .object({
    mimeType: z.string().trim().min(1).max(255),
    sizeBytes: z.number().int().positive().max(50 * 1024 * 1024),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
    originalFilename: z.string().trim().min(1).max(255).optional(),
    width: z.number().int().positive().max(65_535).optional(),
    height: z.number().int().positive().max(65_535).optional(),
    durationMs: z.number().int().positive().max(24 * 60 * 60 * 1000).optional(),
  })
  .strict();

export type AssetUploadMetadata = z.infer<typeof AssetUploadMetadataSchema>;

export const CreateAssetUploadRequestSchema = z
  .object({
    /** A browser-local opaque UUID may be retained as the canonical asset identity during guest claim. */
    assetId: EntityIdSchema.optional(),
    kind: CreatorAssetKindSchema,
    metadata: AssetUploadMetadataSchema,
  })
  .strict()
  .superRefine((request, context) => {
    if (request.kind !== "footage") return;
    const mimeType = request.metadata.mimeType.toLowerCase();
    if (!new Set(["video/mp4", "video/quicktime"]).has(mimeType)) {
      context.addIssue({
        code: "custom",
        path: ["metadata", "mimeType"],
        message: "Footage must be an MP4 or MOV video.",
      });
    }
    if (!request.metadata.durationMs || request.metadata.durationMs > 10 * 60 * 1_000) {
      context.addIssue({
        code: "custom",
        path: ["metadata", "durationMs"],
        message: "Footage must include a duration no longer than ten minutes.",
      });
    }
  });

export type CreateAssetUploadRequest = z.infer<typeof CreateAssetUploadRequestSchema>;

/** The browser identifies a guest-claim checkpoint without ever sending storage coordinates. */
export const CompleteClaimAssetRequestSchema = z
  .object({
    pendingGenerationId: EntityIdSchema,
    localAssetId: EntityIdSchema,
  })
  .strict();

export type CompleteClaimAssetRequest = z.infer<typeof CompleteClaimAssetRequestSchema>;

export const MirrorRemoteImageRequestSchema = z
  .object({
    kind: z.enum(["product", "reference"]),
    url: z.url().max(2_048),
    originalFilename: z.string().trim().min(1).max(255).optional(),
  })
  .strict();

export type MirrorRemoteImageRequest = z.infer<typeof MirrorRemoteImageRequestSchema>;

export const AssetRouteParametersSchema = z
  .object({
    projectId: EntityIdSchema,
    assetId: EntityIdSchema.optional(),
  })
  .strict();

export const AssetDownloadQuerySchema = z
  .object({
    filename: z.string().trim().min(1).max(255).optional(),
  })
  .strict();

export const CreatorAssetSchema = z
  .object({
    id: EntityIdSchema,
    projectId: EntityIdSchema,
    kind: CreatorAssetKindSchema,
    objectKey: z.string().min(1).max(1024),
    mimeType: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
    durationMs: z.number().int().positive().max(10 * 60 * 1_000).optional(),
  })
  .strict();

export type CreatorAsset = z.infer<typeof CreatorAssetSchema>;

export const SignedAssetUploadResponseSchema = z
  .object({
    asset: CreatorAssetSchema,
    upload: z
      .object({
        method: z.literal("PUT"),
        url: z.url(),
        headers: z.record(z.string(), z.string()),
        expiresInSeconds: z.number().int().positive().max(3600),
      })
      .strict(),
    requestId: RequestIdSchema,
  })
  .strict();

export type SignedAssetUploadResponse = z.infer<typeof SignedAssetUploadResponseSchema>;

export const SignedAssetDownloadResponseSchema = z
  .object({
    asset: CreatorAssetSchema,
    download: z
      .object({
        method: z.literal("GET"),
        url: z.url(),
        expiresInSeconds: z.number().int().positive().max(3600),
      })
      .strict(),
    requestId: RequestIdSchema,
  })
  .strict();

export type SignedAssetDownloadResponse = z.infer<typeof SignedAssetDownloadResponseSchema>;

/**
 * A remotely sourced image is usable only after the API has fetched, verified,
 * and copied it into MovPrompt-owned private storage.
 */
export const MirroredAssetResponseSchema = SignedAssetDownloadResponseSchema;

export type MirroredAssetResponse = z.infer<typeof MirroredAssetResponseSchema>;

export const AssetReadyResponseSchema = z
  .object({
    asset: CreatorAssetSchema,
    status: z.literal("ready"),
    requestId: RequestIdSchema,
  })
  .strict();

export type AssetReadyResponse = z.infer<typeof AssetReadyResponseSchema>;
