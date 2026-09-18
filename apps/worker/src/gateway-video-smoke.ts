import { createHash } from "node:crypto";
import { extname, resolve } from "node:path";

import { z } from "zod";

export const SEEDANCE_25_MODEL_ID = "bytedance/seedance-2.5" as const;
export const SEEDANCE_DEV_FAST_MODEL_ID = "bytedance/seedance-v1.0-pro-fast" as const;
export const DEFAULT_SEEDANCE_IMAGE_PATH = "apps/web/public/create/sample-kinza.jpg";

export const SeedanceModelSchema = z.object({
  id: z.enum([SEEDANCE_25_MODEL_ID, SEEDANCE_DEV_FAST_MODEL_ID]),
  type: z.literal("video"),
  video_capabilities: z.object({
    supported_operations: z.array(z.string()),
    supported_resolutions: z.array(z.string()),
    supported_aspect_ratios: z.array(z.string()),
    supported_durations_seconds: z.array(z.number().int()),
    generate_audio: z.boolean(),
    supported_fps: z.array(z.number().int()).optional(),
    input_limits: z.object({
      image: z.object({
        max_count: z.number().int().positive(),
        max_file_size_mb: z.number().positive(),
        supported_formats: z.array(z.string()),
        min_dimension_pixels: z.number().int().positive(),
        max_dimension_pixels: z.number().int().positive(),
        min_aspect_ratio: z.string(),
        max_aspect_ratio: z.string(),
        supported_sources: z.array(z.string()).optional(),
      }).passthrough(),
    }).passthrough(),
  }).passthrough(),
}).passthrough();

export type SeedanceModel = z.infer<typeof SeedanceModelSchema>;

const DirectAspectRatioSchema = z.enum(["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"]);
export type DirectAspectRatio = z.infer<typeof DirectAspectRatioSchema>;

const ResolutionSchema = z.custom<`${number}x${number}`>(
  (value) => typeof value === "string" && /^\d{3,4}x\d{3,4}$/u.test(value),
  "gateway_video_resolution_invalid",
);

const RESOLUTION_BY_RATIO = {
  "480p": {
    "16:9": "864x480",
    "9:16": "480x864",
    "1:1": "480x480",
    "4:3": "640x480",
    "3:4": "480x640",
    "21:9": "1120x480",
  },
  "720p": {
    "16:9": "1280x720",
    "9:16": "720x1280",
    "1:1": "720x720",
    "4:3": "960x720",
    "3:4": "720x960",
    "21:9": "1680x720",
  },
} as const;

export type SeedanceSmokeConfiguration = {
  modelId: typeof SEEDANCE_25_MODEL_ID | typeof SEEDANCE_DEV_FAST_MODEL_ID;
  duration: number;
  aspectRatio: DirectAspectRatio;
  resolutionTier: "480p" | "720p";
  resolution: `${number}x${number}`;
  providerResolution: `${number}x${number}` | "480p" | "720p";
  prompt: string;
  sourceImagePath: string;
  sourceImageUrl?: string;
  timeoutMs: number;
  maxOutputBytes: number;
};

