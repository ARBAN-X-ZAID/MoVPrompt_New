import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { COLLECTIONS, type MongoDatabase } from "@movprompt/db";
import type { ProviderGenerationRequest, ProviderReference } from "@movprompt/providers";
import type { VercelGatewayInlineFirstFrame } from "@movprompt/providers";
import { assertOwnedProjectKey } from "@movprompt/storage";

import { imageDimensions } from "./gateway-video-smoke.js";

const execFileAsync = promisify(execFile);
const DEFAULT_MAX_SOURCE_BYTES = 30 * 1024 * 1024;
const DEFAULT_MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

type VerifiedImageMime = "image/jpeg" | "image/png" | "image/webp";

type PrivateAssetStorage = {
  readonly assetsBucket: string;
  get(input: { bucket: string; key: string; maxBytes: number }): Promise<{
    body: Uint8Array;
    contentType?: string;
    checksumSha256?: string;
  }>;
};

type PrivateReferenceStorage = PrivateAssetStorage & {
  signDownload(input: {
    bucket: string;
    key: string;
    expiresInSeconds: number;
  }): Promise<{ url: string }>;
};

export type VerifiedReferenceAsset = {
  assetId: string;
  bucket: string;
  objectKey: string;
  mimeType: VerifiedImageMime;
  sizeBytes: number;
  checksumSha256: string;
};

export type ReferenceAssetVerifier = (
  reference: ProviderReference,
  generation: ProviderGenerationRequest,
) => Promise<VerifiedReferenceAsset>;

type CommandRunner = (command: string, args: readonly string[]) => Promise<void>;

export interface GatewayFirstFramePreparerOptions {
  storage: PrivateAssetStorage;
  verifyReference: ReferenceAssetVerifier;
  ffmpegPath: string;
  maxSourceBytes?: number;
  maxOutputBytes?: number;
  runCommand?: CommandRunner;
}

const SHA256_HEX = /^[a-f0-9]{64}$/u;
const SUPPORTED_SOURCE_MIMES = new Set<VerifiedImageMime>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function normalizeImageMime(value: string): VerifiedImageMime | undefined {
  const normalized = value.split(";", 1)[0]?.trim().toLowerCase();
  return SUPPORTED_SOURCE_MIMES.has(normalized as VerifiedImageMime)
    ? normalized as VerifiedImageMime
    : undefined;
}

function parseCanonicalAssetKey(
  objectKey: string,
  userId: string,
  projectId: string,
): { kind: "product" | "reference"; assetId: string; checksumSha256: string } {
  try {
    assertOwnedProjectKey(objectKey, userId, projectId);
  } catch {
    throw new Error("gateway_reference_not_owned");
  }
  const parts = objectKey.split("/");
  const expectedPrefix = ["users", userId, "projects", projectId, "assets"];
  const prefixMatches = expectedPrefix.every((part, index) => parts[index] === part);
  const kind = parts[5];
  const assetId = parts[6];
  const checksumSha256 = parts[7]?.toLowerCase();
  if (
    !prefixMatches ||
    parts.length !== 8 ||
    (kind !== "product" && kind !== "reference") ||
    !assetId ||
    !checksumSha256 ||
    !SHA256_HEX.test(checksumSha256)
  ) {
    throw new Error("gateway_reference_key_invalid");
  }
  return { kind, assetId, checksumSha256 };
}

/**
 * Privileged workers still enforce the same ownership boundary as the API.
 * A client-authored object key is never enough: an available project, exact
 * owner-scoped asset row, canonical key, supported MIME and immutable digest
 * are all required before storage credentials are used.
 */
