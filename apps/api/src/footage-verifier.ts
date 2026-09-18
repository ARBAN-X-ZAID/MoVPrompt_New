import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";

const execFileAsync = promisify(execFile);

export const MAX_FOOTAGE_BYTES = 50 * 1024 * 1024;
export const MAX_FOOTAGE_DURATION_MS = 10 * 60 * 1_000;

const ALLOWED_MIME_TYPES = new Set(["video/mp4", "video/quicktime"]);
const ALLOWED_VIDEO_CODECS = new Set(["h264", "hevc", "mpeg4"]);

const ProbeSchema = z.object({
  streams: z.array(z.object({
    codec_type: z.string().optional(),
    codec_name: z.string().optional(),
    duration: z.string().optional(),
  }).passthrough()),
  format: z.object({
    duration: z.string().optional(),
    format_name: z.string().optional(),
  }).passthrough(),
}).passthrough();

export class FootageVerificationError extends Error {
  constructor(
    readonly code: "invalid" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "FootageVerificationError";
  }
}

export type VerifiedFootage = {
  durationMs: number;
};

export type FootageProbe = (path: string) => Promise<unknown>;

export type FootageVerifier = {
  verify(input: {
    bytes: Uint8Array;
    mimeType: string;
    checksumSha256: string;
  }): Promise<VerifiedFootage>;
};

function hasIsoBaseMediaSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && String.fromCharCode(...bytes.subarray(4, 8)) === "ftyp";
}

function secondsToMilliseconds(value: string | undefined): number {
  const seconds = Number(value ?? 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.round(seconds * 1_000);
}

async function defaultProbe(path: string): Promise<unknown> {
  const { stdout } = await execFileAsync(
    process.env.FFPROBE_PATH?.trim() || "ffprobe",
    ["-v", "error", "-show_streams", "-show_format", "-of", "json", path],
    { timeout: 45_000, maxBuffer: 2 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}

function extensionFor(mimeType: string): "mp4" | "mov" {
  return mimeType === "video/quicktime" ? "mov" : "mp4";
}

/**
 * Verifies the bytes rather than caller supplied headers. Both proxy and direct
 * uploads use this exact boundary before footage can become a claim asset.
 */
export function createFootageVerifier(options: {
  probe?: FootageProbe;
  temporaryDirectory?: string;
} = {}): FootageVerifier {
  const probe = options.probe ?? defaultProbe;
  const directory = options.temporaryDirectory ?? tmpdir();

  return {
    async verify(input) {
      const mimeType = input.mimeType.trim().toLowerCase();
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new FootageVerificationError("invalid", "Footage must be an MP4 or MOV video.");
      }
      if (!input.bytes.byteLength || input.bytes.byteLength > MAX_FOOTAGE_BYTES) {
        throw new FootageVerificationError("invalid", "Footage must be 50 MB or smaller.");
      }
      if (!hasIsoBaseMediaSignature(input.bytes)) {
        throw new FootageVerificationError("invalid", "The uploaded file is not a valid MP4 or MOV video.");
      }
      const checksum = createHash("sha256").update(input.bytes).digest("hex");
      if (checksum !== input.checksumSha256.trim().toLowerCase()) {
        throw new FootageVerificationError("invalid", "The uploaded file checksum does not match the saved asset.");
      }

      let tempDirectory: string | null = null;
      try {
        tempDirectory = await mkdtemp(join(directory, "movprompt-footage-"));
        const filePath = join(tempDirectory, `source.${extensionFor(mimeType)}`);
        await writeFile(filePath, input.bytes);
        const report = ProbeSchema.parse(await probe(filePath));
        const video = report.streams.find((stream) => stream.codec_type === "video");
        const formatName = report.format.format_name?.toLowerCase() ?? "";
        if (!video || !ALLOWED_VIDEO_CODECS.has(video.codec_name?.toLowerCase() ?? "")) {
          throw new FootageVerificationError("invalid", "The uploaded file has no supported video stream.");
        }
        if (!/(^|,)mov(,|$)|mp4|quicktime/.test(formatName)) {
          throw new FootageVerificationError("invalid", "The uploaded file is not a supported MP4 or MOV container.");
        }
        const durationMs = secondsToMilliseconds(report.format.duration) || secondsToMilliseconds(video.duration);
        if (!durationMs || durationMs > MAX_FOOTAGE_DURATION_MS) {
          throw new FootageVerificationError("invalid", "Footage must be no longer than ten minutes.");
        }
        return { durationMs };
      } catch (error) {
        if (error instanceof FootageVerificationError) throw error;
        if (error instanceof z.ZodError || error instanceof SyntaxError) {
          throw new FootageVerificationError("invalid", "The uploaded file is not a decodable MP4 or MOV video.");
        }
        if (typeof error === "object" && error !== null && (error as NodeJS.ErrnoException).code === "ENOENT") {
          throw new FootageVerificationError("unavailable", "Footage verification is temporarily unavailable.");
        }
        throw new FootageVerificationError("invalid", "The uploaded file is not a decodable MP4 or MOV video.");
      } finally {
        if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true }).catch(() => undefined);
      }
    },
  };
}
