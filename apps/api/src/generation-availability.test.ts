import { CapabilityRegistry, createCapabilityRegistryFromEnvironment, generationRuntimeFingerprint } from "@movprompt/providers";
import { describe, expect, it, vi } from "vitest";

import { createGenerationAvailabilityService } from "./generation-availability.js";
import { createGenerationPricingFromEnvironment } from "./generation-pricing.js";

const baseEnvironment = {
  AI_GATEWAY_API_KEY: "secret-present",
  VERCEL_AI_GATEWAY_BASE_URL: "https://ai-gateway.vercel.sh/v4/ai",
  MOVPROMPT_PROVIDER_VERCEL_GATEWAY_READY: "true",
  MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC_ENABLED: "true",
  MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC_ADAPTER_ID: "vercel-ai-gateway",
  MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC_MODEL_ID: "bytedance/seedance-2.5",
  MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_ENABLED: "true",
  MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_ADAPTER_ID: "vercel-ai-gateway",
  MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_MODEL_ID: "bytedance/seedance-2.5",
  PROVIDER_OUTPUT_ALLOWED_HOSTS: "outputs.example.test",
  MOVPROMPT_QUALITY_MODEL_ID: "google/gemini-3.6-flash",
  FFMPEG_PATH: "ffmpeg",
  FFPROBE_PATH: "ffprobe",
  R2_ACCOUNT_ID: "https://storage.example.test",
  R2_TEMPLATE_PREVIEWS_BASE_URL: "auto",
  R2_ACCESS_KEY_ID: "present",
  R2_SECRET_ACCESS_KEY: "present",
  R2_ASSETS_BUCKET: "creator-assets",
  R2_OUTPUTS_BUCKET: "creator-outputs",
  GENERATION_PRICING_VERSION: "seedance-25-canary-2026-08-15",
  GENERATION_QUOTE_TTL_SECONDS: "900",
  GENERATION_VIDEO_CINEMATIC_480P_CREDITS_PER_SECOND: "10",
  GENERATION_VIDEO_CINEMATIC_720P_CREDITS_PER_SECOND: "20",
  GENERATION_VIDEO_PRODUCT_FIDELITY_480P_CREDITS_PER_SECOND: "10",
  GENERATION_VIDEO_PRODUCT_FIDELITY_720P_CREDITS_PER_SECOND: "20",
} as const;

function capabilities() {
  return new CapabilityRegistry({
    "video.cinematic": { enabled: true, adapterId: "vercel-ai-gateway", providerModelId: "private" },
    "video.product_fidelity": { enabled: true, adapterId: "vercel-ai-gateway", providerModelId: "private" },
  });
}

function service(environment: Record<string, string | undefined> = { ...baseEnvironment }) {
  return createGenerationAvailabilityService({
    enabled: true,
    environment,
    capabilities: capabilities(),
    pricing: createGenerationPricingFromEnvironment(environment),
    storage: { checkBuckets: vi.fn(async () => undefined) },
    heartbeats: {
      findFreshReady: vi.fn(async () => ({
        instanceId: "worker-1",
        lastSeenAt: new Date(),
        metadata: {
          generationReady: true,
          configurationFingerprint: generationRuntimeFingerprint(environment),
        },
      })),
    },
  });
}

describe("generation availability", () => {
  it("requires an identically fingerprinted worker for a complete local fast-model profile", async () => {
    const environment = {
      ...baseEnvironment,
      APP_ENV: "local",
      MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC_MODEL_ID: "bytedance/seedance-v1.0-pro-fast",
      MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_MODEL_ID: "bytedance/seedance-v1.0-pro-fast",
      PROVIDER_OUTPUT_ALLOWED_HOSTS: "ark-content-generation-ap-southeast-1.tos-ap-southeast-1.volces.com",
      GENERATION_PRICING_VERSION: "seedance-fast-local-2026-08-21",
      GENERATION_VIDEO_CINEMATIC_480P_CREDITS_PER_SECOND: "3",
      GENERATION_VIDEO_CINEMATIC_720P_CREDITS_PER_SECOND: "3",
      GENERATION_VIDEO_PRODUCT_FIDELITY_480P_CREDITS_PER_SECOND: "3",
      GENERATION_VIDEO_PRODUCT_FIDELITY_720P_CREDITS_PER_SECOND: "3",
    };
    const ready = createGenerationAvailabilityService({
      enabled: true,
      environment,
      capabilities: createCapabilityRegistryFromEnvironment(environment),
      pricing: createGenerationPricingFromEnvironment(environment),
      storage: { checkBuckets: vi.fn(async () => undefined) },
      heartbeats: { findFreshReady: vi.fn(async () => ({
        instanceId: "local-fast-worker",
        lastSeenAt: new Date(),
        metadata: { generationReady: true, configurationFingerprint: generationRuntimeFingerprint(environment) },
      })) },
    });
    await expect(ready.evaluate()).resolves.toMatchObject({ status: "ready" });
    expect(createCapabilityRegistryFromEnvironment({ ...environment, APP_ENV: "production" }).listPublic()
      .find((item) => item.alias === "video.cinematic")?.available).toBe(false);
  });

  it("requires both pricing tiers and an identically configured fresh worker", async () => {
    await expect(service().evaluate()).resolves.toEqual({
      status: "ready",
      reason: null,
      retryable: false,
    });

    const missingTier = { ...baseEnvironment, GENERATION_VIDEO_PRODUCT_FIDELITY_480P_CREDITS_PER_SECOND: "" };
    await expect(service(missingTier).evaluate()).resolves.toMatchObject({
      status: "unavailable",
      reason: "pricing_unavailable",
    });
  });

  it("reports disabled and quality failures without exposing diagnostics", async () => {
    const disabled = createGenerationAvailabilityService({
      enabled: false,
      environment: baseEnvironment,
      capabilities: capabilities(),
      pricing: createGenerationPricingFromEnvironment(baseEnvironment),
      storage: { checkBuckets: vi.fn(async () => undefined) },
      heartbeats: { findFreshReady: vi.fn(async () => null) },
    });
    await expect(disabled.evaluate()).resolves.toEqual({
      status: "unavailable",
      reason: "disabled",
      retryable: false,
    });

    await expect(service({ ...baseEnvironment, MOVPROMPT_QUALITY_MODEL_ID: "" }).evaluate())
      .resolves.toMatchObject({ reason: "quality_unavailable" });
  });

  it("pauses new generation when the worker is stale or configured differently", async () => {
    const stale = createGenerationAvailabilityService({
      enabled: true,
      environment: baseEnvironment,
      capabilities: capabilities(),
      pricing: createGenerationPricingFromEnvironment(baseEnvironment),
      storage: { checkBuckets: vi.fn(async () => undefined) },
      heartbeats: { findFreshReady: vi.fn(async () => null) },
    });
    await expect(stale.evaluate()).resolves.toMatchObject({
      status: "unavailable",
      reason: "worker_unavailable",
      retryable: true,
    });

    const mismatched = createGenerationAvailabilityService({
      enabled: true,
      environment: baseEnvironment,
      capabilities: capabilities(),
      pricing: createGenerationPricingFromEnvironment(baseEnvironment),
      storage: { checkBuckets: vi.fn(async () => undefined) },
      heartbeats: {
        findFreshReady: vi.fn(async () => ({
          instanceId: "worker-2",
          lastSeenAt: new Date(),
          metadata: { generationReady: true, configurationFingerprint: "different" },
        })),
      },
    });
    await expect(mismatched.evaluate()).resolves.toMatchObject({ reason: "worker_unavailable" });
  });
});
