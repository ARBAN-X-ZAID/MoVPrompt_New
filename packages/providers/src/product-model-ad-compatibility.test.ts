import { describe, expect, it, vi } from "vitest";
import { createVercelGatewaySeedanceAdapter } from "./vercel-gateway-seedance.js";
const request = { operationId: "unpaid-test", userId: "user", projectId: "project", capability: "video.cinematic" as const, prompt: "A silent product commercial", durationSeconds: 8, aspectRatio: "9:16" as const, generateAudio: false, seed: 123456, references: [{ objectKey: "product.png", mimeType: "image/png" }], idempotencyKey: "unpaid:test" };
function provider(modelId: string, fetcher: typeof fetch) {
  return createVercelGatewaySeedanceAdapter({ capability: "video.cinematic", apiKey: "unpaid-fixture-key", applicationEnvironment: "local", modelId, fetcher,
    resolveReferenceUrl: async photo => ({ url: `https://example.test/${photo.objectKey}`, mediaType: photo.mimeType }),
    resolveFirstFrame: async () => ({ type: "file", data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64"), mediaType: "image/jpeg" }),
  });
}
describe("unpaid Seedance model compatibility", () => {
  it("constructs the existing Seedance 1.0 local 8s request without a real API call", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      expect(new Headers(init?.headers).get("ai-model-id")).toBe("bytedance/seedance-v1.0-pro-fast");
      const body = JSON.parse(String(init?.body));
      expect(body.duration).toBe(8); expect(body.image).toMatchObject({ type: "file" }); expect(body.aspectRatio).toBeUndefined();
      expect(body.providerOptions.bytedance).toMatchObject({ generateAudio: false, seed: 123456 });
      expect(body.providerOptions.bytedance.referenceImages).toBeUndefined();
      return Response.json({ operation: "unpaid-fixture-operation" });
    });
    await provider("bytedance/seedance-v1.0-pro-fast", fetcher).submit(request); expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each([15, 20])("rejects %is on Seedance 1.0 before provider submission", async durationSeconds => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(provider("bytedance/seedance-v1.0-pro-fast", fetcher).submit({ ...request, durationSeconds })).rejects.toMatchObject({ code: "vercel_gateway_duration_unsupported" }); expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects separate product/model references and required-model substitution on 1.0", async () => {
    const fetcher = vi.fn<typeof fetch>(); const adapter = provider("bytedance/seedance-v1.0-pro-fast", fetcher);
    await expect(adapter.submit({ ...request, referenceMode: "references", references: [...request.references, { objectKey: "model.png", mimeType: "image/png" }] })).rejects.toMatchObject({ code: "vercel_gateway_reference_mode_unavailable" });
    await expect(adapter.submit({ ...request, requiredModelId: "bytedance/seedance-2.5" })).rejects.toMatchObject({ code: "vercel_gateway_required_model_unavailable" }); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([8, 15, 20])("transmits exact product/model reference order at %is through Vercel", async durationSeconds => {
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      expect(new Headers(init?.headers).get("ai-model-id")).toBe("bytedance/seedance-2.5"); expect(body.image).toBeUndefined();
      expect(body.providerOptions.bytedance.referenceImages).toEqual(["https://example.test/product.png", "https://example.test/model.png"]);
      expect(body.providerOptions.bytedance).toMatchObject({ generateAudio: false, seed: 123456 }); return Response.json({ operation: "unpaid-fixture-operation" });
    });
    await provider("bytedance/seedance-2.5", fetcher).submit({ ...request, durationSeconds, referenceMode: "references", requiredModelId: "bytedance/seedance-2.5", references: [...request.references, { objectKey: "model.png", mimeType: "image/png" }] });
  });
});
