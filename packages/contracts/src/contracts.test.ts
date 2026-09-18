import { describe, expect, it } from "vitest";
import {
  ApiErrorEnvelopeSchema,
  CreateAssetUploadRequestSchema,
  CapabilityAliasSchema,
  ExportJobPayloadSchema,
  GenerationConfigurationSchema,
  GenerationJobPayloadSchema,
  CreateGenerationQuoteRequestSchema,
  StartRenderRunRequestSchema,
  TemplateQuoteEligibilitySchema,
  CampaignPresenterSchema,
} from "./index.js";

describe("public contracts", () => {
  it("accepts only approved capability aliases", () => {
    expect(CapabilityAliasSchema.parse("video.cinematic")).toBe("video.cinematic");
    expect(() => CapabilityAliasSchema.parse("fal-ai/kling-video/v2.1/master")).toThrow();
    expect(() => CapabilityAliasSchema.parse("seedance-2.0-ref")).toThrow();
  });

  it("rejects extra generation fields so raw provider settings cannot pass through", () => {
    const payload = {
      renderRunId: "run-1",
      userId: "user-1",
      projectId: "project-1",
      projectVersionId: "version-1",
      quoteId: "quote-1",
      capability: "video.cinematic",
      idempotencyKey: "generation:run-1",
      requestId: "request-1",
      providerModelId: "seedance-2.0-ref",
    };

    expect(() => GenerationJobPayloadSchema.parse(payload)).toThrow();
  });

  it("validates deterministic export job fields", () => {
    const result = ExportJobPayloadSchema.parse({
      exportId: "export-1",
      userId: "user-1",
      projectId: "project-1",
      projectVersionId: "version-1",
      sourceObjectKey: "user-1/project-1/source.mp4",
      outputObjectKey: "user-1/project-1/export-1.mp4",
      aspectRatio: "4:5",
      resolution: "1080p",
      idempotencyKey: "export:export-1",
      requestId: "request-1",
    });

    expect(result.aspectRatio).toBe("4:5");
  });

  it("uses one stable API error envelope", () => {
    expect(
      ApiErrorEnvelopeSchema.parse({
        error: {
          code: "validation_failed",
          message: "The request is invalid.",
          retryable: false,
          requestId: "request-1",
        },
      }),
    ).toEqual({
      error: {
        code: "validation_failed",
        message: "The request is invalid.",
        retryable: false,
        requestId: "request-1",
      },
    });
  });

  it("rejects client-controlled ownership fields from asset upload requests", () => {
    expect(() =>
      CreateAssetUploadRequestSchema.parse({
        kind: "product",
        userId: "attacker-controlled-user",
        metadata: {
          mimeType: "image/jpeg",
          sizeBytes: 1_024,
          checksumSha256: "a".repeat(64),
        },
      }),
    ).toThrow();
  });

  it("keeps provider IDs and entitlement decisions out of quote requests", () => {
    expect(() =>
      CreateGenerationQuoteRequestSchema.parse({
        capability: "video.cinematic",
        providerModelId: "private-provider-model",
        entitlementEligible: true,
        configuration: { prompt: "A product reveal" },
      }),
    ).toThrow();
  });

  it("binds resolution and audio into every generation configuration", () => {
    expect(GenerationConfigurationSchema.parse({ prompt: "A product reveal" })).toMatchObject({
      resolution: "720p",
      audio: true,
    });
    expect(GenerationConfigurationSchema.parse({
      prompt: "A muted preview",
      resolution: "480p",
      audio: false,
    })).toMatchObject({ resolution: "480p", audio: false });
    expect(() => GenerationConfigurationSchema.parse({
      prompt: "Unsupported tier",
      resolution: "1080p",
    })).toThrow();
  });

  it("requires render ownership to come from authentication rather than the request", () => {
    expect(() =>
      StartRenderRunRequestSchema.parse({
        userId: "11111111-1111-4111-8111-111111111111",
        projectId: "22222222-2222-4222-8222-222222222222",
        projectVersionId: "33333333-3333-4333-8333-333333333333",
        quoteId: "44444444-4444-4444-8444-444444444444",
        rightsAttested: true,
      }),
    ).toThrow();
  });

  it("keeps catalog eligibility bounded and excludes pricing authority", () => {
    expect(TemplateQuoteEligibilitySchema.parse({
      goals: ["launch"],
      supportedLanguages: ["en", "ar", "bilingual"],
      supportedRatios: ["9:16", "1:1", "4:5", "16:9"],
      supportedMarkets: ["KW"],
      requiredInputs: ["subject_name", "primary_reference", "call_to_action"],
      capabilityPolicy: ["video.product_fidelity"],
    })).toMatchObject({
      goals: ["launch"],
      requiredInputs: ["subject_name", "primary_reference", "call_to_action"],
    });

    expect(() => TemplateQuoteEligibilitySchema.parse({
      goals: ["launch"],
      supportedLanguages: ["en"],
      supportedRatios: ["9:16"],
      supportedMarkets: ["KW"],
      requiredInputs: ["subject_name"],
      capabilityPolicy: ["video.product_fidelity"],
      credits: 1,
    })).toThrow();
  });

  it("accepts one rights-attested footage presenter and excludes provider-backed identities", () => {
    const assetId = "11111111-1111-4111-8111-111111111111";
    expect(CampaignPresenterSchema.parse({
      mode: "uploaded_spokesperson",
      assetId,
      rights: {
        version: "person-media-rights-v1",
        assetId,
        personMediaRightsAttested: true,
      },
    })).toMatchObject({ mode: "uploaded_spokesperson", assetId });

    expect(() => CampaignPresenterSchema.parse({
      mode: "uploaded_spokesperson",
      assetId,
    })).toThrow();
    expect(() => CampaignPresenterSchema.parse({
      mode: "digital_twin",
      providerIdentityId: "provider-only-id",
    })).toThrow();
    expect(() => CampaignPresenterSchema.parse({ mode: "ai_ugc", providerModelId: "hidden" })).toThrow();
  });

  it("requires bounded video metadata for a footage asset", () => {
    expect(CreateAssetUploadRequestSchema.parse({
      kind: "footage",
      metadata: {
        mimeType: "video/mp4",
        sizeBytes: 4_096,
        checksumSha256: "b".repeat(64),
        durationMs: 12_000,
      },
    })).toMatchObject({ kind: "footage" });

    expect(() => CreateAssetUploadRequestSchema.parse({
      kind: "footage",
      metadata: {
        mimeType: "image/jpeg",
        sizeBytes: 4_096,
        checksumSha256: "b".repeat(64),
        durationMs: 12_000,
      },
    })).toThrow();
    expect(() => CreateAssetUploadRequestSchema.parse({
      kind: "footage",
      metadata: {
        mimeType: "video/mp4",
        sizeBytes: 4_096,
        checksumSha256: "b".repeat(64),
      },
    })).toThrow();
  });

});