export function resolveSeedanceSmokeConfiguration(input: {
  workspaceRoot: string;
  environment?: NodeJS.ProcessEnv;
  model: unknown;
}): SeedanceSmokeConfiguration {
  const environment = input.environment ?? process.env;
  const model = SeedanceModelSchema.parse(input.model);
  const requestedModel = environment.MOVPROMPT_GATEWAY_VIDEO_MODEL_ID?.trim() || SEEDANCE_25_MODEL_ID;
  if (requestedModel !== SEEDANCE_25_MODEL_ID && requestedModel !== SEEDANCE_DEV_FAST_MODEL_ID) {
    throw new Error(`gateway_video_model_not_approved:${requestedModel}`);
  }
  if (model.id !== requestedModel) {
    throw new Error(`gateway_video_catalog_model_mismatch:${model.id}:expected_${requestedModel}`);
  }
  if (!model.video_capabilities.supported_operations.includes("image-to-video")) {
    throw new Error("gateway_video_image_to_video_unavailable");
  }

  const defaultDuration = requestedModel === SEEDANCE_DEV_FAST_MODEL_ID ? "2" : "4";
  const duration = z.coerce.number().int().min(2).max(30).parse(
    environment.MOVPROMPT_GATEWAY_VIDEO_DURATION_SECONDS?.trim() || defaultDuration,
  );
  if (!model.video_capabilities.supported_durations_seconds.includes(duration)) {
    throw new Error(`gateway_video_duration_unsupported:${duration}`);
  }

  const aspectRatio = DirectAspectRatioSchema.parse(
    environment.MOVPROMPT_GATEWAY_VIDEO_ASPECT_RATIO?.trim() || "9:16",
  );
  if (!model.video_capabilities.supported_aspect_ratios.includes(aspectRatio)) {
    throw new Error(`gateway_video_aspect_ratio_unsupported:${aspectRatio}`);
  }

  const resolutionTier = z.enum(["480p", "720p"]).parse(
    environment.MOVPROMPT_GATEWAY_VIDEO_RESOLUTION_TIER?.trim() || "720p",
  );
  if (!model.video_capabilities.supported_resolutions.includes(resolutionTier)) {
    throw new Error(`gateway_video_resolution_tier_unsupported:${resolutionTier}`);
  }
  const expectedResolution = RESOLUTION_BY_RATIO[resolutionTier][aspectRatio];
  const resolution = ResolutionSchema.parse(
    environment.MOVPROMPT_GATEWAY_VIDEO_RESOLUTION?.trim() || expectedResolution,
  );
  if (resolution !== expectedResolution) {
    throw new Error(
      `gateway_video_resolution_mismatch:${resolution}:expected_${expectedResolution}_for_${aspectRatio}_${resolutionTier}`,
    );
  }

  const prompt = environment.MOVPROMPT_GATEWAY_VIDEO_PROMPT?.trim() || [
    "Create a premium vertical Kuwait beauty-commerce video from the supplied Kinza product photograph.",
    "Preserve the exact package silhouette, logo, colours, label placement and proportions from the reference image.",
    "Use one slow precision camera push with restrained parallax, warm edge light and physically plausible reflections.",
    "Keep the product centered and stable with clean negative space; add no new text, watermark, hands, people, claims or packaging details.",
  ].join(" ");

  const sourceImageSetting = environment.MOVPROMPT_GATEWAY_VIDEO_IMAGE_PATH?.trim() || DEFAULT_SEEDANCE_IMAGE_PATH;
  const sourceImagePath = resolve(input.workspaceRoot, sourceImageSetting);
  const sourceImageUrlSetting = environment.MOVPROMPT_GATEWAY_VIDEO_IMAGE_URL?.trim();
  let sourceImageUrl: string | undefined;
  if (sourceImageUrlSetting) {
    let parsed: URL;
    try {
      parsed = new URL(sourceImageUrlSetting);
    } catch {
      throw new Error("gateway_video_image_url_invalid");
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      throw new Error("gateway_video_image_url_invalid");
    }
    sourceImageUrl = parsed.toString();
  }
  const supportedSources = model.video_capabilities.input_limits.image.supported_sources;
  if (supportedSources?.includes("url") && !supportedSources.some((source) => source !== "url") && !sourceImageUrl) {
    throw new Error("gateway_video_image_url_required");
  }
  const timeoutMs = z.coerce.number().int().min(60_000).max(30 * 60_000).parse(
    environment.MOVPROMPT_GATEWAY_VIDEO_TIMEOUT_MS?.trim() || String(20 * 60_000),
  );
  const maxOutputBytes = z.coerce.number().int().min(1_000_000).max(500 * 1024 * 1024).parse(
    environment.MOVPROMPT_GATEWAY_VIDEO_MAX_OUTPUT_BYTES?.trim() || String(250 * 1024 * 1024),
  );

  return {
    modelId: requestedModel,
    duration,
    aspectRatio,
    resolutionTier,
    resolution,
    // The legacy Seedance v1 endpoint accepts the catalog tier (`480p`),
    // while the Seedance 2.5 first-frame contract accepts the exact canvas.
    providerResolution: requestedModel === SEEDANCE_DEV_FAST_MODEL_ID ? resolutionTier : resolution,
    prompt,
    sourceImagePath,
    ...(sourceImageUrl ? { sourceImageUrl } : {}),
    timeoutMs,
    maxOutputBytes,
  };
}

