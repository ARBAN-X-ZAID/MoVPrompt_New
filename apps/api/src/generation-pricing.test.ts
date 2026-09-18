import { describe, expect, it } from "vitest";

import {
  createGenerationPricingFromEnvironment,
  GenerationPricingUnavailableError,
  InvalidGenerationConfigurationError,
} from "./generation-pricing.js";

function tieredPricing() {
  return createGenerationPricingFromEnvironment({
    GENERATION_PRICING_VERSION: "seedance-25-v1",
    GENERATION_QUOTE_TTL_SECONDS: "900",
    GENERATION_VIDEO_PRODUCT_FIDELITY_480P_CREDITS_PER_SECOND: "5",
    GENERATION_VIDEO_PRODUCT_FIDELITY_720P_CREDITS_PER_SECOND: "11",
  });
}

describe("authoritative resolution-bound generation pricing", () => {
  it("creates zero-credit internal quotes only for explicit local development", () => {
    const pricing = createGenerationPricingFromEnvironment({
      APP_ENV: "local",
      DEVELOPMENT_FREE_GENERATION: "true",
      MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_MODEL_ID: "bytedance/seedance-v1.0-pro-fast",
    });

    expect(pricing.mode).toBe("development-free");
    expect(pricing.isAvailable("video.product_fidelity")).toBe(true);
    expect(pricing.price("video.product_fidelity", { durationSeconds: 8, resolution: "720p" })).toEqual({
      credits: 0,
      breakdown: [{ label: "Local development 8s 720p video", credits: 0 }],
    });
  });

  it("does not enable free generation outside the local environment", () => {
    const pricing = createGenerationPricingFromEnvironment({
      APP_ENV: "production",
      DEVELOPMENT_FREE_GENERATION: "true",
    });

    expect(pricing.mode).toBe("paid");
    expect(pricing.isAvailable("video.product_fidelity")).toBe(false);
  });

  it("binds local fast-model quotes to its two-to-twelve second contract", () => {
    const pricing = createGenerationPricingFromEnvironment({
      APP_ENV: "local",
      GENERATION_PRICING_VERSION: "seedance-fast-local-2026-08-21",
      GENERATION_QUOTE_TTL_SECONDS: "900",
      MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_MODEL_ID: "bytedance/seedance-v1.0-pro-fast",
      GENERATION_VIDEO_PRODUCT_FIDELITY_480P_CREDITS_PER_SECOND: "3",
      GENERATION_VIDEO_PRODUCT_FIDELITY_720P_CREDITS_PER_SECOND: "3",
    });
    expect(pricing.price("video.product_fidelity", { durationSeconds: 2, resolution: "480p" }).credits).toBe(6);
    expect(pricing.price("video.product_fidelity", { durationSeconds: 12, resolution: "720p" }).credits).toBe(36);
    for (const durationSeconds of [1, 13]) {
      expect(() => pricing.price("video.product_fidelity", { durationSeconds, resolution: "480p" }))
        .toThrowError(InvalidGenerationConfigurationError);
    }
  });

  it("quotes 480p and 720p from distinct server rates", () => {
    const pricing = tieredPricing();
    expect(pricing.price("video.product_fidelity", {
      prompt: "Product reveal",
      durationSeconds: 8,
      resolution: "480p",
    })).toEqual({
      credits: 40,
      breakdown: [{ label: "8 seconds of 480p generated video", credits: 40 }],
    });
    expect(pricing.price("video.product_fidelity", {
      prompt: "Product reveal",
      durationSeconds: 8,
      resolution: "720p",
    })).toEqual({
      credits: 88,
      breakdown: [{ label: "8 seconds of 720p generated video", credits: 88 }],
    });
  });

  it("fails closed when a requested resolution has no configured rate", () => {
    const pricing = createGenerationPricingFromEnvironment({
      GENERATION_PRICING_VERSION: "seedance-25-v1",
      GENERATION_QUOTE_TTL_SECONDS: "900",
      GENERATION_VIDEO_PRODUCT_FIDELITY_720P_CREDITS_PER_SECOND: "11",
    });
    expect(() => pricing.price("video.product_fidelity", {
      prompt: "Product reveal",
      durationSeconds: 8,
      resolution: "480p",
    })).toThrowError(GenerationPricingUnavailableError);
  });

  it("allows a legacy single rate only when its fixed worker resolution matches", () => {
    const pricing = createGenerationPricingFromEnvironment({
      GENERATION_PRICING_VERSION: "legacy-v1",
      GENERATION_QUOTE_TTL_SECONDS: "900",
      GENERATION_VIDEO_FIXED_RESOLUTION: "720p",
      GENERATION_VIDEO_PRODUCT_FIDELITY_CREDITS_PER_SECOND: "10",
    });
    expect(pricing.price("video.product_fidelity", {
      prompt: "Product reveal",
      durationSeconds: 4,
      resolution: "720p",
    }).credits).toBe(40);
    expect(() => pricing.price("video.product_fidelity", {
      prompt: "Product reveal",
      durationSeconds: 4,
      resolution: "480p",
    })).toThrowError(GenerationPricingUnavailableError);
  });
});
