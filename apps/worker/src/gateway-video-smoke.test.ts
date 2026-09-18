import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  assertMp4,
  imageDimensions,
  resolveSeedanceSmokeConfiguration,
  SEEDANCE_25_MODEL_ID,
  SEEDANCE_DEV_FAST_MODEL_ID,
  validateSeedanceSourceImage,
} from "./gateway-video-smoke.js";

const model = {
  id: SEEDANCE_25_MODEL_ID,
  type: "video",
  video_capabilities: {
    supported_operations: ["text-to-video", "image-to-video"],
    supported_resolutions: ["480p", "720p"],
    supported_aspect_ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"],
    supported_durations_seconds: Array.from({ length: 27 }, (_, index) => index + 4),
    generate_audio: true,
    supported_fps: [24],
    input_limits: {
      image: {
        max_count: 30,
        max_file_size_mb: 30,
        supported_formats: ["jpeg", "png", "webp"],
        min_dimension_pixels: 300,
        max_dimension_pixels: 6000,
        min_aspect_ratio: "2:5",
        max_aspect_ratio: "5:2",
      },
    },
  },
};

describe("guarded Seedance 2.5 smoke configuration", () => {
  it("locks the demo to Seedance 2.5, a supported cap and the Kinza reference", () => {
    const configuration = resolveSeedanceSmokeConfiguration({ workspaceRoot: "/workspace", model });
    expect(configuration).toMatchObject({
      modelId: SEEDANCE_25_MODEL_ID,
      duration: 4,
      aspectRatio: "9:16",
      resolutionTier: "720p",
      resolution: "720x1280",
      providerResolution: "720x1280",
      sourceImagePath: "/workspace/apps/web/public/create/sample-kinza.jpg",
    });
  });

  it("rejects unapproved models and incompatible resolution overrides before spending", () => {
    expect(() => resolveSeedanceSmokeConfiguration({
      workspaceRoot: "/workspace",
      model,
      environment: { MOVPROMPT_GATEWAY_VIDEO_MODEL_ID: "bytedance/seedance-2.0" },
    })).toThrow("gateway_video_model_not_approved");
    expect(() => resolveSeedanceSmokeConfiguration({
      workspaceRoot: "/workspace",
      model,
      environment: { MOVPROMPT_GATEWAY_VIDEO_RESOLUTION: "1280x720" },
    })).toThrow("gateway_video_resolution_mismatch");
  });

  it("allows the explicitly development-only fast model at the approved cheap tier", () => {
    const fastModel = structuredClone(model);
    fastModel.id = SEEDANCE_DEV_FAST_MODEL_ID;
    fastModel.video_capabilities.supported_resolutions = ["480p", "720p", "1080p"];
    fastModel.video_capabilities.supported_durations_seconds = Array.from({ length: 11 }, (_, index) => index + 2);
    expect(resolveSeedanceSmokeConfiguration({
      workspaceRoot: "/workspace",
      model: fastModel,
      environment: {
        MOVPROMPT_GATEWAY_VIDEO_MODEL_ID: SEEDANCE_DEV_FAST_MODEL_ID,
        MOVPROMPT_GATEWAY_VIDEO_DURATION_SECONDS: "2",
        MOVPROMPT_GATEWAY_VIDEO_RESOLUTION_TIER: "480p",
        MOVPROMPT_GATEWAY_VIDEO_RESOLUTION: "480x864",
      },
    })).toMatchObject({
      modelId: SEEDANCE_DEV_FAST_MODEL_ID,
      duration: 2,
      resolutionTier: "480p",
      resolution: "480x864",
      providerResolution: "480p",
    });
  });

  it("requires and validates a public HTTPS source when the live contract is URL-only", () => {
    const urlOnlyModel = structuredClone(model);
    urlOnlyModel.video_capabilities.input_limits.image.supported_sources = ["url"];
    expect(() => resolveSeedanceSmokeConfiguration({
      workspaceRoot: "/workspace",
      model: urlOnlyModel,
    })).toThrow("gateway_video_image_url_required");
    expect(() => resolveSeedanceSmokeConfiguration({
      workspaceRoot: "/workspace",
      model: urlOnlyModel,
      environment: { MOVPROMPT_GATEWAY_VIDEO_IMAGE_URL: "http://example.com/airpods.jpg" },
    })).toThrow("gateway_video_image_url_invalid");
    expect(resolveSeedanceSmokeConfiguration({
      workspaceRoot: "/workspace",
      model: urlOnlyModel,
      environment: { MOVPROMPT_GATEWAY_VIDEO_IMAGE_URL: "https://example.com/airpods.jpg" },
    }).sourceImageUrl).toBe("https://example.com/airpods.jpg");
  });

  it("validates the real Kinza demo image against the live Seedance input contract", async () => {
    const path = resolve(fileURLToPath(new URL("../../../", import.meta.url)), "apps/web/public/create/sample-kinza.jpg");
    const bytes = await readFile(path);
    const dimensions = imageDimensions(bytes, "image/jpeg");
    expect(dimensions).toEqual({ width: 1200, height: 2134 });
    expect(validateSeedanceSourceImage({ model, path, bytes, ...dimensions })).toMatchObject({
      mimeType: "image/jpeg",
      checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
  });

  it("refuses non-MP4 provider output", () => {
    expect(() => assertMp4(new TextEncoder().encode("not a video"))).toThrow("gateway_video_output_not_mp4");
    expect(() => assertMp4(Uint8Array.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]))).not.toThrow();
  });
});
