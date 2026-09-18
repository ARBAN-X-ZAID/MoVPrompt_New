import { describe, expect, it, vi } from "vitest";

import { BytePlusProviderError, createBytePlusSeedanceAdapter } from "./byteplus-seedance.js";

function adapter(fetcher: typeof fetch) {
  return createBytePlusSeedanceAdapter({
    capability: "video.product_fidelity",
    apiKey: "secret",
    modelId: "dreamina-seedance-2-0-260128",
    baseUrl: "https://ark.example.test/api/v3",
    fetcher,
    resolveReferenceUrl: async (reference) => ({
      url: `https://assets.example.test/${reference.objectKey}`,
      mediaType: reference.mimeType,
    }),
  });
}

describe("BytePlus Seedance adapter", () => {
  it("submits a durable multimodal task without exposing the model through public contracts", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("dreamina-seedance-2-0-260128");
      expect(body.content).toEqual([
        { type: "text", text: "premium reveal" },
        { type: "image_url", image_url: { url: "https://assets.example.test/product/key" }, role: "reference_image" },
      ]);
      expect(body.generate_audio).toBe(true);
      expect(body.watermark).toBe(false);
      return Response.json({ id: "task-1" });
    });
    const submission = await adapter(fetcher).submit({
      operationId: "run-1",
      userId: "user-1",
      projectId: "project-1",
      capability: "video.product_fidelity",
      prompt: "premium reveal",
      durationSeconds: 8,
      aspectRatio: "9:16",
      references: [{ objectKey: "product/key", mimeType: "image/png" }],
      idempotencyKey: "provider.submit:run-1:0",
    });
    expect(submission).toMatchObject({ providerRequestId: "task-1", status: "queued" });
  });

  it("maps queued, running, succeeded and failed provider states", async () => {
    const responses = [
      { id: "task-1", status: "queued" },
      { id: "task-1", status: "running" },
      { id: "task-1", status: "succeeded", content: { video_url: "https://media.example.test/out.mp4" } },
      { id: "task-1", status: "failed", error: { code: "BadPrompt", message: "Rejected" } },
    ];
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(responses.shift()));
    const provider = adapter(fetcher);
    await expect(provider.getStatus("task-1")).resolves.toMatchObject({ status: "queued" });
    await expect(provider.getStatus("task-1")).resolves.toMatchObject({ status: "processing" });
    await expect(provider.getStatus("task-1")).resolves.toMatchObject({ status: "completed", outputUrl: "https://media.example.test/out.mp4" });
    await expect(provider.getStatus("task-1")).resolves.toMatchObject({ status: "failed", errorCode: "BadPrompt" });
  });

  it("allows each render to disable native audio for deterministic voice-over", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.generate_audio).toBe(false);
      return Response.json({ id: "task-no-native-audio" });
    });
    await adapter(fetcher).submit({
      operationId: "run-voiceover",
      userId: "user-1",
      projectId: "project-1",
      capability: "video.product_fidelity",
      prompt: "clean product b-roll",
      references: [],
      generateAudio: false,
      idempotencyKey: "provider.submit:run-voiceover:0",
    });
  });

  it("marks rate limits retryable but validation failures permanent", async () => {
    const provider = adapter(vi.fn<typeof fetch>(async () => new Response("busy", { status: 429 })));
    await expect(provider.getStatus("task-1")).rejects.toMatchObject({
      code: "byteplus_http_429",
      retryable: true,
    } satisfies Partial<BytePlusProviderError>);
    await expect(provider.submit({
      operationId: "run-1", userId: "user-1", projectId: "project-1", capability: "video.product_fidelity", prompt: "test", durationSeconds: 30,
      references: [], idempotencyKey: "key",
    })).rejects.toMatchObject({ code: "byteplus_duration_unsupported", retryable: false });
  });
});
