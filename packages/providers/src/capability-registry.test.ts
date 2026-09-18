import { describe, expect, it } from "vitest";
import {
  CapabilityRegistry,
  CapabilityResolutionError,
  createCapabilityRegistryFromEnvironment,
} from "./capability-registry.js";

describe("CapabilityRegistry", () => {
  it("only advertises the fast Vercel model for a complete local profile", () => {
    const localFastProfile = {
      APP_ENV: "local",
      MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC_ENABLED: "true",
      MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC_ADAPTER_ID: "vercel-ai-gateway",
      MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC_MODEL_ID: "bytedance/seedance-v1.0-pro-fast",
      MOVPROMPT_PROVIDER_VERCEL_GATEWAY_READY: "true",
      AI_GATEWAY_API_KEY: "secret",
      VERCEL_AI_GATEWAY_BASE_URL: "https://ai-gateway.vercel.sh/v4/ai",
      PROVIDER_OUTPUT_ALLOWED_HOSTS: "ark-content-generation-ap-southeast-1.tos-ap-southeast-1.volces.com",
      R2_ACCOUNT_ID: "https://storage.example.test",
      R2_TEMPLATE_PREVIEWS_BASE_URL: "",
      R2_ACCESS_KEY_ID: "access",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_ASSETS_BUCKET: "creator-assets",
      R2_OUTPUTS_BUCKET: "creator-outputs",
      FFMPEG_PATH: "ffmpeg",
      FFPROBE_PATH: "ffprobe",
      MOVPROMPT_QUALITY_MODEL_ID: "google/gemini-3.6-flash",
    };
    expect(createCapabilityRegistryFromEnvironment(localFastProfile).listPublic()
      .find((item) => item.alias === "video.cinematic")?.available).toBe(true);
    expect(createCapabilityRegistryFromEnvironment({ ...localFastProfile, APP_ENV: "staging" }).listPublic()
      .find((item) => item.alias === "video.cinematic")?.available).toBe(false);
  });

  it("resolves configured approved aliases", () => {
    const registry = new CapabilityRegistry({
      "video.cinematic": {
        enabled: true,
        adapterId: "approved-seedance-adapter",
        providerModelId: "server-private-model-id",
      },
    });

    expect(registry.resolve("video.cinematic", "video")).toEqual({
      alias: "video.cinematic",
      kind: "video",
      adapterId: "approved-seedance-adapter",
      providerModelId: "server-private-model-id",
    });
  });

  it("rejects raw provider IDs and unknown families", () => {
    const registry = new CapabilityRegistry();

    for (const value of ["seedance-2.0-ref", "video.kling.latest", "fal-ai/veo3"]) {
      expect(() => registry.resolve(value)).toThrowError(CapabilityResolutionError);
    }
  });

  it("never exposes provider configuration in the public list", () => {
    const registry = new CapabilityRegistry({
      "image.product": {
        enabled: true,
        adapterId: "google",
        providerModelId: "private-model-id",
      },
    });

    const serialized = JSON.stringify(registry.listPublic());
    expect(serialized).not.toContain("google");
    expect(serialized).not.toContain("private-model-id");
    expect(serialized).toContain("image.product");
  });

  it("fails closed when environment configuration is incomplete", () => {
    const registry = createCapabilityRegistryFromEnvironment({
      MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_ENABLED: "true",
      MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_ADAPTER_ID: "product-video",
    });

    expect(
      registry.listPublic().find((item) => item.alias === "video.product_fidelity")?.available,
    ).toBe(false);
    expect(() => registry.resolve("video.product_fidelity")).toThrowError(
      "capability_unavailable",
    );
  });

  it("does not advertise BytePlus until the full provider and quality pipeline is ready", () => {
    const base = {
      MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC_ENABLED: "true",
      MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC_ADAPTER_ID: "byteplus-modelark",
      MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC_MODEL_ID: "dreamina-seedance-2-0-260128",
    };
    expect(createCapabilityRegistryFromEnvironment(base).listPublic()
      .find((item) => item.alias === "video.cinematic")?.available).toBe(false);
    expect(createCapabilityRegistryFromEnvironment({
      ...base,
      MOVPROMPT_PROVIDER_BYTEPLUS_READY: "true",
    }).listPublic().find((item) => item.alias === "video.cinematic")?.available).toBe(true);
  });

  it("does not advertise Vercel Gateway until the worker pipeline is explicitly ready", () => {
    const base = {
      MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_ENABLED: "true",
      MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_ADAPTER_ID: "vercel-ai-gateway",
      MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_MODEL_ID: "bytedance/seedance-2.5",
    };
    expect(createCapabilityRegistryFromEnvironment(base).listPublic()
      .find((item) => item.alias === "video.product_fidelity")?.available).toBe(false);
    expect(createCapabilityRegistryFromEnvironment({
      ...base,
      MOVPROMPT_PROVIDER_VERCEL_GATEWAY_READY: "true",
      AI_GATEWAY_API_KEY: "secret",
      VERCEL_AI_GATEWAY_BASE_URL: "https://ai-gateway.vercel.sh/v4/ai",
      PROVIDER_OUTPUT_ALLOWED_HOSTS: "ark-acg-ap-southeast-1.tos-ap-southeast-1.volces.com",
      R2_ACCOUNT_ID: "https://storage.example.test",
      R2_TEMPLATE_PREVIEWS_BASE_URL: "auto",
      R2_ACCESS_KEY_ID: "access",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_ASSETS_BUCKET: "creator-assets",
      R2_OUTPUTS_BUCKET: "creator-outputs",
      FFMPEG_PATH: "ffmpeg",
      FFPROBE_PATH: "ffprobe",
      MOVPROMPT_QUALITY_MODEL_ID: "google/gemini-3.6-flash",
    }).listPublic().find((item) => item.alias === "video.product_fidelity")?.available).toBe(true);

    expect(createCapabilityRegistryFromEnvironment({
      ...base,
      MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_MODEL_ID: "bytedance/seedance-2.0",
      MOVPROMPT_PROVIDER_VERCEL_GATEWAY_READY: "true",
      AI_GATEWAY_API_KEY: "secret",
      VERCEL_AI_GATEWAY_BASE_URL: "https://ai-gateway.vercel.sh/v4/ai",
      PROVIDER_OUTPUT_ALLOWED_HOSTS: "ark-acg-ap-southeast-1.tos-ap-southeast-1.volces.com",
      R2_ACCOUNT_ID: "https://storage.example.test",
      R2_TEMPLATE_PREVIEWS_BASE_URL: "auto",
      R2_ACCESS_KEY_ID: "access",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_ASSETS_BUCKET: "creator-assets",
      R2_OUTPUTS_BUCKET: "creator-outputs",
      FFMPEG_PATH: "ffmpeg",
      FFPROBE_PATH: "ffprobe",
      MOVPROMPT_QUALITY_MODEL_ID: "google/gemini-3.6-flash",
    }).listPublic().find((item) => item.alias === "video.product_fidelity")?.available).toBe(false);

    expect(createCapabilityRegistryFromEnvironment({
      ...base,
      MOVPROMPT_PROVIDER_VERCEL_GATEWAY_READY: "true",
      AI_GATEWAY_API_KEY: "secret",
      VERCEL_AI_GATEWAY_BASE_URL: "https://ai-gateway.vercel.sh/v4/ai",
      PROVIDER_OUTPUT_ALLOWED_HOSTS: "ark-acg-ap-southeast-1.tos-ap-southeast-1.volces.com",
      R2_ACCOUNT_ID: "https://storage.example.test",
      R2_TEMPLATE_PREVIEWS_BASE_URL: "auto",
      R2_ACCESS_KEY_ID: "access",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_ASSETS_BUCKET: "creator-assets",
      R2_OUTPUTS_BUCKET: "creator-outputs",
      FFMPEG_PATH: "ffmpeg",
      FFPROBE_PATH: "ffprobe",
      MOVPROMPT_QUALITY_MODEL_ID: "openai/gpt-5.4",
    }).listPublic().find((item) => item.alias === "video.product_fidelity")?.available).toBe(false);

    expect(createCapabilityRegistryFromEnvironment({
      ...base,
      MOVPROMPT_PROVIDER_VERCEL_GATEWAY_READY: "true",
      AI_GATEWAY_API_KEY: "secret",
      VERCEL_AI_GATEWAY_BASE_URL: "https://proxy.example.test/v4/ai",
      PROVIDER_OUTPUT_ALLOWED_HOSTS: "ark-acg-ap-southeast-1.tos-ap-southeast-1.volces.com",
      R2_ACCOUNT_ID: "https://storage.example.test",
      R2_TEMPLATE_PREVIEWS_BASE_URL: "auto",
      R2_ACCESS_KEY_ID: "access",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_ASSETS_BUCKET: "creator-assets",
      R2_OUTPUTS_BUCKET: "creator-outputs",
      FFMPEG_PATH: "ffmpeg",
      FFPROBE_PATH: "ffprobe",
      MOVPROMPT_QUALITY_MODEL_ID: "google/gemini-3.6-flash",
    }).listPublic().find((item) => item.alias === "video.product_fidelity")?.available).toBe(false);
  });
});
