import { z } from "zod";

const id = z.string().regex(/^[0-9a-f]{24}$/i).or(z.uuid());
const checksum = z.string().regex(/^[a-f0-9]{64}$/);
export const LibraryKindSchema = z.enum(["product", "presenter"]);
export type LibraryKind = z.infer<typeof LibraryKindSchema>;
export const LibrarySourceSchema = z.object({
  entryId: id, photoId: id, revision: z.number().int().positive(), kind: LibraryKindSchema,
  sizeBytes: z.number().int().positive().max(12 * 1024 * 1024),
}).strict();
export type LibrarySource = z.infer<typeof LibrarySourceSchema>;
export const LibraryPhotoSchema = z.object({
  id, name: z.string().trim().min(1).max(240), checksumSha256: checksum,
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(12 * 1024 * 1024),
  width: z.number().int().positive(), height: z.number().int().positive(),
}).strict();
export type LibraryPhoto = z.infer<typeof LibraryPhotoSchema>;
export const LibraryApprovalSchema = z.object({
  policyVersion: z.literal("2026-10-17"), revision: z.number().int().positive(),
  approved: z.boolean(), reviewedAt: z.iso.datetime().nullable(),
  sameSubjectConfirmed: z.boolean(), rightsConfirmed: z.boolean(), adultConfirmed: z.boolean(),
}).strict();
export type LibraryApproval = z.infer<typeof LibraryApprovalSchema>;
export const LibraryEntrySchema = z.object({
  id, kind: LibraryKindSchema, name: z.string().trim().min(1).max(120), revision: z.number().int().positive(),
  photos: z.array(LibraryPhotoSchema).min(1).max(3), approved: z.boolean(), deleted: z.boolean(),
  approval: LibraryApprovalSchema,
  reviewedAt: z.iso.datetime().nullable(), updatedAt: z.iso.datetime(),
}).strict().superRefine((entry, context) => {
  if (entry.approval.revision !== entry.revision || entry.approval.approved !== entry.approved || entry.approval.reviewedAt !== entry.reviewedAt ||
    (entry.approved && (!entry.reviewedAt || !entry.approval.rightsConfirmed || !entry.approval.sameSubjectConfirmed || (entry.kind === "presenter" && !entry.approval.adultConfirmed))) || (entry.deleted && entry.approved)) context.addIssue({ code: "custom", message: "Approval must belong to this exact saved revision." });
});
export const LibraryRevisionSchema = z.object({ entryId: id, revision: z.number().int().positive(), entry: LibraryEntrySchema }).strict().refine(value => value.entry.id === value.entryId && value.entry.revision === value.revision, "The revision must match its saved entry.");
export type LibraryRevision = z.infer<typeof LibraryRevisionSchema>;
export type LibraryEntry = z.infer<typeof LibraryEntrySchema>;
export const LibraryUploadRequestSchema = z.object({
  name: z.string().trim().min(1).max(240), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(12 * 1024 * 1024), checksumSha256: checksum,
}).strict();
export const SaveLibraryEntrySchema = z.object({
  id: id.optional(), expectedRevision: z.number().int().positive().optional(), kind: LibraryKindSchema,
  name: z.string().trim().min(1).max(120), approved: z.boolean(),
  photos: z.array(z.object({
    id, uploadId: id.optional(),
    projectSource: z.object({ projectId: id, assetId: id }).strict().optional(),
  }).strict().refine(photo => !(photo.uploadId && photo.projectSource), "Choose one photo source.")).min(1).max(3),
}).strict().superRefine((value, context) => {
  if (Boolean(value.id) !== Boolean(value.expectedRevision)) context.addIssue({ code: "custom", message: "An update needs its current revision." });
  if (new Set(value.photos.map(photo => photo.id)).size !== value.photos.length) context.addIssue({ code: "custom", message: "A photo may appear once." });
});
export type SaveLibraryEntry = z.infer<typeof SaveLibraryEntrySchema>;
export const LibraryEntryResponseSchema = z.object({ entry: LibraryEntrySchema, requestId: z.string() });
export const LibraryListResponseSchema = z.object({ entries: z.array(LibraryEntrySchema), nextCursor: z.string().nullable(), requestId: z.string() });
export const LibraryUploadResponseSchema = z.object({ uploadId: id, upload: z.object({ url: z.url(), headers: z.record(z.string(), z.string()) }), requestId: z.string() });

export const AutoSaveLibraryPhotoSchema = z.object({ kind: LibraryKindSchema, uploadId: id }).strict();
export const LibrarySaveReceiptSchema = z.object({ entryId: id, photoId: id, revision: z.number().int().positive(), checksumSha256: checksum, kind: LibraryKindSchema }).strict();
export type LibrarySaveReceipt = z.infer<typeof LibrarySaveReceiptSchema>;
export const LibrarySaveStatusSchema = z.enum(["device", "pending", "saving", "saved", "failed"]);
export const DeviceLibraryRecordSchema = z.object({
  id: z.string().min(1), ownerId: z.string().nullable(), kind: LibraryKindSchema,
  name: z.string().min(1).max(240), mimeType: LibraryPhotoSchema.shape.mimeType,
  sizeBytes: LibraryPhotoSchema.shape.sizeBytes, checksumSha256: checksum,
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), approved: z.boolean(),
  status: LibrarySaveStatusSchema, operationKey: z.uuid(), receipt: LibrarySaveReceiptSchema.optional(),
}).strict();
export type DeviceLibraryRecord = z.infer<typeof DeviceLibraryRecordSchema>;
