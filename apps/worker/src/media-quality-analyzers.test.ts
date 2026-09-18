import { describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";

import {
  createFfprobeTechnicalAnalyzer,
  createGatewayVideoQualityAnalyzer,
  type QualityMediaStorage,
} from "./media-quality-analyzers.js";

const candidate = { bucket: "outputs", objectKey: "video.mp4", runId: "run", projectId: "project", projectVersionId: "version" };
const storage: QualityMediaStorage = {
  assetsBucket: "assets",
  signDownload: async ({ bucket, key }) => ({ url: `https://storage.test/${bucket}/${key}` }),
};

describe("media quality analyzers", () => {
  it("scores a valid H264/AAC delivery from ffprobe evidence", async () => {
    const analyzer = createFfprobeTechnicalAnalyzer({
      storage,
      probe: vi.fn(async () => ({
        streams: [
          { codec_type: "video", codec_name: "h264", width: 1080, height: 1920, avg_frame_rate: "30/1" },
          { codec_type: "audio", codec_name: "aac" },
        ],
        format: { duration: "8.02", format_name: "mov,mp4" },
      })),
    });
    await expect(analyzer.analyze({ candidate, attemptNumber: 0, configuration: { generation: { durationSeconds: 8, resolution: "720p", aspectRatio: "9:16", audio: true } } }))
      .resolves.toEqual([{ dimension: "technical", score: 100, hardFailure: false, evidence: "valid_mp4_h264_delivery" }]);
  });

  it("accepts a true 480p portrait output and rejects ratio or audio-toggle mismatches", async () => {
    const valid = createFfprobeTechnicalAnalyzer({
      storage,
      probe: vi.fn(async () => ({
        streams: [{ codec_type: "video", codec_name: "h264", width: 480, height: 854, avg_frame_rate: "24/1" }],
        format: { duration: "4.0", format_name: "mov,mp4" },
      })),
    });
    await expect(valid.analyze({
      candidate,
      attemptNumber: 0,
      configuration: { generation: { durationSeconds: 4, resolution: "480p", aspectRatio: "9:16", audio: false } },
    })).resolves.toEqual([{ dimension: "technical", score: 100, hardFailure: false, evidence: "valid_mp4_h264_delivery" }]);

    const mismatched = createFfprobeTechnicalAnalyzer({
      storage,
      probe: vi.fn(async () => ({
        streams: [
          { codec_type: "video", codec_name: "h264", width: 1280, height: 720, avg_frame_rate: "24/1" },
          { codec_type: "audio", codec_name: "aac" },
        ],
        format: { duration: "4.0", format_name: "mov,mp4" },
      })),
    });
    const result = await mismatched.analyze({
      candidate,
      attemptNumber: 0,
      configuration: { generation: { durationSeconds: 4, resolution: "720p", aspectRatio: "9:16", audio: false } },
    });
    expect(result[0]).toMatchObject({ hardFailure: true });
    expect(result[0]?.evidence).toContain("aspect_ratio_mismatch");
    expect(result[0]?.evidence).toContain("muted_campaign_contains_audio");
  });

  it("fails closed when the media cannot be probed", async () => {
    const analyzer = createFfprobeTechnicalAnalyzer({ storage, probe: vi.fn(async () => { throw new Error("invalid media"); }) });
    const result = await analyzer.analyze({ candidate, attemptNumber: 0, configuration: {} });
    expect(result[0]).toMatchObject({ dimension: "technical", score: 0, hardFailure: true });
  });

  it("fails closed when the exact private delivery object cannot fully decode", async () => {
    const analyzer = createFfprobeTechnicalAnalyzer({
      storage,
      probe: vi.fn(async () => ({
        streams: [{ codec_type: "video", codec_name: "h264", width: 1080, height: 1920, avg_frame_rate: "24/1" }],
        format: { duration: "8.0", format_name: "mov,mp4" },
      })),
      decode: vi.fn(async () => { throw new Error("truncated delivery object"); }),
    });

    await expect(analyzer.analyze({
      candidate,
      attemptNumber: 0,
      configuration: { generation: { durationSeconds: 8, resolution: "720p", aspectRatio: "9:16", audio: false } },
    })).resolves.toEqual([expect.objectContaining({
      dimension: "technical",
      score: 0,
      hardFailure: true,
      evidence: "truncated delivery object",
    })]);
  });

  const dimensions = [
    "product_identity", "prompt_adherence", "motion_realism", "visual_artifacts",
    "brand_safety", "dialect_fidelity", "speech_sync", "safe_zones", "compliance",
  ] as const;
  const scores = Object.fromEntries(dimensions.map((key) => [key, 95]));
  const evidence = Object.fromEntries(dimensions.map((key) => [key, `00:01 ${key} checked`]));

  function model(judgment: unknown = { scores, evidence }) {
    return new MockLanguageModelV4({
      doGenerate: {
        content: [{ type: "text", text: JSON.stringify(judgment) }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 10, text: 10, reasoning: 0 },
        },
        warnings: [],
      },
    });
  }

  it("submits one bounded video FilePart and at most five product references for structured Gateway review", async () => {
    const media = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]);
    const fetcher = vi.fn<typeof fetch>(async () => new Response(media, { status: 200 }));
    const languageModel = model();
    const analyzer = createGatewayVideoQualityAnalyzer({
      storage,
      apiKey: "gateway-secret",
      modelId: "google/gemini-3.6-flash",
      fetcher,
      languageModel,
    });
    const result = await analyzer.analyze({
      candidate,
      attemptNumber: 0,
      configuration: {
        generation: {
          references: Array.from({ length: 7 }, (_, index) => ({
            objectKey: `product-${index}.png`,
            mimeType: "image/png",
          })),
          creativeBrief: { language: "ar" },
        },
      },
    });
    expect(result).toHaveLength(9);
    expect(result[0]).toMatchObject({ dimension: "product_identity", score: 95 });
    expect(fetcher).toHaveBeenCalledTimes(6);

    const call = languageModel.doGenerateCalls[0]!;
    const promptContent = call.prompt[0]!.content;
    expect(Array.isArray(promptContent)).toBe(true);
    const parts = Array.isArray(promptContent) ? promptContent : [];
    expect(parts.filter((part) => part.type === "file" && part.mediaType === "video/mp4")).toHaveLength(1);
    expect(parts.filter((part) => part.type === "file" && part.mediaType === "image/png")).toHaveLength(5);
    expect(call.responseFormat).toMatchObject({ type: "json" });
    expect(call.temperature).toBe(0);
    expect(call.providerOptions).toMatchObject({
      gateway: { tags: ["feature:video-quality", "service:movprompt-worker"] },
    });
  });

  it("fails closed before Gateway when downloaded media exceeds its byte budget", async () => {
    const languageModel = model();
    const fetcher = vi.fn<typeof fetch>(async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.enqueue(new Uint8Array([4, 5, 6]));
        controller.close();
      },
    }), { status: 200 }));
    const analyzer = createGatewayVideoQualityAnalyzer({
      storage,
      apiKey: "gateway-secret",
      modelId: "google/gemini-3.6-flash",
      fetcher,
      languageModel,
      maxVideoBytes: 5,
    });

    await expect(analyzer.analyze({ candidate, attemptNumber: 0, configuration: {} }))
      .rejects.toThrow("quality_media_too_large");
    expect(languageModel.doGenerateCalls).toHaveLength(0);
  });

  it("rejects invalid Gateway configuration and unsupported reference media", async () => {
    expect(() => createGatewayVideoQualityAnalyzer({
      storage,
      apiKey: "",
      modelId: "google/gemini-3.6-flash",
    })).toThrow("gateway_quality_api_key_required");
    expect(() => createGatewayVideoQualityAnalyzer({
      storage,
      apiKey: "secret",
      modelId: "gemini-3.6-flash",
    })).toThrow("gateway_quality_model_invalid");
    expect(() => createGatewayVideoQualityAnalyzer({
      storage,
      apiKey: "secret",
      modelId: "google/gemini-3.6-flash",
      gatewayBaseUrl: "https://proxy.example.test/v4/ai",
    })).toThrow("gateway_quality_base_url_invalid");
    expect(() => createGatewayVideoQualityAnalyzer({
      storage,
      apiKey: "secret",
      modelId: "google/gemini-3.6-flash",
      maxVideoBytes: 18 * 1024 * 1024 + 1,
    })).toThrow("gateway_quality_video_limit_invalid");

    const analyzer = createGatewayVideoQualityAnalyzer({
      storage,
      apiKey: "secret",
      modelId: "google/gemini-3.6-flash",
      fetcher: vi.fn(async () => new Response(new Uint8Array([1]), { status: 200 })),
      languageModel: model(),
    });
    await expect(analyzer.analyze({
      candidate,
      attemptNumber: 0,
      configuration: { generation: { references: [{ objectKey: "product.svg", mimeType: "image/svg+xml" }] } },
    })).rejects.toThrow("quality_reference_media_type_unsupported:image/svg+xml");
  });

  it("fails closed when structured evidence is missing", async () => {
    const analyzer = createGatewayVideoQualityAnalyzer({
      storage,
      apiKey: "gateway-secret",
      modelId: "google/gemini-3.6-flash",
      fetcher: vi.fn(async () => new Response(new Uint8Array([1]), { status: 200 })),
      languageModel: model({ scores, evidence: {} }),
    });
    await expect(analyzer.analyze({ candidate, attemptNumber: 0, configuration: {} }))
      .rejects.toThrow(/No object generated|response did not match schema/u);
  });
});