export function createMongoAssetReferenceVerifier(
  database: MongoDatabase,
  assetsBucket: string,
): ReferenceAssetVerifier {
  const canonicalBucket = assetsBucket.trim();
  if (!canonicalBucket) throw new Error("gateway_reference_assets_bucket_required");
  return async (reference, generation) => {
    const project = await database.collection(COLLECTIONS.creatorProjects).findOne({ id: generation.projectId, userId: generation.userId, status: { $ne: "trashed" }, deletedAt: null });
    const storageOwner = reference.objectKey.split("/")[1] === generation.userId ? generation.userId : typeof project?.storageOwnerId === "string" ? project.storageOwnerId : generation.userId;
    const key = parseCanonicalAssetKey(reference.objectKey, storageOwner, generation.projectId);
    const asset = project ? await database.collection(COLLECTIONS.creatorProjectAssets).findOne({ id: key.assetId, userId: generation.userId, projectId: generation.projectId, objectKey: reference.objectKey, bucket: canonicalBucket, kind: { $in: ["product", "reference"] } }) : null;
    const mimeType = asset ? normalizeImageMime(String(asset.mimeType)) : undefined;
    const checksumSha256 = typeof asset?.checksumSha256 === "string" ? asset.checksumSha256.trim().toLowerCase() : undefined;
    if (!asset || !mimeType || !Number.isSafeInteger(asset.sizeBytes) || Number(asset.sizeBytes) < 1 || !checksumSha256 || checksumSha256 !== key.checksumSha256) throw new Error("gateway_reference_not_available");
    return { assetId: String(asset.id), bucket: String(asset.bucket), objectKey: String(asset.objectKey), mimeType, sizeBytes: Number(asset.sizeBytes), checksumSha256 };
  };
}

const CANVAS = {
  "480p": {
    "9:16": { width: 480, height: 854 },
    "1:1": { width: 480, height: 480 },
    "4:5": { width: 480, height: 640 },
    "16:9": { width: 854, height: 480 },
  },
  "720p": {
    "9:16": { width: 720, height: 1280 },
    "1:1": { width: 720, height: 720 },
    "4:5": { width: 720, height: 960 },
    "16:9": { width: 1280, height: 720 },
  },
} as const;

function boundedBytes(value: number | undefined, fallback: number, label: string): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > 30 * 1024 * 1024) {
    throw new Error(`${label}_invalid`);
  }
  return resolved;
}

function sniffImageMime(bytes: Uint8Array): VerifiedImageMime | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return undefined;
}

function verifiedSourceMime(contentType: string | undefined, bytes: Uint8Array): VerifiedImageMime {
  const metadataMime = contentType ? normalizeImageMime(contentType) : undefined;
  const detectedMime = sniffImageMime(bytes);
  if (!detectedMime || metadataMime !== detectedMime) {
    throw new Error("gateway_first_frame_source_mime_invalid");
  }
  return detectedMime;
}

function assertAssetSourceIntegrity(
  asset: VerifiedReferenceAsset,
  source: {
    body: Uint8Array;
    contentType?: string;
    checksumSha256?: string;
  },
): VerifiedImageMime {
  const sourceMime = verifiedSourceMime(source.contentType, source.body);
  const bodyChecksum = createHash("sha256").update(source.body).digest("hex");
  const storageChecksum = source.checksumSha256?.trim().toLowerCase();
  if (
    sourceMime !== asset.mimeType ||
    source.body.byteLength !== asset.sizeBytes ||
    storageChecksum !== asset.checksumSha256 ||
    bodyChecksum !== asset.checksumSha256
  ) {
    throw new Error("gateway_first_frame_source_integrity_invalid");
  }
  return sourceMime;
}

function sourceExtension(mimeType: VerifiedImageMime): string {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  return ".webp";
}

function canvasFor(generation: ProviderGenerationRequest): { width: number; height: number } {
  const resolution = generation.resolution ?? "720p";
  const ratio = generation.aspectRatio ?? "9:16";
  return CANVAS[resolution][ratio];
}

async function defaultRunCommand(command: string, args: readonly string[]): Promise<void> {
  await execFileAsync(command, [...args], { timeout: 60_000, maxBuffer: 2 * 1024 * 1024 });
}

/**
 * Resolves non-first-frame references only after the same DB ownership and
 * whole-object integrity checks used for inline frames. This keeps privileged
 * signing from becoming an arbitrary-object oracle.
 */
