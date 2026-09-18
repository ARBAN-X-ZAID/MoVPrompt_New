import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  createGateway,
  generateText,
  Output,
  type LanguageModel,
  type UserContent,
} from "ai";
import { z } from "zod";

import type { JsonObject } from "@movprompt/db";

import type { OutputQualityAnalyzer } from "./output-quality-reviewer.js";

const execFileAsync = promisify(execFile);

export interface QualityMediaStorage {
  readonly assetsBucket: string;
  signDownload(input: {
    bucket: string;
    key: string;
    expiresInSeconds?: number;
  }): Promise<{ url: string }>;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
type ProbeRunner = (url: string) => Promise<unknown>;
type DecodeRunner = (url: string) => Promise<void>;

const ProbeSchema = z.object({
  streams: z.array(z.object({
    codec_type: z.string().optional(),
    codec_name: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    avg_frame_rate: z.string().optional(),
  }).passthrough()),
  format: z.object({ duration: z.string().optional(), format_name: z.string().optional() }).passthrough(),
}).passthrough();

function generationConfiguration(configuration: JsonObject): JsonObject {
  const generation = configuration.generation;
  return generation && typeof generation === "object" && !Array.isArray(generation)
    ? generation as JsonObject
    : configuration;
}

function numberRatio(value: string | undefined): number {
  if (!value) return 0;
  const [numerator, denominator] = value.split("/").map(Number);
  if (!numerator || !denominator) return Number(value) || 0;
  return numerator / denominator;
}

async function defaultProbeRunner(url: string): Promise<unknown> {
  const { stdout } = await execFileAsync(
    process.env.FFPROBE_PATH?.trim() || "ffprobe",
    ["-v", "error", "-show_streams", "-show_format", "-of", "json", url],
    { timeout: 45_000, maxBuffer: 2 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}

async function defaultDecodeRunner(url: string): Promise<void> {
  await execFileAsync(
    process.env.FFMPEG_PATH?.trim() || "ffmpeg",
    ["-v", "error", "-i", url, "-f", "null", "-"],
    { timeout: 10 * 60_000, maxBuffer: 2 * 1024 * 1024 },
  );
}

export function createFfprobeTechnicalAnalyzer(options: {
  storage: QualityMediaStorage;
  probe?: ProbeRunner;
  /**
   * Full decode of the final private object. Tests using a synthetic probe can
   * provide a deterministic substitute; production uses FFmpeg by default.
   */
  decode?: DecodeRunner;
}): OutputQualityAnalyzer {
  const probe = options.probe ?? defaultProbeRunner;
  const decode = options.decode ?? (options.probe ? async () => undefined : defaultDecodeRunner);
  return {
    id: "ffprobe-technical-v1",
    dimensions: ["technical"],
    async analyze(input) {
      try {
        const signed = await options.storage.signDownload({
          bucket: input.candidate.bucket,
          key: input.candidate.objectKey,
          expiresInSeconds: 900,
        });
        // A parseable header is not sufficient: fully decode the exact
        // MovPrompt-owned object before it reaches visual review.
        await decode(signed.url);
        const report = ProbeSchema.parse(await probe(signed.url));
        const video = report.streams.find((stream) => stream.codec_type === "video");
        const audio = report.streams.find((stream) => stream.codec_type === "audio");
        const duration = Number(report.format.duration ?? 0);
        const expectedDuration = Number(generationConfiguration(input.configuration).durationSeconds ?? 0);
        const generation = generationConfiguration(input.configuration);
        const requestedResolution = generation.resolution === "480p" ? "480p" : "720p";
        const requestedAspectRatio = typeof generation.aspectRatio === "string" ? generation.aspectRatio : "9:16";
        const expectedAspectRatio = requestedAspectRatio === "9:16"
          ? 9 / 16
          : requestedAspectRatio === "1:1"
            ? 1
            : requestedAspectRatio === "4:5"
              ? 4 / 5
              : 16 / 9;
        const audioExpected = generation.audio !== false;
        const fps = numberRatio(video?.avg_frame_rate);
        const evidence: string[] = [];
        let score = 100;
        let hardFailure = false;
        if (!video) {
          score = 0;
          hardFailure = true;
          evidence.push("video_stream_missing");
        } else {
          if (video.codec_name !== "h264") {
            score -= 30;
            hardFailure = true;
            evidence.push(`video_codec:${video.codec_name ?? "unknown"}`);
          }
          const width = video.width ?? 0;
          const height = video.height ?? 0;
          const minimumShortSide = requestedResolution === "480p" ? 470 : 700;
          if (Math.min(width, height) < minimumShortSide) {
            score -= 30;
            hardFailure = true;
            evidence.push(`delivery_dimensions_too_small:${width}x${height}/${requestedResolution}`);
          }
          if (width > 0 && height > 0 && Math.abs(width / height - expectedAspectRatio) > 0.035) {
            score -= 30;
            hardFailure = true;
            evidence.push(`aspect_ratio_mismatch:${width}x${height}/${requestedAspectRatio}`);
          }
          if (fps < 20) { score -= 25; evidence.push(`frame_rate:${fps.toFixed(2)}`); }
        }
        if (!Number.isFinite(duration) || duration < 3 || duration > 60) {
          score -= 40;
          hardFailure = true;
          evidence.push(`duration:${duration}`);
        } else if (expectedDuration && Math.abs(duration - expectedDuration) > 1.25) {
          score -= 20;
          evidence.push(`duration_mismatch:${duration}/${expectedDuration}`);
        }
        if (audio && audio.codec_name !== "aac") {
          score -= 8;
          hardFailure = true;
          evidence.push(`audio_codec:${audio.codec_name}`);
        }
        if (audioExpected && !audio) {
          score -= 35;
          hardFailure = true;
          evidence.push("required_audio_stream_absent");
        }
        if (!audioExpected && audio) {
          score -= 35;
          hardFailure = true;
          evidence.push("muted_campaign_contains_audio");
        }
        return [{
          dimension: "technical",
          score: Math.max(0, score),
          hardFailure,
          evidence: evidence.join(",") || "valid_mp4_h264_delivery",
        }];
      } catch (error) {
        return [{
          dimension: "technical",
          score: 0,
          hardFailure: true,
          evidence: error instanceof Error ? error.message.slice(0, 500) : "ffprobe_failed",
        }];
      }
    },
  };
}

const JUDGE_DIMENSIONS = [
  "product_identity",
  "prompt_adherence",
  "motion_realism",
  "visual_artifacts",
  "brand_safety",
  "dialect_fidelity",
  "speech_sync",
  "safe_zones",
  "compliance",
] as const;

const ScoreSchema = z.number().int().min(0).max(100);
const EvidenceSchema = z.string().trim().min(1).max(500);
const JudgeResultSchema = z.object({
  scores: z.object({
    product_identity: ScoreSchema,
    prompt_adherence: ScoreSchema,
    motion_realism: ScoreSchema,
    visual_artifacts: ScoreSchema,
    brand_safety: ScoreSchema,
    dialect_fidelity: ScoreSchema,
    speech_sync: ScoreSchema,
    safe_zones: ScoreSchema,
    compliance: ScoreSchema,
  }).strict(),
  evidence: z.object({
    product_identity: EvidenceSchema,
    prompt_adherence: EvidenceSchema,
    motion_realism: EvidenceSchema,
    visual_artifacts: EvidenceSchema,
    brand_safety: EvidenceSchema,
    dialect_fidelity: EvidenceSchema,
    speech_sync: EvidenceSchema,
    safe_zones: EvidenceSchema,
    compliance: EvidenceSchema,
  }).strict(),
}).strict();

const QUALITY_VIDEO_MEDIA_TYPE = "video/mp4";
const QUALITY_REFERENCE_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_REFERENCE_IMAGES = 5;
const MAX_GATEWAY_VIDEO_BYTES = 18 * 1024 * 1024;
const MAX_GATEWAY_REFERENCE_BYTES = 8 * 1024 * 1024;
const MAX_DOWNLOAD_TIMEOUT_MS = 45_000;
const MAX_JUDGE_TIMEOUT_MS = 180_000;
const MAX_BRIEF_CHARACTERS = 24_000;
const VERCEL_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v4/ai";

type JudgeResult = z.infer<typeof JudgeResultSchema>;

function boundedInteger(
  value: number | undefined,
  fallback: number,
  maximum: number,
  errorCode: string,
): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved <= 0 || resolved > maximum) {
    throw new Error(errorCode);
  }
  return resolved;
}

function qualityPrompt(configuration: JsonObject): string {
  const generation = generationConfiguration(configuration);
  const brief = generation.creativeBrief ?? {};
  return [
    "You are MovPrompt's strict independent video acceptance reviewer for Kuwait advertising.",
    "Review the complete video and audio against the confirmed brief and supplied reference images.",
    "Scores are 0-100 where 100 is production-ready. Do not reward cinematic style when product identity or facts changed.",
    "product_identity: packaging, silhouette, colour, label, logo and subject match references.",
    "prompt_adherence: timecoded story, subject, camera and requested action are followed.",
    "motion_realism: physics, hands, faces, interactions and camera motion are coherent.",
    "visual_artifacts: 100 means no morphing, flicker, broken geometry, text corruption or temporal artifacts.",
    "brand_safety: 100 means safe, respectful and not misleading.",
    "dialect_fidelity: for Arabic/bilingual, judge native Kuwaiti ar-KW wording/pronunciation and reject Egyptian, Levantine, Saudi, Emirati or generic MSA; for English-only return 100.",
    "speech_sync: if no person is visibly speaking return 100; if a person speaks, score phoneme-to-mouth timing and reject silent talking, detached dubbing, lip drift or a script that differs from the approved line.",
    "safe_zones: important subjects do not occupy protected logo, price, subtitle or CTA zones.",
    "compliance: all visible/spoken claims are confirmed; clinics must not promise results or show deceptive generated before/after content.",
    `CONFIRMED BRIEF: ${JSON.stringify(brief).slice(0, MAX_BRIEF_CHARACTERS)}`,
    "Return only the required JSON scores and concise timestamped evidence.",
  ].join("\n");
}

async function downloadBytes(fetcher: Fetcher, url: string, maxBytes: number): Promise<Uint8Array> {
  const response = await fetcher(url, {
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(MAX_DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`quality_media_download_failed:${response.status}`);
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (!Number.isFinite(declared) || declared < 0 || declared > maxBytes) {
    throw new Error("quality_media_too_large");
  }
  if (!response.body) throw new Error("quality_media_body_missing");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("quality_media_too_large");
        throw new Error("quality_media_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!totalBytes) throw new Error("quality_media_empty");

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * Reviews a stored output with a multimodal language model routed exclusively
 * through Vercel AI Gateway. Media is downloaded from short-lived private
 * URLs into bounded buffers before it becomes a FilePart; signed URLs and raw
 * provider identifiers never become persisted project state.
 */
export function createGatewayVideoQualityAnalyzer(options: {
  storage: QualityMediaStorage;
  apiKey: string;
  modelId: string;
  gatewayBaseUrl?: string;
  fetcher?: Fetcher;
  languageModel?: LanguageModel;
  maxVideoBytes?: number;
  maxReferenceBytes?: number;
  requestTimeoutMs?: number;
}): OutputQualityAnalyzer {
  const apiKey = options.apiKey.trim();
  const model = options.modelId.trim();
  if (!apiKey) throw new Error("gateway_quality_api_key_required");
  if (!/^google\/gemini-[a-z0-9.-]+$/u.test(model)) {
    throw new Error("gateway_quality_model_invalid");
  }
  const gatewayBaseUrl = options.gatewayBaseUrl?.trim() || VERCEL_GATEWAY_BASE_URL;
  if (gatewayBaseUrl !== VERCEL_GATEWAY_BASE_URL) {
    throw new Error("gateway_quality_base_url_invalid");
  }
  const fetcher = options.fetcher ?? fetch;
  const maxVideoBytes = boundedInteger(
    options.maxVideoBytes,
    MAX_GATEWAY_VIDEO_BYTES,
    MAX_GATEWAY_VIDEO_BYTES,
    "gateway_quality_video_limit_invalid",
  );
  const maxReferenceBytes = boundedInteger(
    options.maxReferenceBytes,
    MAX_GATEWAY_REFERENCE_BYTES,
    MAX_GATEWAY_REFERENCE_BYTES,
    "gateway_quality_reference_limit_invalid",
  );
  const requestTimeoutMs = boundedInteger(
    options.requestTimeoutMs,
    120_000,
    MAX_JUDGE_TIMEOUT_MS,
    "gateway_quality_timeout_invalid",
  );
  const languageModel = options.languageModel ?? createGateway({
    apiKey,
    baseURL: gatewayBaseUrl,
  })(model);

  return {
    id: "gateway-video-quality-v1",
    dimensions: JUDGE_DIMENSIONS,
    async analyze(input) {
      const output = await options.storage.signDownload({
        bucket: input.candidate.bucket,
        key: input.candidate.objectKey,
        expiresInSeconds: 900,
      });
      const video = await downloadBytes(fetcher, output.url, maxVideoBytes);
      const content: Exclude<UserContent, string> = [
        { type: "text", text: qualityPrompt(input.configuration) },
      ];
      const references = z.array(z.object({
        objectKey: z.string().trim().min(1),
        mimeType: z.string().trim().min(1),
      }).passthrough()).default([]).parse(generationConfiguration(input.configuration).references);
      let referenceBudget = maxReferenceBytes;
      const referenceImages = references.filter((item) => item.mimeType.startsWith("image/")).slice(0, MAX_REFERENCE_IMAGES);
      for (const [index, reference] of referenceImages.entries()) {
        if (!QUALITY_REFERENCE_MEDIA_TYPES.has(reference.mimeType)) {
          throw new Error(`quality_reference_media_type_unsupported:${reference.mimeType}`);
        }
        const signed = await options.storage.signDownload({
          bucket: options.storage.assetsBucket,
          key: reference.objectKey,
          expiresInSeconds: 900,
        });
        const bytes = await downloadBytes(fetcher, signed.url, referenceBudget);
        referenceBudget -= bytes.byteLength;
        content.push({ type: "text", text: `REFERENCE IMAGE ${index + 1} OF ${referenceImages.length}` });
        content.push({
          type: "file",
          data: bytes,
          mediaType: reference.mimeType,
          filename: `movprompt-reference-${index + 1}.${reference.mimeType.split("/")[1]}`,
        });
      }
      content.push({ type: "text", text: "CANDIDATE VIDEO TO REVIEW" });
      content.push({
        type: "file",
        data: video,
        mediaType: QUALITY_VIDEO_MEDIA_TYPE,
        filename: "movprompt-quality-review.mp4",
      });

      const result = await generateText({
        model: languageModel,
        messages: [{ role: "user", content }],
        output: Output.object({
          name: "movprompt_video_quality_review",
          description: "Strict production acceptance scores and timestamped evidence for every MovPrompt quality dimension.",
          schema: JudgeResultSchema,
        }),
        temperature: 0,
        abortSignal: AbortSignal.timeout(requestTimeoutMs),
        providerOptions: {
          gateway: {
            tags: ["feature:video-quality", "service:movprompt-worker"],
          },
        },
      });
      const judgment: JudgeResult = JudgeResultSchema.parse(result.output);
      return JUDGE_DIMENSIONS.map((dimension) => ({
        dimension,
        score: judgment.scores[dimension],
        evidence: judgment.evidence[dimension],
      }));
    },
  };
}
