import { describe, expect, it } from "vitest";

import { generationRuntimeFingerprint } from "./runtime-fingerprint.js";

const runtime = {
  GENERATION_PRICING_VERSION: "seedance-25-canary-2026-08-15",
  GENERATION_QUOTE_TTL_SECONDS: "900",
  GENERATION_VIDEO_CINEMATIC_480P_CREDITS_PER_SECOND: "30",
  GENERATION_VIDEO_CINEMATIC_720P_CREDITS_PER_SECOND: "60",
  GENERATION_VIDEO_PRODUCT_FIDELITY_480P_CREDITS_PER_SECOND: "30",
  GENERATION_VIDEO_PRODUCT_FIDELITY_720P_CREDITS_PER_SECOND: "60",
  MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC_ENABLED: "true",
  MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC_ADAPTER_ID: "vercel-ai-gateway",
  MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC_MODEL_ID: "bytedance/seedance-2.5",
  MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_ENABLED: "true",
  MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_ADAPTER_ID: "vercel-ai-gateway",
  MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_MODEL_ID: "bytedance/seedance-2.5",
  VERCEL_GATEWAY_SEEDANCE_RESOLUTION_TIER: "720p",
};

describe("generationRuntimeFingerprint", () => {
  it("changes when an authoritative pricing input differs", () => {
    const expected = generationRuntimeFingerprint(runtime);

    expect(generationRuntimeFingerprint({
      ...runtime,
      GENERATION_VIDEO_PRODUCT_FIDELITY_720P_CREDITS_PER_SECOND: "61",
    })).not.toBe(expected);
    expect(generationRuntimeFingerprint({
      ...runtime,
      GENERATION_PRICING_VERSION: "next-pricing-version",
    })).not.toBe(expected);
    expect(generationRuntimeFingerprint({
      ...runtime,
      VERCEL_GATEWAY_SEEDANCE_RESOLUTION_TIER: "480p",
    })).not.toBe(expected);
    expect(generationRuntimeFingerprint({
      ...runtime,
      MOVPROMPT_QUALITY_RUBRIC_VERSION: "kuwait-quality-rubric-v2",
    })).not.toBe(expected);
    expect(generationRuntimeFingerprint({ ...runtime, APP_ENV: "local" })).not.toBe(expected);
    expect(generationRuntimeFingerprint({
      ...runtime,
      MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC_MODEL_ID: "bytedance/seedance-v1.0-pro-fast",
    })).not.toBe(expected);
  });

  it("does not include secret values, only their presence", () => {
    expect(generationRuntimeFingerprint({ ...runtime, AI_GATEWAY_API_KEY: "first-secret" })).toBe(
      generationRuntimeFingerprint({ ...runtime, AI_GATEWAY_API_KEY: "second-secret" }),
    );
  });
});
