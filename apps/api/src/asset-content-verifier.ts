import { createHash } from "node:crypto";
import { spawn } from "node:child_process";

import {
  createFootageVerifier,
  FootageVerificationError,
  type FootageVerifier,
} from "./footage-verifier.js";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 16_384;
const MAX_IMAGE_PIXELS = 32 * 1024 * 1024;
const IMAGE_DECODE_TIMEOUT_MS = 15_000;
const MAX_IMAGE_DECODER_STDERR_BYTES = 64 * 1024;
const MAX_IMAGE_DECODER_ALLOCATION_BYTES = 256 * 1024 * 1024;

export class AssetContentVerificationError extends Error {
  constructor(
    readonly code: "invalid" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "AssetContentVerificationError";
  }
}

export type VerifiedAssetContent = {
  width?: number;
  height?: number;
  durationMs?: number;
};

export type AssetContentVerifier = {
  verify(input: {
    kind: "product" | "logo" | "audio" | "reference" | "footage";
    bytes: Uint8Array;
    mimeType: string;
    checksumSha256: string;
  }): Promise<VerifiedAssetContent>;
};

export type ImageDecoder = (input: {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}) => Promise<void>;

function readUInt16BigEndian(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function readUInt32BigEndian(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! * 0x1000000)
    + ((bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!)
  );
}

function requireDimensions(width: number, height: number): { width: number; height: number } {
  if (
    !Number.isInteger(width)
    || !Number.isInteger(height)
    || width < 1
    || height < 1
    || width > MAX_IMAGE_DIMENSION
    || height > MAX_IMAGE_DIMENSION
    || width * height > MAX_IMAGE_PIXELS
  ) {
    throw new AssetContentVerificationError("invalid", "The uploaded image has invalid dimensions.");
  }
  return { width, height };
}

/**
 * Header inspection applies explicit dimension bounds before decode. It is not
 * proof of a valid image: every accepted image is decoded by FFmpeg below.
 */

function verifyJpeg(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new AssetContentVerificationError("invalid", "The uploaded file is not a valid JPG image.");
  }
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      throw new AssetContentVerificationError("invalid", "The uploaded JPG image is malformed.");
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++]!;
    if (marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;
    const segmentLength = readUInt16BigEndian(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      throw new AssetContentVerificationError("invalid", "The uploaded JPG image is malformed.");
    }
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xc3 || marker >= 0xc5 && marker <= 0xc7 || marker >= 0xc9 && marker <= 0xcb || marker >= 0xcd && marker <= 0xcf;
    if (isStartOfFrame) {
      if (segmentLength < 8) {
        throw new AssetContentVerificationError("invalid", "The uploaded JPG image is malformed.");
      }
      return requireDimensions(readUInt16BigEndian(bytes, offset + 5), readUInt16BigEndian(bytes, offset + 3));
    }
    offset += segmentLength;
  }
  throw new AssetContentVerificationError("invalid", "The uploaded JPG image could not be decoded.");
}

function verifyPng(bytes: Uint8Array): { width: number; height: number } {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 33 || !signature.every((value, index) => bytes[index] === value)) {
    throw new AssetContentVerificationError("invalid", "The uploaded file is not a valid PNG image.");
  }
  const ihdrLength = readUInt32BigEndian(bytes, 8);
  const ihdrType = String.fromCharCode(...bytes.subarray(12, 16));
  if (ihdrLength !== 13 || ihdrType !== "IHDR") {
    throw new AssetContentVerificationError("invalid", "The uploaded PNG image is malformed.");
  }
  return requireDimensions(readUInt32BigEndian(bytes, 16), readUInt32BigEndian(bytes, 20));
}

function readUInt24LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

function verifyWebp(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 30 || String.fromCharCode(...bytes.subarray(0, 4)) !== "RIFF" || String.fromCharCode(...bytes.subarray(8, 12)) !== "WEBP") {
    throw new AssetContentVerificationError("invalid", "The uploaded file is not a valid WebP image.");
  }
  const chunk = String.fromCharCode(...bytes.subarray(12, 16));
  if (chunk === "VP8X" && bytes.length >= 30) {
    return requireDimensions(1 + readUInt24LittleEndian(bytes, 24), 1 + readUInt24LittleEndian(bytes, 27));
  }
  if (chunk === "VP8 " && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return requireDimensions(readUInt16BigEndian(bytes, 26) & 0x3fff, readUInt16BigEndian(bytes, 28) & 0x3fff);
  }
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const value = bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24);
    return requireDimensions((value & 0x3fff) + 1, ((value >> 14) & 0x3fff) + 1);
  }
  throw new AssetContentVerificationError("invalid", "The uploaded WebP image could not be decoded.");
}

