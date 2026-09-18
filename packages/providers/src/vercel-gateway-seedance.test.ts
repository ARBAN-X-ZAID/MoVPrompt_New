import { describe, expect, it, vi } from "vitest";

import {
  createVercelGatewaySeedanceAdapter,
  VercelGatewayProviderError,
} from "./vercel-gateway-seedance.js";

function adapter(fetcher: typeof fetch) {
  return createVercelGatewaySeedanceAdapter({
    capability: "video.product_fidelity",
    apiKey: "gateway-secret",
    modelId: "bytedance/seedance-2.5",
    baseUrl: "https://gateway.example.test/v4/ai",
    fetcher,
    resolveReferenceUrl: async (reference) => ({
      url: `https://assets.example.test/${reference.objectKey}?signed=1`,
      mediaType: reference.mimeType,
    }),
    resolveFirstFrame: async () => ({
      type: "file",
      data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64"),
      mediaType: "image/jpeg",
    }),
  });
}

function generation() {
  return {
    operationId: "run-1",
    userId: "user-1",
    projectId: "project-1",
    capability: "video.product_fidelity" as const,
    prompt: "A precise premium product reveal with no invented packaging details.",
    durationSeconds: 8,
    aspectRatio: "9:16" as const,
    generateAudio: false,
    references: [{ objectKey: "user/project/product.png", mimeType: "image/png" }],
    idempotencyKey: "provider.submit:run-1:0",
  };
}

