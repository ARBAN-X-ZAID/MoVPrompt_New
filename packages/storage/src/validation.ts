export const DEFAULT_ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/quicktime",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
]);

export interface UploadMetadata {
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  originalFilename?: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface UploadValidationPolicy {
  allowedMimeTypes?: ReadonlySet<string>;
  maxBytes?: number;
  requireChecksum?: boolean;
}

export interface ValidatedUploadMetadata extends UploadMetadata {
  mimeType: string;
  checksumSha256: string;
}

export function validateUploadMetadata(
  metadata: UploadMetadata,
  policy: UploadValidationPolicy = {},
): ValidatedUploadMetadata {
  const allowedMimeTypes = policy.allowedMimeTypes ?? DEFAULT_ALLOWED_UPLOAD_MIME_TYPES;
  const maxBytes = policy.maxBytes ?? 50 * 1024 * 1024;
  const mimeType = metadata.mimeType.trim().toLowerCase();
  const checksum = metadata.checksumSha256.trim().toLowerCase();

  if (!allowedMimeTypes.has(mimeType)) throw new Error(`Unsupported upload MIME type: ${mimeType || "empty"}`);
  if (!Number.isSafeInteger(metadata.sizeBytes) || metadata.sizeBytes <= 0 || metadata.sizeBytes > maxBytes) {
    throw new Error(`Upload size must be between 1 and ${maxBytes} bytes`);
  }
  if ((policy.requireChecksum ?? true) && !/^[a-f0-9]{64}$/.test(checksum)) {
    throw new Error("A lowercase SHA-256 checksum is required");
  }
  for (const [label, value] of [
    ["width", metadata.width],
    ["height", metadata.height],
    ["durationMs", metadata.durationMs],
  ] as const) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0)) {
      throw new Error(`${label} must be a positive integer when supplied`);
    }
  }

  return { ...metadata, mimeType, checksumSha256: checksum };
}