export function validateSeedanceSourceImage(input: {
  model: SeedanceModel;
  path: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}): { mimeType: "image/jpeg" | "image/png" | "image/webp"; checksumSha256: string } {
  const extension = extname(input.path).toLowerCase();
  const mimeType = extension === ".jpg" || extension === ".jpeg"
    ? "image/jpeg"
    : extension === ".png"
      ? "image/png"
      : extension === ".webp"
        ? "image/webp"
        : null;
  if (!mimeType) throw new Error(`gateway_video_image_format_unsupported:${extension || "missing"}`);
  const format = mimeType.slice("image/".length).replace("jpeg", "jpeg");
  const limits = input.model.video_capabilities.input_limits.image;
  if (!limits.supported_formats.includes(format)) {
    throw new Error(`gateway_video_image_format_unsupported:${format}`);
  }
  const maxBytes = limits.max_file_size_mb * 1024 * 1024;
  if (!input.bytes.byteLength || input.bytes.byteLength > maxBytes) {
    throw new Error(`gateway_video_image_size_unsupported:${input.bytes.byteLength}`);
  }
  if (
    input.width < limits.min_dimension_pixels || input.height < limits.min_dimension_pixels ||
    input.width > limits.max_dimension_pixels || input.height > limits.max_dimension_pixels
  ) {
    throw new Error(`gateway_video_image_dimensions_unsupported:${input.width}x${input.height}`);
  }
  const ratio = input.width / input.height;
  const ratioValue = (value: string): number => {
    const [width, height] = value.split(":").map(Number);
    if (!width || !height) throw new Error(`gateway_video_catalog_ratio_invalid:${value}`);
    return width / height;
  };
  if (ratio < ratioValue(limits.min_aspect_ratio) || ratio > ratioValue(limits.max_aspect_ratio)) {
    throw new Error(`gateway_video_image_aspect_ratio_unsupported:${ratio.toFixed(4)}`);
  }
  return {
    mimeType,
    checksumSha256: createHash("sha256").update(input.bytes).digest("hex"),
  };
}

export function assertMp4(bytes: Uint8Array): void {
  if (bytes.byteLength < 12 || new TextDecoder().decode(bytes.subarray(4, 8)) !== "ftyp") {
    throw new Error("gateway_video_output_not_mp4");
  }
}

export function imageDimensions(bytes: Uint8Array, mimeType: string): { width: number; height: number } {
  if (mimeType === "image/png") {
    if (bytes.byteLength < 24) throw new Error("gateway_video_image_header_invalid");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mimeType === "image/jpeg") {
    if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
      throw new Error("gateway_video_image_header_invalid");
    }
    let offset = 2;
    while (offset + 9 < bytes.byteLength) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1]!;
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      const segmentLength = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
      if (segmentLength < 2 || offset + 2 + segmentLength > bytes.byteLength) {
        throw new Error("gateway_video_image_header_invalid");
      }
      const isStartOfFrame =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isStartOfFrame) {
        return {
          height: (bytes[offset + 5]! << 8) | bytes[offset + 6]!,
          width: (bytes[offset + 7]! << 8) | bytes[offset + 8]!,
        };
      }
      offset += 2 + segmentLength;
    }
    throw new Error("gateway_video_image_dimensions_missing");
  }
  throw new Error(`gateway_video_image_dimensions_unsupported:${mimeType}`);
}