describe("Vercel AI Gateway Seedance 2.5 adapter", () => {
  it("permits the explicit local fast model only for the local environment", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      expect(new Headers(init?.headers).get("ai-model-id")).toBe("bytedance/seedance-v1.0-pro-fast");
      return Response.json({ operation: "local-fast-operation" });
    });
    const provider = createVercelGatewaySeedanceAdapter({
      capability: "video.cinematic",
      apiKey: "gateway-secret",
      modelId: "bytedance/seedance-v1.0-pro-fast",
      applicationEnvironment: "local",
      fetcher,
      resolveReferenceUrl: async (reference) => ({ url: `https://assets.example.test/${reference.objectKey}`, mediaType: reference.mimeType }),
      resolveFirstFrame: async () => ({
        type: "file",
        data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64"),
        mediaType: "image/jpeg",
      }),
    });

    await expect(provider.submit({ ...generation(), capability: "video.cinematic", durationSeconds: 2 })).resolves.toMatchObject({ status: "queued" });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(() => createVercelGatewaySeedanceAdapter({
      capability: "video.cinematic",
      apiKey: "gateway-secret",
      modelId: "bytedance/seedance-v1.0-pro-fast",
      applicationEnvironment: "staging",
      fetcher,
      resolveReferenceUrl: async () => ({ url: "https://assets.example.test/ref.png", mediaType: "image/png" }),
      resolveFirstFrame: async () => ({ type: "file", data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64"), mediaType: "image/jpeg" }),
    })).toThrow("vercel_gateway_seedance_fast_model_local_only");
  });

  it("enforces the fast model's two-to-twelve second contract before network submission", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const provider = createVercelGatewaySeedanceAdapter({
      capability: "video.product_fidelity",
      apiKey: "gateway-secret",
      modelId: "bytedance/seedance-v1.0-pro-fast",
      applicationEnvironment: "local",
      fetcher,
      resolveReferenceUrl: async () => ({ url: "https://assets.example.test/ref.png", mediaType: "image/png" }),
      resolveFirstFrame: async () => ({ type: "file", data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64"), mediaType: "image/jpeg" }),
    });
    await expect(provider.submit({ ...generation(), durationSeconds: 1 })).rejects.toMatchObject({ code: "vercel_gateway_duration_unsupported" });
    await expect(provider.submit({ ...generation(), durationSeconds: 13 })).rejects.toMatchObject({ code: "vercel_gateway_duration_unsupported" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("starts product fidelity from a private inline first frame with the exact approved model and idempotency key", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      expect(url).toBe("https://gateway.example.test/v4/ai/video-model/start");
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer gateway-secret");
      expect(headers.get("ai-video-model-specification-version")).toBe("4");
      expect(headers.get("ai-model-id")).toBe("bytedance/seedance-2.5");
      expect(headers.get("idempotency-key")).toBe("provider.submit:run-1:0");
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({
        n: 1,
        resolution: "720p",
        duration: 8,
        fps: 24,
        generateAudio: false,
      });
      expect(body.aspectRatio).toBeUndefined();
      expect(body.providerOptions.gateway.tags).toContain("capability:video.product_fidelity");
      expect(body.providerOptions.bytedance).toEqual({ generateAudio: false });
      expect(body.image).toEqual({
        type: "file",
        data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64"),
        mediaType: "image/jpeg",
      });
      expect(body.inputReferences).toBeUndefined();
      return Response.json({ operation: { provider: "bytedance", taskId: "task-1" } });
    });

    const result = await adapter(fetcher).submit(generation());
    expect(result.status).toBe("queued");
    expect(result.providerRequestId).toMatch(/^vgw4\./u);
  });

  it("round-trips the opaque operation and maps pending, completed, failed and cancelled statuses", async () => {
    const statusResponses = [
      { status: "pending" },
      {
        status: "completed",
        videos: [{ type: "url", url: "https://outputs.example.test/result.mp4", mediaType: "video/mp4" }],
        providerMetadata: {
          gateway: {
            cost: 0.93411,
            generationTime: 183.023,
            generationId: "generation-safe-id",
            routing: { provider: "ByteDance", region: "CDG1" },
          },
          bytedance: { usage: { completion_tokens: 87_300 } },
        },
      },
      { status: "error", error: "provider rejected the prompt" },
      { status: "cancelled" },
    ];
    const fetcher = vi.fn<typeof fetch>(async (url, init) => {
      if (String(url).endsWith("/start")) {
        return Response.json({ operation: { taskId: "task-2", nested: [1, true, null] } });
      }
      const body = JSON.parse(String(init?.body));
      expect(body.operation).toEqual({ taskId: "task-2", nested: [1, true, null] });
      return Response.json(statusResponses.shift());
    });
    const provider = adapter(fetcher);
    const { providerRequestId } = await provider.submit(generation());

    await expect(provider.getStatus(providerRequestId)).resolves.toMatchObject({ status: "processing" });
    await expect(provider.getStatus(providerRequestId)).resolves.toMatchObject({
      status: "completed",
      outputUrl: "https://outputs.example.test/result.mp4",
      telemetry: {
        providerCostMicrousd: 934_110,
        providerLatencyMs: 183_023,
        usage: {
          gateway_generation_id: "generation-safe-id",
          provider_completion_tokens: 87_300,
        },
      },
    });
    await expect(provider.getStatus(providerRequestId)).resolves.toMatchObject({
      status: "failed",
      errorCode: "vercel_gateway_generation_failed",
    });
    await expect(provider.cancel(providerRequestId)).resolves.toMatchObject({ status: "cancelled" });
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/status"))).toHaveLength(4);
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("/cancel"))).toBe(false);
  });

  it("keeps a completed operation without a downloadable result on the same durable reconciliation path", async () => {
    const fetcher = vi.fn<typeof fetch>(async (url) => {
      if (String(url).endsWith("/start")) {
        return Response.json({ operation: { taskId: "task-without-output" } });
      }
      return Response.json({ status: "completed", videos: [] });
    });
    const provider = adapter(fetcher);
    const { providerRequestId } = await provider.submit(generation());

    await expect(provider.getStatus(providerRequestId)).resolves.toEqual({
      providerRequestId,
      status: "processing",
    });
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/start"))).toHaveLength(1);
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/status"))).toHaveLength(1);
  });

  it("inherits the prepared 3:4 canvas for a 4:5 delivery and keeps other references", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.aspectRatio).toBeUndefined();
      expect(body.resolution).toBe("480p");
      expect(body.providerOptions.bytedance).toEqual({
        generateAudio: false,
        referenceVideos: ["https://assets.example.test/user/project/reference.mp4?signed=1"],
      });
      expect(body.image.type).toBe("file");
      expect(body.inputReferences).toBeUndefined();
      return Response.json({ operation: "task-3" });
    });
    await adapter(fetcher).submit({
      ...generation(),
      aspectRatio: "4:5",
      resolution: "480p",
      references: [
        { objectKey: "user/project/product.png", mimeType: "image/png" },
        { objectKey: "user/project/reference.mp4", mimeType: "video/mp4" },
      ],
    });
  });

  it("uses the normalized inline first frame for cinematic generation", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.image).toEqual({
        type: "file",
        data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64"),
        mediaType: "image/jpeg",
      });
      expect(body.aspectRatio).toBeUndefined();
      expect(body.resolution).toBe("720p");
      expect(body.inputReferences).toBeUndefined();
      expect(body.providerOptions.bytedance).toEqual({ generateAudio: false });
      return Response.json({ operation: "cinematic-task" });
    });
    const provider = createVercelGatewaySeedanceAdapter({
      capability: "video.cinematic",
      apiKey: "gateway-secret",
      modelId: "bytedance/seedance-2.5",
      baseUrl: "https://gateway.example.test/v4/ai",
      fetcher,
      resolveReferenceUrl: async (reference) => ({
        url: `https://assets.example.test/${reference.objectKey}?signed=1`,
        mediaType: reference.mimeType,
      }),
      resolveFirstFrame: async () => ({
        type: "file",
        data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64"),
        mediaType: "image/jpeg",
      }),
    });
    await provider.submit({ ...generation(), capability: "video.cinematic" });
  });

  it("fails closed for unapproved models, invalid inputs and permanent gateway validation errors", async () => {
    expect(() => createVercelGatewaySeedanceAdapter({
      capability: "video.cinematic",
      apiKey: "secret",
      modelId: "google/gemini-omni-flash-preview",
      resolveReferenceUrl: async () => ({ url: "https://assets.example.test/ref.png", mediaType: "image/png" }),
      resolveFirstFrame: async () => ({
        type: "file",
        data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64"),
        mediaType: "image/jpeg",
      }),
    })).toThrow("vercel_gateway_seedance_25_model_required");

    const provider = adapter(vi.fn<typeof fetch>(async () => new Response("invalid", { status: 400 })));
    await expect(provider.submit({
      ...generation(),
      references: [
        ...generation().references,
        { objectKey: "malware", mimeType: "application/octet-stream" },
      ],
    })).rejects.toMatchObject({
      code: "vercel_gateway_reference_type_unsupported",
      retryable: false,
    } satisfies Partial<VercelGatewayProviderError>);
    await expect(provider.submit({ ...generation(), references: [] })).rejects.toMatchObject({
      code: "vercel_gateway_product_reference_required",
      retryable: false,
    } satisfies Partial<VercelGatewayProviderError>);
  });

  it("rejects empty, non-JPEG and oversized inline first frames before the billable endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const createWithFrame = (data: string) => createVercelGatewaySeedanceAdapter({
      capability: "video.product_fidelity",
      apiKey: "gateway-secret",
      modelId: "bytedance/seedance-2.5",
      fetcher,
      resolveReferenceUrl: async () => ({ url: "https://assets.example.test/ref.png", mediaType: "image/png" }),
      resolveFirstFrame: async () => ({ type: "file", data, mediaType: "image/jpeg" }),
    });

    await expect(createWithFrame(Buffer.from("not-jpeg").toString("base64")).submit(generation()))
      .rejects.toMatchObject({ code: "vercel_gateway_first_frame_invalid", retryable: false });
    await expect(createWithFrame(Buffer.alloc(8 * 1024 * 1024 + 1, 0xff).toString("base64")).submit(generation()))
      .rejects.toMatchObject({ code: "vercel_gateway_first_frame_invalid", retryable: false });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("never passes a local storage URL upstream", async () => {
    const resolveReferenceUrl = vi.fn(async (reference: { mimeType: string }) => ({
      url: "http://127.0.0.1:9000/creator-assets/private.png",
      mediaType: reference.mimeType,
    }));
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      const serialized = String(init?.body);
      expect(serialized).not.toContain("127.0.0.1");
      expect(serialized).not.toContain("localhost");
      expect(JSON.parse(serialized).image.type).toBe("file");
      return Response.json({ operation: "inline-only" });
    });
    const provider = createVercelGatewaySeedanceAdapter({
      capability: "video.product_fidelity",
      apiKey: "gateway-secret",
      modelId: "bytedance/seedance-2.5",
      fetcher,
      resolveReferenceUrl,
      resolveFirstFrame: async () => ({
        type: "file",
        data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64"),
        mediaType: "image/jpeg",
      }),
    });

    await provider.submit(generation());
    expect(resolveReferenceUrl).not.toHaveBeenCalled();

    await expect(provider.submit({
      ...generation(),
      references: [
        ...generation().references,
        { objectKey: "private-reference.mp4", mimeType: "video/mp4" },
      ],
    })).rejects.toMatchObject({ code: "vercel_gateway_reference_url_invalid", retryable: false });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("treats malformed start responses as retryable because retries reuse the same billable idempotency key", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ unexpected: true }));
    await expect(adapter(fetcher).submit(generation())).rejects.toMatchObject({
      code: "vercel_gateway_start_response_invalid",
      retryable: true,
    } satisfies Partial<VercelGatewayProviderError>);
  });
});