function inspectImage(input: { bytes: Uint8Array; mimeType: string; checksumSha256: string }): {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  dimensions: { width: number; height: number };
} {
  const mimeType = input.mimeType.trim().toLowerCase();
  if (mimeType !== "image/jpeg" && mimeType !== "image/png" && mimeType !== "image/webp") {
    throw new AssetContentVerificationError("invalid", "Images must be JPG, PNG or WebP files.");
  }
  if (!input.bytes.byteLength || input.bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new AssetContentVerificationError("invalid", "Product images must be 12 MB or smaller.");
  }
  const checksum = createHash("sha256").update(input.bytes).digest("hex");
  if (checksum !== input.checksumSha256.trim().toLowerCase()) {
    throw new AssetContentVerificationError("invalid", "The uploaded image checksum does not match the saved asset.");
  }
  if (mimeType === "image/jpeg") return { mimeType, dimensions: verifyJpeg(input.bytes) };
  if (mimeType === "image/png") return { mimeType, dimensions: verifyPng(input.bytes) };
  return { mimeType, dimensions: verifyWebp(input.bytes) };
}

/**
 * Decode a bounded in-memory image through the same media toolchain used by
 * production workers. Header signatures alone are not trusted because a
 * truncated image can have a valid signature and dimensions but no pixels.
 */
function createFfmpegImageDecoder(): ImageDecoder {
  return async ({ bytes }) => new Promise<void>((resolve, reject) => {
    const ffmpegPath = process.env.FFMPEG_PATH?.trim() || "ffmpeg";
    let settled = false;
    let stderrBytes = 0;
    const child = spawn(
      ffmpegPath,
      [
        "-nostdin",
        "-v", "error",
        "-xerror",
        "-threads", "1",
        "-max_alloc", String(MAX_IMAGE_DECODER_ALLOCATION_BYTES),
        "-i", "pipe:0",
        "-map", "0:v:0",
        "-frames:v", "1",
        "-f", "null",
        "-",
      ],
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new AssetContentVerificationError("invalid", "The uploaded image could not be decoded within the allowed limit."));
    }, IMAGE_DECODE_TIMEOUT_MS);

    function finish(error?: AssetContentVerificationError): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    }

    child.stderr.on("data", (chunk: Uint8Array) => {
      stderrBytes += chunk.byteLength;
      if (stderrBytes > MAX_IMAGE_DECODER_STDERR_BYTES) {
        child.kill("SIGKILL");
        finish(new AssetContentVerificationError("invalid", "The uploaded image could not be decoded."));
      }
    });
    child.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        finish(new AssetContentVerificationError("unavailable", "Image verification is temporarily unavailable."));
        return;
      }
      finish(new AssetContentVerificationError("invalid", "The uploaded image could not be decoded."));
    });
    child.once("close", (code) => {
      if (code === 0) {
        finish();
        return;
      }
      finish(new AssetContentVerificationError("invalid", "The uploaded image could not be decoded."));
    });
    child.stdin.once("error", () => {
      // The close event converts a decoder-side stdin failure into the same
      // non-disclosing invalid-media response.
    });
    child.stdin.end(bytes);
  });
}

async function verifyImage(
  input: { bytes: Uint8Array; mimeType: string; checksumSha256: string },
  decodeImage: ImageDecoder,
): Promise<VerifiedAssetContent> {
  const inspected = inspectImage(input);
  await decodeImage({ bytes: input.bytes, mimeType: inspected.mimeType });
  return inspected.dimensions;
}

/** One server boundary validates all private upload bytes before a claim may advance. */
export function createAssetContentVerifier(options: {
  footageVerifier?: FootageVerifier;
  imageDecoder?: ImageDecoder;
} = {}): AssetContentVerifier {
  const footageVerifier = options.footageVerifier ?? createFootageVerifier();
  const imageDecoder = options.imageDecoder ?? createFfmpegImageDecoder();
  return {
    async verify(input) {
      if (input.kind === "footage") {
        try {
          const verified = await footageVerifier.verify(input);
          return { durationMs: verified.durationMs };
        } catch (error) {
          if (error instanceof FootageVerificationError) {
            throw new AssetContentVerificationError(error.code, error.message);
          }
          throw error;
        }
      }
      if (input.kind === "audio") {
        const checksum = createHash("sha256").update(input.bytes).digest("hex");
        if (!input.bytes.byteLength || checksum !== input.checksumSha256.trim().toLowerCase()) {
          throw new AssetContentVerificationError("invalid", "The uploaded audio checksum does not match the saved asset.");
        }
        return {};
      }
      return verifyImage(input, imageDecoder);
    },
  };
}
