import { randomUUID } from "node:crypto";

import { CapabilityRegistry } from "@movprompt/providers";
import { describe, expect, it, vi } from "vitest";

import { createGenerationPricingFromEnvironment } from "./generation-pricing.js";
import type { GenerationRepository, OwnedRenderRun } from "./generation-repository.js";
import {
  createGenerationApiService,
  GenerationApplicationError,
} from "./generation-service.js";
import { hashGenerationConfiguration } from "@movprompt/db";
import { TemplateCampaignPayloadSchema, type GenerationConfiguration } from "@movprompt/contracts";

import { validTemplateClaim } from "./campaign-contract.test-fixture.js";
import { LAUNCH_CREATIVE_TEMPLATE_CATALOG, rebuildTemplateScenesForDuration, getCreativeTemplate, resolveDurationRecipe } from "@movprompt/creative-engine";

function ownedRun(overrides: Partial<OwnedRenderRun> = {}): OwnedRenderRun {
  const now = new Date("2026-08-14T12:00:00.000Z");
  return {
    id: randomUUID(),
    projectId: randomUUID(),
    projectVersionId: randomUUID(),
    capabilityAlias: "video.product_fidelity",
    quoteId: randomUUID(),
    quotedCredits: 80,
    chargedCredits: 0,
    starterEntitlementUsed: true,
    status: "submitting",
    processingStage: "preparing",
    provider: null,
    providerRequestId: null,
    outputBucket: null,
    outputObjectKey: null,
    errorCode: null,
    errorMessage: null,
    chargedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function repository(run: OwnedRenderRun): GenerationRepository {
  return {
    findOwnedProjectVersion: vi.fn(async () => null),
    findOwnedReferenceAssets: vi.fn(async () => []),
    findOwnedPresenterFootageAsset: vi.fn(async () => null),
    findPublishedTemplateVersion: vi.fn(async () => null),
    hasAvailableStarterEntitlement: vi.fn(async () => false),
    findOwnedQuote: vi.fn(async () => null),
    findOwnedRun: vi.fn(async () => run),
    listOwnedRuns: vi.fn(async () => [run]),
    requestOutputRecovery: vi.fn(async () => run),
    requestProviderCancellation: vi.fn(async () => null),
  };
}

function strictTemplateEstimate(
  templateVersionId: string,
  update?: (payload: {
    configuration: { creatorProject: Record<string, unknown>; generation: Record<string, unknown> };
    productRecipe: Record<string, unknown>;
    campaignRecipe: Record<string, unknown>;
  }) => void,
): GenerationConfiguration {
  const draft = validTemplateClaim({ templateVersionId });
  const configuration = structuredClone(draft.configuration) as unknown as {
    creatorProject: Record<string, unknown>;
    generation: Record<string, unknown>;
  };
  const productRecipe = structuredClone(draft.productRecipe) as Record<string, unknown>;
  const campaignRecipe = structuredClone(draft.campaignRecipe) as Record<string, unknown>;
  update?.({ configuration, productRecipe, campaignRecipe });
  return {
    ...configuration.generation,
    templateCampaign: {
      configuration,
      productRecipe,
      campaignRecipe,
    },
  } as unknown as GenerationConfiguration;
}

function service(run: OwnedRenderRun, modelId = "bytedance/seedance-2.5") {
  const releaseRenderReservation = vi.fn(async () => {
    run.status = "cancelled";
    return {} as never;
  });
  const generationRepository = repository(run);
  return {
    api: createGenerationApiService({
      repository: generationRepository,
      generation: {
        createQuote: vi.fn(async () => ({} as never)),
        startRender: vi.fn(async () => ({} as never)),
        releaseRenderReservation,
      },
      pricing: createGenerationPricingFromEnvironment({
        GENERATION_PRICING_VERSION: "test-v1",
        GENERATION_QUOTE_TTL_SECONDS: "900",
        GENERATION_VIDEO_PRODUCT_FIDELITY_720P_CREDITS_PER_SECOND: "10",
      }),
      capabilities: new CapabilityRegistry({
        "video.product_fidelity": {
          enabled: true,
          adapterId: "vercel-ai-gateway",
          providerModelId: modelId,
        },
      }),
    }),
    releaseRenderReservation,
    repository: generationRepository,
  };
}

describe("versioned photo-template quote preflight", () => {
  function setup(id = "premium-phone-reveal", count = 2, duration = 15, modelId = "bytedance/seedance-2.5") {
    const template = getCreativeTemplate(id);
    const versionId = randomUUID();
    const draft = validTemplateClaim();
    const payload = TemplateCampaignPayloadSchema.parse({ configuration: draft.configuration, productRecipe: draft.productRecipe, campaignRecipe: draft.campaignRecipe });
    const campaign = payload.campaignRecipe;
    const project = payload.configuration.creatorProject;
    const generation = payload.configuration.generation;
    campaign.audio = project.audio = generation.audio = false;
    campaign.goal = project.goal = template.goals[0]!;
    campaign.vertical = project.vertical = template.verticals[0]!;
    project.templateId = id;
    project.durationSeconds = generation.durationSeconds = duration;
    project.product.images = Array.from({ length: count }, (_, index) => ({ id: randomUUID(), name: `Photo ${index + 1}`, url: "" as const, source: "upload" as const, mimeType: "image/png", referenceRole: template.photoPolicy!.groups[0]!.role }));
    const variant = resolveDurationRecipe({ id, durationRecipes: template.durationRecipes!, duration, photos: project.product.images });
    generation.templateQuoteContext = campaign;
    generation.creativeBrief = { ...generation.creativeBrief, templateId: id, templateRecipeVersion: template.versionNumber, templatePromptVersion: `${id}-v${template.versionNumber}`, templateVisualSystem: template.visualSystem, durationVariant: variant.id, goal: campaign.goal, vertical: campaign.vertical, scenes: variant.scenes, qualityPolicy: template.qualityPolicy };
    const system = service(ownedRun(), modelId);
    system.repository.findPublishedTemplateVersion = vi.fn(async () => ({
      id: versionId, durationSeconds: 8, starterRenderEligible: false, supportedLanguages: [...template.supportedLanguages], presenterModes: ["none"],
      visualRecipe: { versionNumber: template.versionNumber, promptVersion: `${id}-v${template.versionNumber}`, visualSystem: template.visualSystem, scenes: template.scenes, durationRecipes: template.durationRecipes! },
      eligibility: { requiredInputs: [...template.requiredInputs], goals: [...template.goals], supportedLanguages: [...template.supportedLanguages], supportedRatios: [...template.supportedRatios], supportedMarkets: ["KW"], capabilityPolicy: [...template.capabilityPolicy] },
    }));
    const request = () => ({ templateVersionId: versionId, configuration: { ...generation, templateCampaign: payload } as unknown as GenerationConfiguration });
    return { ...system, payload, request };
  }
  it("accepts supported variants and binds photo order, roles and duration to the quote identity", async () => {
    const test = setup();
    const first = await test.api.createQuote(test.request(), null);
    test.payload.configuration.creatorProject.product.images.reverse();
    const second = await test.api.createQuote(test.request(), null);
    expect(first.configurationHash).not.toBe(second.configurationHash);
    expect(first.estimateOnly).toBe(true);
  });
  it("rejects over-limit photos, invalid roles/files, missing products, old recipes and oversized facts", async () => {
    for (const change of ["count", "role", "file", "version", "size", "missing"] as const) {
      const test = setup();
      const project = test.payload.configuration.creatorProject;
      if (change === "count") project.product.images.push(...project.product.images.map(image => ({ ...image, id: randomUUID() })));
      if (change === "role") project.product.images[0]!.referenceRole = "character";
      if (change === "file") project.product.images[0]!.mimeType = "video/mp4";
      if (change === "missing") project.product.images = [];
      if (change === "version") test.payload.configuration.generation.creativeBrief.durationVariant = "premium-phone-reveal-v1-15s";
      if (change === "size") {
        project.product.description = test.payload.productRecipe.description = test.payload.configuration.generation.creativeBrief.product.description = "A".repeat(2000);
        project.offer = test.payload.campaignRecipe.offer = test.payload.configuration.generation.creativeBrief.product.offer = "O".repeat(500);
        project.location = test.payload.campaignRecipe.location = test.payload.configuration.generation.creativeBrief.product.location = "L".repeat(500);
      }
      await expect(test.api.createQuote(test.request(), null), change).rejects.toMatchObject({ code: "template_configuration_ineligible" });
    }
  });
  it("does not substitute the local fast model for the required model", async () => {
    const test = setup("premium-phone-reveal",1,8,"bytedance/seedance-v1.0-pro-fast");
    await expect(test.api.createQuote(test.request(),null)).rejects.toMatchObject({code:"generation_service_unavailable"});
  });
  it("identifies a stale catalog instead of blaming the new campaign recipe", async () => {
    const test = setup("fashion-product-showcase", 1, 15);
    const current = await test.repository.findPublishedTemplateVersion(test.request().templateVersionId);
    test.repository.findPublishedTemplateVersion = vi.fn(async () => ({ ...current!, visualRecipe: {
      versionNumber: 1, promptVersion: "fashion-product-showcase-v1", visualSystem: current!.visualRecipe!.visualSystem,
      scenes: current!.visualRecipe!.scenes,
    } }));
    await expect(test.api.createQuote(test.request(), null)).rejects.toMatchObject({ code: "template_catalog_outdated" });
  });
});

describe("generation cancellation safety", () => {
  it("does not release a submitting render after the worker records a provider start marker", async () => {
    const userId = randomUUID();
    const run = ownedRun({ provider: "vercel-ai-gateway" });
    const { api, releaseRenderReservation } = service(run);

    await expect(api.cancelRender(userId, run.id, "cancel:run-1")).rejects.toMatchObject({
      code: "provider_acceptance_in_progress",
    } satisfies Partial<GenerationApplicationError>);
    expect(releaseRenderReservation).not.toHaveBeenCalled();
  });

  it("releases a submitting render only when no provider start can be in flight", async () => {
    const userId = randomUUID();
    const run = ownedRun();
    const { api, releaseRenderReservation } = service(run);

    await expect(api.cancelRender(userId, run.id, "cancel:run-2")).resolves.toMatchObject({
      status: "cancelled",
    });
    expect(releaseRenderReservation).toHaveBeenCalledOnce();
  });

  it("keeps a Gateway render in honest pending cancellation while reconciliation continues", async () => {
    const userId = randomUUID();
    const run = ownedRun({
      status: "processing",
      provider: "vercel-ai-gateway",
      providerRequestId: "vgw4.operation",
      chargedAt: new Date("2026-08-14T12:00:10.000Z"),
    });
    const { api, releaseRenderReservation, repository: generationRepository } = service(run);
    generationRepository.requestProviderCancellation = vi.fn(async () => ({
      ...run,
      status: "cancelling",
      processingStage: "cancelling",
    }));

    await expect(api.cancelRender(userId, run.id, "cancel:run-3")).resolves.toMatchObject({
      status: "cancelling",
      processingStage: "cancelling",
    });
    expect(releaseRenderReservation).not.toHaveBeenCalled();
  });

  it("does not expose raw provider errors or capability-bearing URLs in public run state", async () => {
    const userId = randomUUID();
    const run = ownedRun({
      status: "failed",
      processingStage: "failed",
      errorCode: "provider_output_host_not_allowed",
      errorMessage: "https://secret-output.example.test/video.mp4?signature=private vgw4.operation",
    });
    const { api } = service(run);

    await expect(api.getRender(userId, run.id)).resolves.toMatchObject({
      error: {
        code: "provider_output_host_not_allowed",
        message: "We could not finish saving this video. Your project is safe; try again from Projects.",
      },
    });
  });
  it.each(["vercel_gateway_generation_failed", "provider_person_reference_rejected"])("explains person-reference rejection safely for new and historical runs (%s)", async errorCode => {
    const run = ownedRun({
      status: "failed", processingStage: "failed", errorCode,
      errorMessage: "The request failed because the input image 'content[2]' may contain real person. Request id: private-request-id",
    });
    const { api } = service(run);
    const result = await api.getRender(randomUUID(), run.id);
    expect(result.error?.code).toBe("provider_person_reference_rejected");
    expect(result.error?.message).toContain("even if the person was AI-generated");
    expect(result.error?.message).toContain("before starting a new generation");
    expect(JSON.stringify(result)).not.toContain("private-request-id");
    expect(JSON.stringify(result)).not.toContain("content[2]");
    expect(run.errorCode).toBe(errorCode);
  });

  it.each(["provider_operation_failed", "provider_balance_required"])("explains provider balance without exposing its top-up URL (%s)", async errorCode => {
    const run = ownedRun({
      status: "failed", processingStage: "failed", errorCode,
      errorMessage: "Video generation requires a minimum balance of $10. Your current balance is insufficient. Visit https://vercel.com/private-top-up",
      chargedCredits: 0,
    });
    const { api } = service(run);
    const result = await api.getRender(randomUUID(), run.id);
    expect(result.error).toEqual({
      code: "provider_balance_required",
      message: "The video service needs more provider balance before it can create videos. Your project and photos are saved. Please try again after the service balance is restored.",
    });
    expect(JSON.stringify(result)).not.toContain("private-top-up");
  });

  it("explains saved-configuration failures without exposing internal schema details", async () => {
    const userId = randomUUID();
    const run = ownedRun({
      status: "failed", processingStage: "failed", errorCode: "invalid_generation_configuration",
      errorMessage: 'Unrecognized key: "referenceRole" at references[0]',
    });
    const { api } = service(run);
    const result = await api.getRender(userId, run.id);
    expect(result.error).toEqual(expect.objectContaining({
      code: "invalid_generation_configuration",
      message: "The video service could not read this campaign's saved settings. Your photos and details are safe. Return to the campaign; if it happens again, contact support.",
    }));
    expect(JSON.stringify(result)).not.toContain("referenceRole");
  });
});

describe("existing provider output recovery", () => {
  it("requeues only the accepted provider operation and never starts a new render", async () => {
    const userId = randomUUID();
    const run = ownedRun({
      status: "failed",
      processingStage: "failed",
      provider: "vercel-ai-gateway",
      providerRequestId: "vgw4.existing-operation",
      chargedAt: new Date("2026-08-14T12:00:10.000Z"),
      errorCode: "provider_output_host_not_allowed",
      errorMessage: "provider_output_host_not_allowed:ark-acg.example",
    });
    const repo = repository(run);
    repo.requestOutputRecovery = vi.fn(async () => ({
      ...run,
      status: "processing",
      processingStage: "securing_output",
      errorCode: null,
      errorMessage: null,
    }));
    const startRender = vi.fn(async () => ({} as never));
    const api = createGenerationApiService({
      repository: repo,
      generation: {
        createQuote: vi.fn(async () => ({} as never)),
        startRender,
        releaseRenderReservation: vi.fn(async () => ({} as never)),
      },
      pricing: createGenerationPricingFromEnvironment({
        GENERATION_PRICING_VERSION: "test-v1",
        GENERATION_QUOTE_TTL_SECONDS: "900",
        GENERATION_VIDEO_PRODUCT_FIDELITY_720P_CREDITS_PER_SECOND: "10",
      }),
      capabilities: new CapabilityRegistry({
        "video.product_fidelity": {
          enabled: true,
          adapterId: "vercel-ai-gateway",
          providerModelId: "bytedance/seedance-2.5",
        },
      }),
    });

    await expect(api.retryRenderOutput(userId, run.id, "recover-existing-operation")).resolves.toMatchObject({
      id: run.id,
      status: "processing",
      processingStage: "securing_output",
    });
    expect(repo.requestOutputRecovery).toHaveBeenCalledOnce();
    expect(startRender).not.toHaveBeenCalled();
  });
});

describe("starter-only private beta", () => {
  it("allows an unverified private-beta account to use its provisioned starter render", async () => {
    const userId = randomUUID();
    const templateVersionId = randomUUID();
    const repo = repository(ownedRun());
    repo.findPublishedTemplateVersion = vi.fn(async () => ({
      id: templateVersionId,
      durationSeconds: 8,
      starterRenderEligible: true,
      eligibility: {
        goals: ["launch"],
        supportedLanguages: ["en", "ar", "bilingual"],
        supportedRatios: ["9:16", "1:1", "4:5", "16:9"],
        supportedMarkets: ["KW"],
        requiredInputs: [],
        capabilityPolicy: ["video.cinematic"],
      },
    }));
    repo.hasAvailableStarterEntitlement = vi.fn(async () => true);
    const api = createGenerationApiService({
      repository: repo,
      generation: {
        createQuote: vi.fn(async () => ({} as never)),
        startRender: vi.fn(async () => ({} as never)),
        releaseRenderReservation: vi.fn(async () => ({} as never)),
      },
      pricing: createGenerationPricingFromEnvironment({
        GENERATION_PRICING_VERSION: "test-v1",
        GENERATION_QUOTE_TTL_SECONDS: "900",
        GENERATION_VIDEO_PRODUCT_FIDELITY_720P_CREDITS_PER_SECOND: "10",
        GENERATION_VIDEO_CINEMATIC_720P_CREDITS_PER_SECOND: "10",
      }),
      capabilities: new CapabilityRegistry({
        "video.product_fidelity": {
          enabled: true,
          adapterId: "vercel-ai-gateway",
          providerModelId: "bytedance/seedance-2.5",
        },
        "video.cinematic": {
          enabled: true,
          adapterId: "vercel-ai-gateway",
          providerModelId: "bytedance/seedance-2.5",
        },
      }),
      starterOnly: true,
      starterEligibilityRequiresEmailVerification: false,
    });

    const quote = await api.createQuote({
      templateVersionId,
      configuration: strictTemplateEstimate(templateVersionId),
    }, {
      user: {
        id: userId,
        email: "private-beta@example.test",
        emailVerified: false,
        name: "Private Beta",
      },
      session: { id: "private-beta-session" },
    });

    expect(quote.entitlementEligible).toBe(true);
    expect(repo.hasAvailableStarterEntitlement).toHaveBeenCalledWith(userId);
  });

  it("rejects a paid-credit quote before submitting any provider work", async () => {
    const userId = randomUUID();
    const projectId = randomUUID();
    const versionId = randomUUID();
    const quoteId = randomUUID();
    const startRender = vi.fn(async () => ({} as never));
    const repo = repository(ownedRun());
    repo.findOwnedProjectVersion = vi.fn(async () => ({
      id: versionId,
      projectId,
      mode: "advanced" as const,
      templateVersionId: null,
      configuration: {},
    }));
    repo.findOwnedQuote = vi.fn(async () => ({
      id: quoteId,
      templateVersionId: null,
      capabilityAlias: "video.product_fidelity",
      credits: 80,
      entitlementEligible: false,
      configurationHash: "not-read-after-starter-check",
      expiresAt: new Date("2026-08-15T13:00:00.000Z"),
    }));
    const api = createGenerationApiService({
      repository: repo,
      generation: {
        createQuote: vi.fn(async () => ({} as never)),
        startRender,
        releaseRenderReservation: vi.fn(async () => ({} as never)),
      },
      pricing: createGenerationPricingFromEnvironment({
        GENERATION_PRICING_VERSION: "test-v1",
        GENERATION_QUOTE_TTL_SECONDS: "900",
        GENERATION_VIDEO_PRODUCT_FIDELITY_720P_CREDITS_PER_SECOND: "10",
      }),
      capabilities: new CapabilityRegistry({
        "video.product_fidelity": {
          enabled: true,
          adapterId: "vercel-ai-gateway",
          providerModelId: "bytedance/seedance-2.5",
        },
      }),
      starterOnly: true,
    });

    await expect(api.startRender({
      userId,
      projectId,
      projectVersionId: versionId,
      quoteId,
      idempotencyKey: `render:${randomUUID()}`,
    })).rejects.toMatchObject({ code: "starter_entitlement_unavailable" });
    expect(startRender).not.toHaveBeenCalled();
  });

  it("refuses a starter-only quote before the review screen can offer Generate", async () => {
    const userId = randomUUID();
    const templateVersionId = randomUUID();
    const repo = repository(ownedRun());
    repo.findPublishedTemplateVersion = vi.fn(async () => ({
      id: templateVersionId,
      durationSeconds: 8,
      starterRenderEligible: true,
      eligibility: {
        goals: ["launch"],
        supportedLanguages: ["en", "ar", "bilingual"],
        supportedRatios: ["9:16", "1:1", "4:5", "16:9"],
        supportedMarkets: ["KW"],
        requiredInputs: [],
        capabilityPolicy: ["video.cinematic"],
      },
    }));
    repo.hasAvailableStarterEntitlement = vi.fn(async () => false);
    const api = createGenerationApiService({
      repository: repo,
      generation: {
        createQuote: vi.fn(async () => ({} as never)),
        startRender: vi.fn(async () => ({} as never)),
        releaseRenderReservation: vi.fn(async () => ({} as never)),
      },
      pricing: createGenerationPricingFromEnvironment({
        GENERATION_PRICING_VERSION: "test-v1",
        GENERATION_QUOTE_TTL_SECONDS: "900",
        GENERATION_VIDEO_CINEMATIC_720P_CREDITS_PER_SECOND: "10",
      }),
      capabilities: new CapabilityRegistry({
        "video.cinematic": {
          enabled: true,
          adapterId: "vercel-ai-gateway",
          providerModelId: "bytedance/seedance-2.5",
        },
      }),
      starterOnly: true,
      starterEligibilityRequiresEmailVerification: false,
    });

    await expect(api.createQuote({
      templateVersionId,
      configuration: strictTemplateEstimate(templateVersionId),
    }, {
      user: {
        id: userId,
        email: "used-starter@example.test",
        emailVerified: true,
        name: "Used Starter",
      },
      session: { id: "used-starter-session" },
    })).rejects.toMatchObject({ code: "starter_entitlement_unavailable" });
  });

  it("quotes and starts a signed-in render at zero credits when accounts are free", async () => {
    const userId = randomUUID();
    const projectId = randomUUID();
    const versionId = randomUUID();
    const quoteId = randomUUID();
    const configuration = {
      prompt: "A precise product reveal",
      durationSeconds: 8,
      resolution: "720p",
    } as GenerationConfiguration;
    let storedHash = "";
    const persistedQuote = vi.fn(async (input: { credits: number; entitlementEligible: boolean; configuration: Parameters<typeof hashGenerationConfiguration>[0] }) => {
      storedHash = hashGenerationConfiguration(input.configuration);
      return {
        id: quoteId,
        credits: input.credits,
        entitlementEligible: input.entitlementEligible,
        configurationHash: storedHash,
        expiresAt: new Date("2026-08-15T13:00:00.000Z"),
        breakdown: [{ label: "Free campaign", credits: 0 }],
      };
    });
    const startRender = vi.fn(async () => ownedRun({
      projectId,
      projectVersionId: versionId,
      quoteId,
      quotedCredits: 0,
      starterEntitlementUsed: false,
      capabilityAlias: "video.cinematic",
    }));
    const repo = repository(ownedRun());
    repo.findOwnedProjectVersion = vi.fn(async () => ({
      id: versionId,
      projectId,
      mode: "advanced" as const,
      templateVersionId: null,
      configuration: { generation: configuration },
    }));
    repo.findOwnedQuote = vi.fn(async () => ({
      id: quoteId,
      templateVersionId: null,
      capabilityAlias: "video.cinematic",
      credits: 0,
      entitlementEligible: false,
      configurationHash: storedHash,
      expiresAt: new Date("2026-08-15T13:00:00.000Z"),
    }));
    const api = createGenerationApiService({
      repository: repo,
      generation: {
        createQuote: persistedQuote,
        startRender,
        releaseRenderReservation: vi.fn(async () => ({} as never)),
      },
      pricing: createGenerationPricingFromEnvironment({
        GENERATION_PRICING_VERSION: "test-v1",
        GENERATION_QUOTE_TTL_SECONDS: "900",
        GENERATION_VIDEO_CINEMATIC_720P_CREDITS_PER_SECOND: "10",
      }),
      capabilities: new CapabilityRegistry({
        "video.cinematic": {
          enabled: true,
          adapterId: "vercel-ai-gateway",
          providerModelId: "bytedance/seedance-2.5",
        },
      }),
      starterOnly: true,
      freeAccounts: true,
    });
    const session = {
      user: { id: userId, email: "owner@example.test", emailVerified: true, name: "Owner" },
      session: { id: "free-account-session" },
    };

    await expect(api.createQuote({ capability: "video.cinematic", projectVersionId: versionId }, session)).resolves.toMatchObject({
      credits: 0,
      entitlementEligible: false,
      estimateOnly: false,
    });
    expect(persistedQuote).toHaveBeenCalledWith(expect.objectContaining({
      credits: 0,
      entitlementEligible: false,
      breakdown: [{ label: expect.any(String), credits: 0 }],
    }));
    await expect(api.startRender({
      userId,
      projectId,
      projectVersionId: versionId,
      quoteId,
      idempotencyKey: `render:${randomUUID()}`,
    })).resolves.toMatchObject({ quoteId, quotedCredits: 0 });
    expect(startRender).toHaveBeenCalledOnce();
  });
});

describe("generation reference ownership", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const projectId = "22222222-2222-4222-8222-222222222222";
  const versionId = "33333333-3333-4333-8333-333333333333";
  const checksum = "a".repeat(64);
  const ownedKey = `users/${userId}/projects/${projectId}/assets/product/44444444-4444-4444-8444-444444444444/${checksum}`;

  function quoteService(objectKey: string, configuredMime: string, persistedMime = configuredMime) {
    const createQuote = vi.fn(async () => ({
      id: "66666666-6666-4666-8666-666666666666",
      credits: 80,
      entitlementEligible: false,
      configurationHash: "a".repeat(64),
      expiresAt: new Date("2026-08-20T18:00:00.000Z"),
      breakdown: [{ label: "test", credits: 80 }],
    } as never));
    const repo: GenerationRepository = {
      findOwnedProjectVersion: vi.fn(async () => ({
        id: versionId,
        projectId,
        mode: "advanced" as const,
        templateVersionId: null,
        configuration: {
          generation: {
            prompt: "Create a faithful product campaign.",
            durationSeconds: 8,
            references: [{ objectKey, mimeType: configuredMime }],
          },
        },
      })),
      findOwnedReferenceAssets: vi.fn(async () => [{
        objectKey,
        bucket: "creator-assets",
        mimeType: persistedMime,
        sizeBytes: 2048,
        checksumSha256: checksum,
      }]),
      findOwnedPresenterFootageAsset: vi.fn(async () => null),
      findPublishedTemplateVersion: vi.fn(async () => null),
      hasAvailableStarterEntitlement: vi.fn(async () => false),
      findOwnedQuote: vi.fn(async () => null),
      findOwnedRun: vi.fn(async () => null),
      listOwnedRuns: vi.fn(async () => []),
      requestOutputRecovery: vi.fn(async () => null),
      requestProviderCancellation: vi.fn(async () => null),
    };
    return {
      createQuote,
      repo,
      api: createGenerationApiService({
        repository: repo,
        generation: {
          createQuote,
          startRender: vi.fn(async () => ({} as never)),
          releaseRenderReservation: vi.fn(async () => ({} as never)),
        },
        pricing: createGenerationPricingFromEnvironment({
          GENERATION_PRICING_VERSION: "test-v1",
          GENERATION_QUOTE_TTL_SECONDS: "900",
          GENERATION_VIDEO_PRODUCT_FIDELITY_720P_CREDITS_PER_SECOND: "10",
        }),
        capabilities: new CapabilityRegistry({
          "video.product_fidelity": {
            enabled: true,
            adapterId: "vercel-ai-gateway",
            providerModelId: "bytedance/seedance-2.5",
          },
        }),
      }),
    };
  }

  const session = {
    user: {
      id: userId,
      email: "owner@example.test",
      emailVerified: true,
      name: "Owner",
      role: "user" as const,
    },
    session: { id: "session" },
  };

  it("rejects a reference outside the owned project namespace before pricing is persisted", async () => {
    const foreignKey = `users/${"99999999-9999-4999-8999-999999999999"}/projects/${projectId}/assets/product/44444444-4444-4444-8444-444444444444/${checksum}`;
    const { api, createQuote, repo } = quoteService(foreignKey, "image/jpeg");

    await expect(api.createQuote({
      capability: "video.product_fidelity",
      projectVersionId: versionId,
    }, session)).rejects.toMatchObject({ code: "invalid_generation_reference" });
    expect(repo.findOwnedReferenceAssets).not.toHaveBeenCalled();
    expect(createQuote).not.toHaveBeenCalled();
  });

  it("rejects client MIME that does not match the authoritative owned asset row", async () => {
    const { api, createQuote } = quoteService(ownedKey, "image/jpeg", "image/webp");

    await expect(api.createQuote({
      capability: "video.product_fidelity",
      projectVersionId: versionId,
    }, session)).rejects.toMatchObject({ code: "invalid_generation_reference" });
    expect(createQuote).not.toHaveBeenCalled();
  });
});

describe("template quote eligibility", () => {
  const templateVersionId = "11111111-1111-4111-8111-111111111111";

  function quoteConfiguration(goal = "launch") {
    return strictTemplateEstimate(templateVersionId, ({ configuration, campaignRecipe }) => {
      configuration.creatorProject.goal = goal;
      const generation = configuration.generation;
      const quoteContext = generation.templateQuoteContext as Record<string, unknown>;
      const creativeBrief = generation.creativeBrief as Record<string, unknown>;
      quoteContext.goal = goal;
      creativeBrief.goal = goal;
      campaignRecipe.goal = goal;
    });
  }

  function eligibleTemplate() {
    return {
      id: templateVersionId,
      durationSeconds: 8,
      starterRenderEligible: true,
      eligibility: {
        goals: ["launch"],
        supportedLanguages: ["en", "ar", "bilingual"],
        supportedRatios: ["9:16", "1:1", "4:5", "16:9"],
        supportedMarkets: ["KW"],
        requiredInputs: ["subject_name", "call_to_action"],
        capabilityPolicy: ["video.cinematic"],
      },
    };
  }

  function quoteApi(template = eligibleTemplate(), developmentFree = false) {
    const repo = repository(ownedRun());
    repo.findPublishedTemplateVersion = vi.fn(async () => template);
    return {
      repo,
      api: createGenerationApiService({
        repository: repo,
        generation: {
          createQuote: vi.fn(async () => ({} as never)),
          startRender: vi.fn(async () => ({} as never)),
          releaseRenderReservation: vi.fn(async () => ({} as never)),
        },
        pricing: createGenerationPricingFromEnvironment({
          ...(developmentFree ? { APP_ENV: "local", DEVELOPMENT_FREE_GENERATION: "true" } : {}),
          GENERATION_PRICING_VERSION: "test-v1",
          GENERATION_QUOTE_TTL_SECONDS: "900",
          GENERATION_VIDEO_PRODUCT_FIDELITY_720P_CREDITS_PER_SECOND: "10",
          GENERATION_VIDEO_CINEMATIC_720P_CREDITS_PER_SECOND: "10",
        }),
        capabilities: new CapabilityRegistry({
          "video.product_fidelity": {
            enabled: true,
            adapterId: "vercel-ai-gateway",
            providerModelId: "bytedance/seedance-2.5",
          },
          "video.cinematic": {
            enabled: true,
            adapterId: "vercel-ai-gateway",
            providerModelId: "bytedance/seedance-2.5",
          },
        }),
      }),
    };
  }

  it("rejects a malformed persisted template campaign before quote, reservation, or provider work", async () => {
    const userId = randomUUID();
    const projectId = randomUUID();
    const versionId = randomUUID();
    const fixture = validTemplateClaim();
    const malformedConfiguration = structuredClone(fixture.configuration) as Record<string, unknown>;
    const generation = malformedConfiguration.generation as Record<string, unknown>;
    generation.hiddenProviderModel = "not-an-approved-capability";
    const repo = repository(ownedRun());
    const createQuote = vi.fn(async () => ({} as never));
    const startRender = vi.fn(async () => ({} as never));
    repo.findOwnedProjectVersion = vi.fn(async () => ({
      id: versionId,
      projectId,
      mode: "template" as const,
      templateVersionId: fixture.templateVersionId!,
      configuration: malformedConfiguration,
      productRecipe: fixture.productRecipe,
      campaignRecipe: fixture.campaignRecipe,
    }));
    repo.findPublishedTemplateVersion = vi.fn(async () => ({
      id: fixture.templateVersionId!,
      durationSeconds: 6,
      starterRenderEligible: false,
      eligibility: {
        goals: ["launch"],
        supportedLanguages: ["en"],
        supportedRatios: ["9:16"],
        supportedMarkets: ["KW"],
        requiredInputs: ["subject_name", "call_to_action"],
        capabilityPolicy: ["video.cinematic"],
      },
    }));
    repo.findOwnedQuote = vi.fn(async () => ({
      id: randomUUID(),
      templateVersionId: fixture.templateVersionId!,
      capabilityAlias: "video.cinematic",
      credits: 60,
      entitlementEligible: false,
      configurationHash: "a".repeat(64),
      expiresAt: new Date("2026-08-21T01:00:00.000Z"),
    }));
    const api = createGenerationApiService({
      repository: repo,
      generation: {
        createQuote,
        startRender,
        releaseRenderReservation: vi.fn(async () => ({} as never)),
      },
      pricing: createGenerationPricingFromEnvironment({
        GENERATION_PRICING_VERSION: "test-v1",
        GENERATION_QUOTE_TTL_SECONDS: "900",
        GENERATION_VIDEO_CINEMATIC_720P_CREDITS_PER_SECOND: "10",
      }),
      capabilities: new CapabilityRegistry({
        "video.cinematic": {
          enabled: true,
          adapterId: "vercel-ai-gateway",
          providerModelId: "bytedance/seedance-2.5",
        },
      }),
    });
    const session = {
      user: { id: userId, email: "owner@example.test", emailVerified: true, name: "Owner", role: "user" as const },
      session: { id: "session" },
    };

    await expect(api.createQuote({ projectVersionId: versionId }, session)).rejects.toMatchObject({
      code: "invalid_campaign_configuration",
    });
    expect(createQuote).not.toHaveBeenCalled();
    expect(repo.findOwnedReferenceAssets).not.toHaveBeenCalled();

    await expect(api.startRender({
      userId,
      projectId,
      projectVersionId: versionId,
      quoteId: randomUUID(),
      idempotencyKey: "malformed-template-campaign",
    })).rejects.toMatchObject({ code: "invalid_campaign_configuration" });
    expect(repo.findOwnedQuote).not.toHaveBeenCalled();
    expect(startRender).not.toHaveBeenCalled();
  });

  it("rejects historic Template Mode rows with no immutable template ID or product recipe before lookup, quote, or reservation", async () => {
    const userId = randomUUID();
    const projectId = randomUUID();
    const fixture = validTemplateClaim();
    const session = {
      user: { id: userId, email: "owner@example.test", emailVerified: true, name: "Owner", role: "user" as const },
      session: { id: "session" },
    };

    for (const malformed of [
      {
        label: "missing template ID",
        version: {
          mode: "template" as const,
          templateVersionId: null,
          configuration: fixture.configuration,
          productRecipe: fixture.productRecipe,
          campaignRecipe: fixture.campaignRecipe,
        },
      },
      {
        label: "missing product recipe",
        version: {
          mode: "template" as const,
          templateVersionId: fixture.templateVersionId!,
          configuration: fixture.configuration,
          campaignRecipe: fixture.campaignRecipe,
        },
      },
    ]) {
      const versionId = randomUUID();
      const repo = repository(ownedRun());
      const createQuote = vi.fn(async () => ({} as never));
      const startRender = vi.fn(async () => ({} as never));
      repo.findOwnedProjectVersion = vi.fn(async () => ({
        id: versionId,
        projectId,
        ...malformed.version,
      }));
      repo.findOwnedQuote = vi.fn(async () => ({
        id: randomUUID(),
        templateVersionId: fixture.templateVersionId!,
        capabilityAlias: "video.cinematic",
        credits: 60,
        entitlementEligible: false,
        configurationHash: "a".repeat(64),
        expiresAt: new Date("2026-08-21T01:00:00.000Z"),
      }));
      const api = createGenerationApiService({
        repository: repo,
        generation: {
          createQuote,
          startRender,
          releaseRenderReservation: vi.fn(async () => ({} as never)),
        },
        pricing: createGenerationPricingFromEnvironment({
          GENERATION_PRICING_VERSION: "test-v1",
          GENERATION_QUOTE_TTL_SECONDS: "900",
          GENERATION_VIDEO_CINEMATIC_720P_CREDITS_PER_SECOND: "10",
        }),
        capabilities: new CapabilityRegistry({
          "video.cinematic": {
            enabled: true,
            adapterId: "vercel-ai-gateway",
            providerModelId: "bytedance/seedance-2.5",
          },
        }),
      });

      await expect(api.createQuote({ projectVersionId: versionId }, session), malformed.label)
        .rejects.toMatchObject({ code: "invalid_campaign_configuration" });
      expect(repo.findPublishedTemplateVersion, malformed.label).not.toHaveBeenCalled();
      expect(repo.findOwnedReferenceAssets, malformed.label).not.toHaveBeenCalled();
      expect(createQuote, malformed.label).not.toHaveBeenCalled();

      await expect(api.startRender({
        userId,
        projectId,
        projectVersionId: versionId,
        quoteId: randomUUID(),
        idempotencyKey: `historic-template-${randomUUID()}`,
      }), malformed.label).rejects.toMatchObject({ code: "invalid_campaign_configuration" });
      expect(repo.findOwnedQuote, malformed.label).not.toHaveBeenCalled();
      expect(startRender, malformed.label).not.toHaveBeenCalled();
    }
  });

  it("rejects direct template estimates without the strict campaign payload before catalog or pricing work", async () => {
    const { api, repo } = quoteApi();
    const malformed = {
      prompt: "A product reveal",
      durationSeconds: 6,
      aspectRatio: "9:16",
      resolution: "720p",
      audio: true,
      references: [],
    } as GenerationConfiguration;

    await expect(api.createQuote({ templateVersionId, configuration: malformed }, null)).rejects.toMatchObject({
      code: "invalid_campaign_configuration",
    });
    expect(repo.findPublishedTemplateVersion).not.toHaveBeenCalled();

    const hiddenOuterValue = {
      ...strictTemplateEstimate(templateVersionId),
      hiddenProviderModel: "unapproved-provider-model",
    } as GenerationConfiguration;
    await expect(api.createQuote({ templateVersionId, configuration: hiddenOuterValue }, null)).rejects.toMatchObject({
      code: "invalid_campaign_configuration",
    });
    expect(repo.findPublishedTemplateVersion).not.toHaveBeenCalled();
  });

  it("returns a configuration-bound estimate only for a matching published template", async () => {
    const { api } = quoteApi();

    await expect(api.createQuote({
      capability: "video.product_fidelity",
      templateVersionId,
      configuration: quoteConfiguration(),
    }, null)).resolves.toMatchObject({
      quoteId: null,
      credits: 60,
      estimateOnly: true,
    });
  });

  it("chooses the published service-template capability for guest quotes instead of the browser preference", async () => {
    const { api } = quoteApi();

    await expect(api.createQuote({
      capability: "video.product_fidelity",
      templateVersionId,
      configuration: quoteConfiguration(),
    }, null)).resolves.toMatchObject({
      capability: "video.cinematic",
      estimateOnly: true,
    });
  });

  it("chooses product fidelity only when the immutable template requires a reference image", async () => {
    const productTemplate = {
      ...eligibleTemplate(),
      eligibility: {
        ...eligibleTemplate().eligibility!,
        requiredInputs: ["product_image", "subject_name", "call_to_action"],
        capabilityPolicy: ["video.cinematic", "video.product_fidelity"],
      },
    };
    const { api } = quoteApi(productTemplate);

    await expect(api.createQuote({
      templateVersionId,
      configuration: strictTemplateEstimate(templateVersionId, ({ configuration }) => {
        configuration.generation.references = [{ objectKey: "guest-reference", mimeType: "image/jpeg" }];
      }),
    }, null)).resolves.toMatchObject({ capability: "video.product_fidelity" });
  });

  it.each(LAUNCH_CREATIVE_TEMPLATE_CATALOG)("estimates $id without an optional brand", async template => {
    const published = {
      ...eligibleTemplate(),
      eligibility: {
        ...eligibleTemplate().eligibility!,
        goals: template.goals,
        requiredInputs: template.requiredInputs,
        capabilityPolicy: ["video.cinematic"],
      },
    };
    const { api } = quoteApi(published);
    const config = strictTemplateEstimate(templateVersionId, payload => {
      const update = (value: unknown): void => {
        if (Array.isArray(value)) {
          for (let index = value.length - 1; index >= 0; index--) {
            if (value[index]?.field === "brand") value.splice(index, 1);
            else update(value[index]);
          }
          return;
        }
        if (!value || typeof value !== "object") return;
        const record = value as Record<string, unknown>;
        for (const key of Object.keys(record)) {
          if (key === "brand") record[key] = "";
          else if (key === "goal") record[key] = template.goals[0];
          else if (key === "whatsapp") record[key] = "+96550000000";
          else if (key === "bookingUrl") record[key] = "https://booking.example.test/appointments";
          else update(record[key]);
        }
      };
      update(payload);
      const creator = payload.configuration.creatorProject as { source: { facts: unknown[] } };
      creator.source.facts.push({ field: "whatsapp", value: "+96550000000", provenance: "user_confirmed" }, { field: "booking_url", value: "https://booking.example.test/appointments", provenance: "user_confirmed" });
      payload.configuration.generation.references = [{ objectKey: "guest-reference", mimeType: "image/jpeg" }];
    });
    await expect(api.createQuote({ templateVersionId, configuration: config }, null)).resolves.toMatchObject({ estimateOnly: true, capability: "video.cinematic" });
  });

  it("opens a local development estimate before the browser image is privately claimed", async () => {
    const productTemplate = {
      ...eligibleTemplate(),
      eligibility: {
        ...eligibleTemplate().eligibility!,
        requiredInputs: ["product_image", "subject_name", "call_to_action"],
        capabilityPolicy: ["video.cinematic", "video.product_fidelity"],
      },
    };
    const { api } = quoteApi(productTemplate, true);

    await expect(api.createQuote({
      templateVersionId,
      configuration: strictTemplateEstimate(templateVersionId),
    }, null)).resolves.toMatchObject({
      capability: "video.product_fidelity",
      credits: 0,
      estimateOnly: true,
    });
  });

  it("prices a guest upload from its declared local image before private claim", async () => {
    const productTemplate = {
      ...eligibleTemplate(),
      eligibility: {
        ...eligibleTemplate().eligibility!,
        requiredInputs: ["product_image", "subject_name", "call_to_action"],
        capabilityPolicy: ["video.cinematic", "video.product_fidelity"],
      },
    };
    const { api } = quoteApi(productTemplate);

    await expect(api.createQuote({
      templateVersionId,
      configuration: strictTemplateEstimate(templateVersionId, ({ configuration }) => {
        const creatorProject = configuration.creatorProject as {
          product: { images: Array<Record<string, unknown>> };
        };
        creatorProject.product.images = [{
          id: randomUUID(),
          name: "customer-product.jpg",
          url: "",
          mimeType: "image/jpeg",
          source: "upload",
        }];
      }),
    }, null)).resolves.toMatchObject({
      capability: "video.product_fidelity",
      estimateOnly: true,
    });
  });

  it("uses the stored template policy for authenticated project-version quotes", async () => {
    const projectId = randomUUID();
    const versionId = randomUUID();
    const repo = repository(ownedRun());
    const storedQuote = vi.fn(async () => ({
      id: randomUUID(),
      credits: 80,
      entitlementEligible: false,
      configurationHash: "a".repeat(64),
      expiresAt: new Date("2026-08-20T18:00:00.000Z"),
      breakdown: [{ label: "test", credits: 80 }],
    } as never));
    repo.findOwnedProjectVersion = vi.fn(async () => ({
      id: versionId,
      projectId,
      mode: "advanced" as const,
      templateVersionId,
      configuration: { generation: quoteConfiguration() },
    }));
    repo.findPublishedTemplateVersion = vi.fn(async () => eligibleTemplate());
    const api = createGenerationApiService({
      repository: repo,
      generation: {
        createQuote: storedQuote,
        startRender: vi.fn(async () => ({} as never)),
        releaseRenderReservation: vi.fn(async () => ({} as never)),
      },
      pricing: createGenerationPricingFromEnvironment({
        GENERATION_PRICING_VERSION: "test-v1",
        GENERATION_QUOTE_TTL_SECONDS: "900",
        GENERATION_VIDEO_CINEMATIC_720P_CREDITS_PER_SECOND: "10",
      }),
      capabilities: new CapabilityRegistry({
        "video.cinematic": {
          enabled: true,
          adapterId: "vercel-ai-gateway",
          providerModelId: "bytedance/seedance-2.5",
        },
      }),
    });

    await expect(api.createQuote({ projectVersionId: versionId }, {
      user: { id: randomUUID(), email: "owner@example.test", emailVerified: true, name: "Owner", role: "user" },
      session: { id: "session" },
    })).resolves.toMatchObject({ capability: "video.cinematic", estimateOnly: false });
    expect(storedQuote).toHaveBeenCalledWith(expect.objectContaining({ capabilityAlias: "video.cinematic" }));
  });

  it("rejects a catalog-ineligible goal before returning an estimate or credits", async () => {
    const { api } = quoteApi();

    await expect(api.createQuote({
      capability: "video.product_fidelity",
      templateVersionId,
      configuration: quoteConfiguration("offer"),
    }, null)).rejects.toMatchObject({
      code: "template_configuration_ineligible",
    } satisfies Partial<GenerationApplicationError>);
  });
});

describe("template quote rejection", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const projectId = "22222222-2222-4222-8222-222222222222";
  const versionId = "33333333-3333-4333-8333-333333333333";
  const templateVersionId = "44444444-4444-4444-8444-444444444444";

  const configuration = strictTemplateEstimate(templateVersionId);

  function publishedTemplate(overrides: Record<string, unknown> = {}) {
    return {
      id: templateVersionId,
      durationSeconds: 8,
      starterRenderEligible: false,
      eligibility: {
        goals: ["launch"],
        supportedLanguages: ["en"],
        supportedRatios: ["9:16"],
        supportedMarkets: ["KW"],
        requiredInputs: ["subject_name", "call_to_action"],
        capabilityPolicy: ["video.cinematic"],
        ...overrides,
      },
    };
  }

  function apiFor(template = publishedTemplate()) {
    const repo = repository(ownedRun());
    const createQuote = vi.fn(async () => ({
      id: randomUUID(),
      credits: 80,
      entitlementEligible: false,
      configurationHash: "a".repeat(64),
      expiresAt: new Date("2026-08-20T15:00:00.000Z"),
      breakdown: [{ label: "test", credits: 80 }],
    } as never));
    const startRender = vi.fn(async () => ownedRun({ projectId, projectVersionId: versionId }));
    repo.findPublishedTemplateVersion = vi.fn(async () => template);
    return {
      repo,
      createQuote,
      startRender,
      api: createGenerationApiService({
        repository: repo,
        generation: {
          createQuote,
          startRender,
          releaseRenderReservation: vi.fn(async () => ({} as never)),
        },
        pricing: createGenerationPricingFromEnvironment({
          GENERATION_PRICING_VERSION: "test-v1",
          GENERATION_QUOTE_TTL_SECONDS: "900",
          GENERATION_VIDEO_CINEMATIC_720P_CREDITS_PER_SECOND: "10",
        }),
        capabilities: new CapabilityRegistry({
          "video.cinematic": {
            enabled: true,
            adapterId: "vercel-ai-gateway",
            providerModelId: "bytedance/seedance-2.5",
          },
        }),
      }),
    };
  }

  const session = {
    user: { id: userId, email: "owner@example.test", emailVerified: true, name: "Owner", role: "user" as const },
    session: { id: "session" },
  };

  it("rejects a guest configuration that omits a catalog-required input without returning credits", async () => {
    const { api, createQuote } = apiFor(publishedTemplate({ requiredInputs: ["primary_reference"] }));

    await expect(api.createQuote({
      capability: "video.cinematic",
      templateVersionId,
      configuration,
    }, null)).rejects.toMatchObject({ code: "template_configuration_ineligible" });
    expect(createQuote).not.toHaveBeenCalled();
  });

  it("pins the published visual recipe while allowing confirmed copy changes", async () => {
    const config = strictTemplateEstimate(templateVersionId);
    const brief = config.creativeBrief as Record<string, unknown>;
    const visualRecipe = { versionNumber: 3, promptVersion: "test-v3", visualSystem: "Warm studio", scenes: structuredClone(brief.scenes) as Array<Record<string, unknown>> };
    Object.assign(brief, { templateRecipeVersion: 3, templatePromptVersion: "test-v3", templateVisualSystem: "Warm studio" });
    const campaign = config.templateCampaign as { configuration: { generation: Record<string, unknown> } };
    campaign.configuration.generation.creativeBrief = brief;
    const { api } = apiFor({ ...publishedTemplate(), durationSeconds: config.durationSeconds, visualRecipe });
    await expect(api.createQuote({ templateVersionId, configuration: config }, null)).resolves.toMatchObject({ estimateOnly: true });
    (brief.scenes as Array<Record<string, unknown>>)[0]!.direction = "An unrelated visual style";
    await expect(api.createQuote({ templateVersionId, configuration: config }, null)).rejects.toMatchObject({ code: "template_configuration_ineligible", message: expect.stringContaining("older template recipe") });
  });

  it("accepts a chosen length by re-splitting the published beats", async () => {
    const config = strictTemplateEstimate(templateVersionId);
    const brief = config.creativeBrief as Record<string, unknown>;
    const visualRecipe = { versionNumber: 3, promptVersion: "test-v3", visualSystem: "Warm studio", scenes: structuredClone(brief.scenes) as Array<Record<string, unknown>> };
    Object.assign(brief, { templateRecipeVersion: 3, templatePromptVersion: "test-v3", templateVisualSystem: "Warm studio" });
    const templateDuration = config.durationSeconds as number;
    const { api } = apiFor({ ...publishedTemplate(), durationSeconds: templateDuration, visualRecipe });

    const rebuilt = rebuildTemplateScenesForDuration(visualRecipe.scenes, 15);
    const longer = { ...config, durationSeconds: 15, creativeBrief: { ...brief, scenes: rebuilt } } as GenerationConfiguration;
    const longerCampaign = longer.templateCampaign as { configuration: { generation: Record<string, unknown> } };
    longerCampaign.configuration.generation = { ...longerCampaign.configuration.generation, durationSeconds: 15, creativeBrief: longer.creativeBrief };
    await expect(api.createQuote({ templateVersionId, configuration: longer }, null)).resolves.toMatchObject({ estimateOnly: true });

    // A length outside the offered set never matches the re-split beats.
    const unsupported = { ...longer, durationSeconds: 9 } as GenerationConfiguration;
    await expect(api.createQuote({ templateVersionId, configuration: unsupported }, null)).rejects.toThrow();
  });

  it("rejects a template that requires a booking destination before quote and submission", async () => {
    const bookingTemplate = publishedTemplate({
      goals: ["launch"],
      requiredInputs: ["subject_name", "booking_destination"],
    });
    const { api, createQuote, repo, startRender } = apiFor(bookingTemplate);

    await expect(api.createQuote({
      capability: "video.cinematic",
      templateVersionId,
      configuration,
    }, null)).rejects.toMatchObject({ code: "template_configuration_ineligible" });
    expect(createQuote).not.toHaveBeenCalled();

    const boundConfiguration = {
      capability: "video.cinematic",
      pricingVersion: "test-v1",
      templateVersionId,
      generation: configuration,
    };
    repo.findOwnedProjectVersion = vi.fn(async () => ({
      id: versionId,
      projectId,
      mode: "advanced" as const,
      templateVersionId,
      configuration: { generation: configuration },
    }));
    repo.findOwnedQuote = vi.fn(async () => ({
      id: "55555555-5555-4555-8555-555555555555",
      templateVersionId,
      capabilityAlias: "video.cinematic",
      credits: 80,
      entitlementEligible: false,
      configurationHash: hashGenerationConfiguration(boundConfiguration),
      expiresAt: new Date("2026-08-20T18:00:00.000Z"),
    }));

    await expect(api.startRender({
      userId,
      projectId,
      projectVersionId: versionId,
      quoteId: "55555555-5555-4555-8555-555555555555",
      idempotencyKey: "booking-whatsapp-only",
    })).rejects.toMatchObject({ code: "template_configuration_ineligible" });
    expect(startRender).not.toHaveBeenCalled();
  });

  it("rejects an owned project configuration that contradicts the published language policy", async () => {
    const { api, createQuote, repo } = apiFor();
    const languageMismatch = strictTemplateEstimate(templateVersionId, ({ configuration, campaignRecipe }) => {
      configuration.creatorProject.language = "ar";
      const generation = configuration.generation;
      (generation.templateQuoteContext as Record<string, unknown>).language = "ar";
      (generation.creativeBrief as Record<string, unknown>).language = "ar";
      (generation.creativeBrief as Record<string, unknown>).arabicDialect = "kuwaiti";
      campaignRecipe.language = "ar";
    });
    repo.findOwnedProjectVersion = vi.fn(async () => ({
      id: versionId,
      projectId,
      mode: "advanced" as const,
      templateVersionId,
      configuration: { generation: languageMismatch },
    }));

    await expect(api.createQuote({ capability: "video.cinematic", projectVersionId: versionId }, session))
      .rejects.toMatchObject({ code: "template_configuration_ineligible" });
    expect(createQuote).not.toHaveBeenCalled();
  });

  it("revalidates published template eligibility at render submission before reserving work", async () => {
    const template = publishedTemplate({ goals: ["bookings"] });
    const { api, repo, startRender } = apiFor(template);
    const boundConfiguration = {
      capability: "video.cinematic",
      pricingVersion: "test-v1",
      templateVersionId,
      generation: configuration,
    };
    repo.findOwnedProjectVersion = vi.fn(async () => ({
      id: versionId,
      projectId,
      mode: "advanced" as const,
      templateVersionId,
      configuration: { generation: configuration },
    }));
    repo.findOwnedQuote = vi.fn(async () => ({
      id: "55555555-5555-4555-8555-555555555555",
      templateVersionId,
      capabilityAlias: "video.cinematic",
      credits: 80,
      entitlementEligible: false,
      configurationHash: hashGenerationConfiguration(boundConfiguration),
      expiresAt: new Date("2026-08-20T15:00:00.000Z"),
    }));

    await expect(api.startRender({
      userId,
      projectId,
      projectVersionId: versionId,
      quoteId: "55555555-5555-4555-8555-555555555555",
      idempotencyKey: "render-template-revalidate-1",
    })).rejects.toMatchObject({ code: "template_configuration_ineligible" });
    expect(startRender).not.toHaveBeenCalled();
  });

  for (const protectedInput of [
    "verified_clinic_identity",
    "confirmed_service",
    "approved_claims",
    "verified_qualification",
    "approved_transcript",
    "consented_before_video",
    "consented_after_video",
    "consented_customer_video",
    "consented_founder_reference",
    "consented_person_reference",
  ] as const) {
    it(`fails closed for protected ${protectedInput} on quote and render submission`, async () => {
      const template = publishedTemplate({ requiredInputs: [protectedInput] });
      const { api, createQuote, repo, startRender } = apiFor(template);

      await expect(api.createQuote({
        capability: "video.cinematic",
        templateVersionId,
        configuration,
      }, null)).rejects.toMatchObject({ code: "template_configuration_ineligible" });
      expect(createQuote).not.toHaveBeenCalled();

      const boundConfiguration = {
        capability: "video.cinematic",
        pricingVersion: "test-v1",
        templateVersionId,
        generation: configuration,
      };
      repo.findOwnedProjectVersion = vi.fn(async () => ({
        id: versionId,
        projectId,
        mode: "advanced" as const,
        templateVersionId,
        configuration: { generation: configuration },
      }));
      repo.findOwnedQuote = vi.fn(async () => ({
        id: "55555555-5555-4555-8555-555555555555",
        templateVersionId,
        capabilityAlias: "video.cinematic",
        credits: 80,
        entitlementEligible: false,
        configurationHash: hashGenerationConfiguration(boundConfiguration),
        expiresAt: new Date("2026-08-20T18:00:00.000Z"),
      }));

      await expect(api.startRender({
        userId,
        projectId,
        projectVersionId: versionId,
        quoteId: "55555555-5555-4555-8555-555555555555",
        idempotencyKey: `protected-${protectedInput}`,
      })).rejects.toMatchObject({ code: "template_configuration_ineligible" });
      expect(startRender).not.toHaveBeenCalled();
    });
  }
});