export function createVerifiedReferenceUrlResolver(options: {
  storage: PrivateReferenceStorage;
  verifyReference: ReferenceAssetVerifier;
  maxSourceBytes?: number;
  signedUrlTtlSeconds?: number;
}) {
  const maxSourceBytes = boundedBytes(
    options.maxSourceBytes,
    DEFAULT_MAX_SOURCE_BYTES,
    "gateway_reference_source_limit",
  );
  const signedUrlTtlSeconds = options.signedUrlTtlSeconds ?? 3_600;
  if (!Number.isSafeInteger(signedUrlTtlSeconds) || signedUrlTtlSeconds < 60 || signedUrlTtlSeconds > 3_600) {
    throw new Error("gateway_reference_signed_url_ttl_invalid");
  }
  return async (reference: ProviderReference, generation: ProviderGenerationRequest) => {
    const asset = await options.verifyReference(reference, generation);
    if (asset.bucket !== options.storage.assetsBucket || asset.sizeBytes > maxSourceBytes) {
      throw new Error("gateway_reference_storage_invalid");
    }
    const source = await options.storage.get({
      bucket: asset.bucket,
      key: asset.objectKey,
      maxBytes: maxSourceBytes,
    });
    assertAssetSourceIntegrity(asset, source);
    const signed = await options.storage.signDownload({
      bucket: asset.bucket,
      key: asset.objectKey,
      expiresInSeconds: signedUrlTtlSeconds,
    });
    return { url: signed.url, mediaType: asset.mimeType };
  };
}

/**
 * Reads a private product image through S3 credentials, verifies storage MIME
 * against magic bytes, then contain+pads (never crops) it to the exact quoted
 * Seedance canvas. The normalized JPEG is sent inline, so no local storage
 * URL ever crosses the provider boundary.
 */
export function createGatewayFirstFramePreparer(options: GatewayFirstFramePreparerOptions) {
  const ffmpegPath = options.ffmpegPath.trim();
  if (!ffmpegPath) throw new Error("gateway_first_frame_ffmpeg_path_required");
  const maxSourceBytes = boundedBytes(options.maxSourceBytes, DEFAULT_MAX_SOURCE_BYTES, "gateway_first_frame_source_limit");
  const maxOutputBytes = boundedBytes(options.maxOutputBytes, DEFAULT_MAX_OUTPUT_BYTES, "gateway_first_frame_output_limit");
  const runCommand = options.runCommand ?? defaultRunCommand;

  return async (
    reference: ProviderReference,
    generation: ProviderGenerationRequest,
  ): Promise<VercelGatewayInlineFirstFrame> => {
    const asset = await options.verifyReference(reference, generation);
    if (asset.bucket !== options.storage.assetsBucket) {
      throw new Error("gateway_reference_bucket_mismatch");
    }
    if (asset.sizeBytes > maxSourceBytes) {
      throw new Error("gateway_first_frame_source_too_large");
    }
    const source = await options.storage.get({
      bucket: asset.bucket,
      key: asset.objectKey,
      maxBytes: maxSourceBytes,
    });
    const sourceMime = assertAssetSourceIntegrity(asset, source);
    const canvas = canvasFor(generation);
    const directory = await mkdtemp(join(tmpdir(), "movprompt-gateway-frame-"));
    const inputPath = join(directory, `source${sourceExtension(sourceMime)}`);
    const outputPath = join(directory, "first-frame.jpg");
    try {
      await writeFile(inputPath, source.body);
      const filter = [
        `scale=${canvas.width}:${canvas.height}:force_original_aspect_ratio=decrease:flags=lanczos`,
        `pad=${canvas.width}:${canvas.height}:(ow-iw)/2:(oh-ih)/2:color=white`,
        "setsar=1",
        "format=yuv420p",
      ].join(",");
      await runCommand(ffmpegPath, [
        "-v", "error",
        "-nostdin",
        "-y",
        "-i", inputPath,
        "-vf", filter,
        "-frames:v", "1",
        "-q:v", "2",
        outputPath,
      ]);
      const output = new Uint8Array(await readFile(outputPath));
      if (!output.byteLength || output.byteLength > maxOutputBytes || sniffImageMime(output) !== "image/jpeg") {
        throw new Error("gateway_first_frame_output_invalid");
      }
      const dimensions = imageDimensions(output, "image/jpeg");
      if (dimensions.width !== canvas.width || dimensions.height !== canvas.height) {
        throw new Error("gateway_first_frame_canvas_mismatch");
      }
      return {
        type: "file",
        data: Buffer.from(output).toString("base64"),
        mediaType: "image/jpeg",
      };
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  };
}