describe("presenter eligibility", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const projectId = "22222222-2222-4222-8222-222222222222";
  const versionId = "33333333-3333-4333-8333-333333333333";
  const templateVersionId = "44444444-4444-4444-8444-444444444444";
  const assetId = "55555555-5555-4555-8555-555555555555";
  const baseConfiguration = {
    generation: {
      prompt: "Create a consent-safe presenter campaign.",
      durationSeconds: 8,
      aspectRatio: "9:16" as const,
      resolution: "720p" as const,
      audio: true,
      references: [],
      templateQuoteContext: { market: "KW", language: "en", goal: "launch" },
      creativeBrief: { market: "KW", language: "en", goal: "launch", product: { name: "Confirmed item", callToAction: "Shop now" } },
    },
  };
  const template = {
    id: templateVersionId,
    durationSeconds: 8,
    starterRenderEligible: false,
    eligibility: {
      goals: ["launch"],
      supportedLanguages: ["en"],
      supportedRatios: ["9:16"],
      supportedMarkets: ["KW"],
      requiredInputs: ["subject_name", "call_to_action"],
      capabilityPolicy: ["video.cinematic"],
    },
    supportedLanguages: ["en"],
    presenterModes: ["none", "uploaded_spokesperson", "ai_ugc"] as const,
  };
  const session = {
    user: { id: userId, email: "owner@example.test", emailVerified: true, name: "Owner", role: "user" as const },
    session: { id: "session" },
  };

  function presenterApi(input: {
    presenter: unknown;
    footage?: { id: string; mimeType: string; sizeBytes: number; checksumSha256: string | null; durationMs: number | null } | null;
    aiUgcAvailable?: boolean;
  }) {
    const repo = repository(ownedRun());
    const createQuote = vi.fn(async () => ({
      id: "66666666-6666-4666-8666-666666666666",
      credits: 80,
      entitlementEligible: false,
      configurationHash: "a".repeat(64),
      expiresAt: new Date("2026-08-20T18:00:00.000Z"),
      breakdown: [{ label: "Seedance render", credits: 80 }],
    } as never));
    const startRender = vi.fn(async () => ({} as never));
    repo.findOwnedProjectVersion = vi.fn(async () => ({
      id: versionId,
      projectId,
      mode: "advanced" as const,
      templateVersionId,
      configuration: baseConfiguration,
      campaignRecipe: { language: "en", presenter: input.presenter },
    }));
    repo.findPublishedTemplateVersion = vi.fn(async () => template);
    repo.findOwnedPresenterFootageAsset = vi.fn(async () => input.footage ?? null);
    const api = createGenerationApiService({
      repository: repo,
      generation: {
        createQuote,
        startRender,
        releaseRenderReservation: vi.fn(async () => ({} as never)),
      },
      pricing: createGenerationPricingFromEnvironment({
        GENERATION_PRICING_VERSION: "test-v1",
        GENERATION_QUOTE_TTL_SECONDS: "900",
        GENERATION_VIDEO_CINEMATIC_720P_CREDITS_PER_SECOND: "10",
      }),
      capabilities: new CapabilityRegistry({
        "video.cinematic": { enabled: true, adapterId: "vercel-ai-gateway", providerModelId: "bytedance/seedance-2.5" },
        "presenter.ai_ugc": { enabled: input.aiUgcAvailable === true, adapterId: "presenter-adapter", providerModelId: "presenter-model" },
      }),
    });
    return { api, repo, createQuote, startRender };
  }

  it("rejects missing or foreign-equivalent spokesperson footage before quote persistence", async () => {
    const { api, repo, createQuote } = presenterApi({
      presenter: {
        mode: "uploaded_spokesperson",
        assetId,
        rights: { version: "person-media-rights-v1", assetId, personMediaRightsAttested: true },
      },
      footage: null,
    });
    await expect(api.createQuote({ capability: "video.cinematic", projectVersionId: versionId }, session))
      .rejects.toMatchObject({ code: "presenter_configuration_ineligible" });
    expect(repo.findOwnedPresenterFootageAsset).toHaveBeenCalledWith(userId, projectId, assetId);
    expect(createQuote).not.toHaveBeenCalled();
  });

  it("rejects AI UGC even when a generic capability flag is configured, and rejects unsupported identity types", async () => {
    const ai = presenterApi({ presenter: { mode: "ai_ugc" }, aiUgcAvailable: true });
    await expect(ai.api.createQuote({ capability: "video.cinematic", projectVersionId: versionId }, session))
      .rejects.toMatchObject({ code: "presenter_configuration_ineligible" });
    expect(ai.createQuote).not.toHaveBeenCalled();

    const twin = presenterApi({ presenter: { mode: "digital_twin" } });
    await expect(twin.api.createQuote({ capability: "video.cinematic", projectVersionId: versionId }, session))
      .rejects.toMatchObject({ code: "presenter_configuration_ineligible" });
    expect(twin.createQuote).not.toHaveBeenCalled();
    expect(twin.startRender).not.toHaveBeenCalled();
  });

  it("rejects selected presenters before a quote or render reservation until a provider adapter can honor them", async () => {
    const unavailable = presenterApi({
      presenter: {
        mode: "uploaded_spokesperson",
        assetId,
        rights: { version: "person-media-rights-v1", assetId, personMediaRightsAttested: true },
      },
      footage: {
        id: assetId,
        mimeType: "video/mp4",
        sizeBytes: 4_096,
        checksumSha256: "a".repeat(64),
        durationMs: 10_000,
      },
    });
    await expect(unavailable.api.createQuote({ capability: "video.cinematic", projectVersionId: versionId }, session))
      .rejects.toMatchObject({ code: "presenter_configuration_ineligible" });
    expect(unavailable.createQuote).not.toHaveBeenCalled();

    unavailable.repo.findOwnedQuote = vi.fn(async () => ({
      id: "77777777-7777-4777-8777-777777777777",
      templateVersionId,
      capabilityAlias: "video.cinematic",
      credits: 80,
      entitlementEligible: false,
      configurationHash: "a".repeat(64),
      expiresAt: new Date("2026-08-20T18:00:00.000Z"),
    }));
    await expect(unavailable.api.startRender({
      userId,
      projectId,
      projectVersionId: versionId,
      quoteId: "77777777-7777-4777-8777-777777777777",
      idempotencyKey: "presenter-denied-start",
    })).rejects.toMatchObject({ code: "presenter_configuration_ineligible" });
    expect(unavailable.startRender).not.toHaveBeenCalled();
  });
});
