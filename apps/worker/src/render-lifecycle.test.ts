import { randomUUID } from "node:crypto";
import type { GenerationJobPayload } from "@movprompt/contracts";
import { CREATIVE_TEMPLATE_CATALOG, ENGINE_VERSION } from "@movprompt/creative-engine";
import {
  CapabilityRegistry,
  ProviderAdapterRegistry,
  type ProviderAdapter,
} from "@movprompt/providers";
import { describe, expect, it, vi } from "vitest";

import type { WorkerJobContext } from "./handlers.js";
import type { WorkerLogger } from "./logger.js";
import {
  createGenerationLifecycleHandler,
  RenderLifecycleError,
  type GenerationLifecycleHandlerOptions,
  type RenderLifecycleSnapshot,
  type RenderLifecycleStore,
} from "./render-lifecycle.js";

function payload(): GenerationJobPayload {
  return {
    renderRunId: randomUUID(),
    userId: randomUUID(),
    projectId: randomUUID(),
    projectVersionId: randomUUID(),
    quoteId: randomUUID(),
    capability: "video.cinematic",
    idempotencyKey: `render.start:${randomUUID()}`,
    requestId: randomUUID(),
  };
}

function snapshot(job: GenerationJobPayload, overrides: Partial<RenderLifecycleSnapshot> = {}): RenderLifecycleSnapshot {
  return {
    id: job.renderRunId,
    userId: job.userId,
    projectId: job.projectId,
    projectVersionId: job.projectVersionId,
    quoteId: job.quoteId,
    capabilityAlias: job.capability,
    idempotencyKey: `generation:${randomUUID()}`,
    status: "submitting",
    processingStage: "preparing",
    provider: null,
    providerRequestId: null,
    chargedAt: null,
    refundStatus: "not_required",
    qualityAttempt: 0,
    maxQualityRetries: 2,
    qualityRetryDirective: null,
    configuration: { prompt: "Slow camera push toward a premium perfume bottle.", durationSeconds: 8 },
    ...overrides,
  };
}

function logger(): WorkerLogger {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function context(retryCount = 0, retryLimit = 5): WorkerJobContext {
  return {
    jobId: randomUUID(),
    jobName: "generation.render.v1",
    workerId: "worker-1",
    retryCount,
    retryLimit,
    signal: new AbortController().signal,
    logger: logger(),
  };
}

function store(current: RenderLifecycleSnapshot): RenderLifecycleStore {
  return {
    load: vi.fn(async () => current),
    beginProviderSubmission: vi.fn(async () => true),
    updateProviderStatus: vi.fn(async () => undefined),
    updateProcessingStage: vi.fn(async () => undefined),
    recordRetryableFailure: vi.fn(async () => undefined),
    recordProviderTelemetry: vi.fn(async () => undefined),
    complete: vi.fn(async () => undefined),
    markTerminal: vi.fn(async () => undefined),
    prepareQualityRetry: vi.fn(async () => undefined),
  };
}

function billing() {
  return {
    recordProviderSubmission: vi.fn(async () => ({} as never)),
    finalizeProviderAccepted: vi.fn(async () => ({} as never)),
    releaseRenderReservation: vi.fn(async () => ({} as never)),
    refundRender: vi.fn(async () => ({} as never)),
  } satisfies GenerationLifecycleHandlerOptions["billing"];
}

function registries(adapter?: ProviderAdapter) {
  const capabilityRegistry = new CapabilityRegistry({
    "video.cinematic": {
      enabled: true,
      adapterId: "test-provider",
      providerModelId: "server-private-model-id",
    },
  });
  const adapterRegistry = new ProviderAdapterRegistry();
  if (adapter) adapterRegistry.register(adapter);
  return { capabilityRegistry, adapterRegistry };
}

function adapter(overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
  return {
    id: "test-provider",
    capability: "video.cinematic",
    submit: vi.fn(async () => ({
      providerRequestId: "provider-request-1",
      status: "queued" as const,
      acceptedAt: "2026-08-12T12:00:00.000Z",
    })),
    getStatus: vi.fn(async (providerRequestId) => ({ providerRequestId, status: "processing" as const })),
    cancel: vi.fn(async (providerRequestId) => ({ providerRequestId, status: "cancelled" as const })),
    ...overrides,
  };
}

describe("generation render lifecycle", () => {
  it("persists unexpected database retry errors and logs their stage without raw messages", async () => {
    const job = payload(), current = snapshot(job), lifecycleStore = store(current), provider = adapter();
    vi.mocked(lifecycleStore.beginProviderSubmission).mockRejectedValue(Object.assign(new Error("E11000 sensitive internal details"), { code: 11000 }));
    const ctx = context();
    const handler = createGenerationLifecycleHandler({ store: lifecycleStore, billing: billing(), ...registries(provider), scheduleReconciliation: vi.fn() });
    await expect(handler.handle(job, ctx)).rejects.toThrow();
    expect(provider.submit).not.toHaveBeenCalled();
    expect(lifecycleStore.recordRetryableFailure).toHaveBeenCalledWith(expect.objectContaining({ errorCode: "generation_database_error" }));
    expect(ctx.logger.error).toHaveBeenCalledWith("render_stage_failed", expect.objectContaining({ renderRunId: job.renderRunId, requestId: job.requestId, errorCode: "generation_database_error", retrying: true }));
    expect(JSON.stringify(vi.mocked(ctx.logger.error).mock.calls)).not.toContain("sensitive internal details");
  });

  it("ends an unexpected database failure after the bounded retries rather than leaving the run loading", async () => {
    const job = payload(), current = snapshot(job), lifecycleStore = store(current), provider = adapter();
    vi.mocked(lifecycleStore.beginProviderSubmission).mockRejectedValue(Object.assign(new Error("E11000"), { code: 11000 }));
    const handler = createGenerationLifecycleHandler({ store: lifecycleStore, billing: billing(), ...registries(provider), scheduleReconciliation: vi.fn() });
    await handler.handle(job, context(5, 5));
    expect(provider.submit).not.toHaveBeenCalled();
    expect(lifecycleStore.markTerminal).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", errorCode: "generation_database_error" }));
  });
  it("fails closed and releases the hold when no approved adapter is configured", async () => {
    const job = payload();
    const current = snapshot(job);
    const renderStore = store(current);
    const renderBilling = billing();
    const handler = createGenerationLifecycleHandler({
      store: renderStore,
      billing: renderBilling,
      ...registries(),
      scheduleReconciliation: vi.fn(async () => undefined),
    });

    await expect(handler.handle(job, context())).resolves.toEqual({
      renderRunId: job.renderRunId,
      outcome: "reconciled",
    });
    expect(renderBilling.releaseRenderReservation).toHaveBeenCalledWith(
      expect.objectContaining({ runId: job.renderRunId, reason: "provider_operation_failed", terminalStatus: "failed" }),
    );
    expect(renderBilling.finalizeProviderAccepted).not.toHaveBeenCalled();
  });

  it("charges only after provider acceptance and schedules reconciliation", async () => {
    const job = payload();
    const current = snapshot(job);
    const renderBilling = billing();
    const submit = vi.fn(async () => ({
      providerRequestId: "provider-request-1",
      status: "queued" as const,
      acceptedAt: "2026-08-12T12:00:00.000Z",
    }));
    const provider = adapter({ submit });
    const beginProviderSubmission = vi.fn(async () => true);
    const renderStore = { ...store(current), beginProviderSubmission };
    const scheduleReconciliation = vi.fn(async () => undefined);
    const handler = createGenerationLifecycleHandler({
      store: renderStore,
      billing: renderBilling,
      ...registries(provider),
      scheduleReconciliation,
      now: () => new Date("2026-08-12T12:00:01.000Z"),
    });

    await expect(handler.handle(job, context())).resolves.toEqual({
      renderRunId: job.renderRunId,
      outcome: "accepted",
    });
    expect(provider.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: job.renderRunId,
        idempotencyKey: `provider.submit:${job.renderRunId}:0`,
        prompt: "Slow camera push toward a premium perfume bottle.",
        generateAudio: true,
        resolution: "720p",
      }),
    );
    expect(renderBilling.finalizeProviderAccepted).toHaveBeenCalledWith({
      userId: job.userId,
      runId: job.renderRunId,
      provider: "test-provider",
      providerRequestId: "provider-request-1",
      now: new Date("2026-08-12T12:00:01.000Z"),
    });
    expect(renderStore.beginProviderSubmission).toHaveBeenCalledWith(expect.objectContaining({
      runId: job.renderRunId,
      provider: "test-provider",
      attemptNumber: 0,
    }));
    expect(beginProviderSubmission.mock.invocationCallOrder[0])
      .toBeLessThan(submit.mock.invocationCallOrder[0]!);
    expect(scheduleReconciliation).toHaveBeenCalledWith(job, 15);
  });

  it("compiles a Kuwait-native premium template brief before provider submission", async () => {
    const job = payload();
    const template = CREATIVE_TEMPLATE_CATALOG[0]!;
    const current = snapshot(job, {
      configuration: {
        prompt: "Launch the confirmed fragrance.",
        durationSeconds: template.durationSeconds,
        aspectRatio: "4:5",
        resolution: "480p",
        audio: false,
        creativeBrief: {
          engineVersion: ENGINE_VERSION,
          templateId: template.id,
          market: "KW",
          language: "ar",
          arabicDialect: "kuwaiti",
          dialectRegister: template.dialectRegister,
          tone: template.tone,
          vertical: template.verticals[0],
          goal: template.goals[0],
          product: {
            name: "عطر نور",
            brand: "نور",
            description: "عطر شرقي",
            price: "24.500",
            offer: "",
            callToAction: "Order on WhatsApp",
            whatsapp: "+96550000000",
            location: "Kuwait",
          },
          scenes: template.scenes,
          qualityPolicy: template.qualityPolicy,
        },
      },
    });
    const provider = adapter();
    const handler = createGenerationLifecycleHandler({
      store: store(current),
      billing: billing(),
      ...registries(provider),
      scheduleReconciliation: vi.fn(async () => undefined),
    });

    await handler.handle(job, context());
    expect(provider.submit).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining("Native Kuwait Arabic (ar-KW)"),
    }));
    expect(provider.submit).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining("NON-NEGOTIABLE PRODUCT AND BUSINESS TRUTH"),
      durationSeconds: template.durationSeconds,
      aspectRatio: "4:5",
      resolution: "480p",
      generateAudio: false,
    }));
    expect(provider.submit).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining("Confirmed call to action: Order on WhatsApp"),
    }));
    expect(provider.submit).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining("MUTED OUTPUT"),
    }));
  });

  it("passes enabled campaign audio through for synchronized presenter speech", async () => {
    const job = payload();
    const template = CREATIVE_TEMPLATE_CATALOG.find((item) => item.capabilityPolicy.includes("speech.lip_sync"))!;
    const current = snapshot(job, {
      configuration: {
        prompt: "A consented Kuwaiti presenter shares a factual review.",
        durationSeconds: template.durationSeconds,
        creativeBrief: {
          engineVersion: ENGINE_VERSION,
          templateId: template.id,
          market: "KW",
          language: "ar",
          arabicDialect: "kuwaiti",
          dialectRegister: template.dialectRegister,
          tone: template.tone,
          vertical: template.verticals[0],
          goal: template.goals[0],
          product: {
            name: "عطر نور",
            brand: "نور",
            description: "عطر شرقي",
            price: "24.500",
            offer: "",
            callToAction: "Order on WhatsApp",
            whatsapp: "+96550000000",
            location: "Kuwait",
          },
          scenes: template.scenes,
          qualityPolicy: template.qualityPolicy,
        },
      },
    });
    const provider = adapter();
    const handler = createGenerationLifecycleHandler({
      store: store(current),
      billing: billing(),
      ...registries(provider),
      scheduleReconciliation: vi.fn(async () => undefined),
    });

    await handler.handle(job, context());
    expect(provider.submit).toHaveBeenCalledWith(expect.objectContaining({
      generateAudio: true,
      prompt: expect.stringContaining("SYNCHRONIZED PRESENTER SPEECH"),
    }));
  });

  it("never releases after acceptance when reconciliation scheduling fails", async () => {
    const job = payload();
    const current = snapshot(job);
    const renderBilling = billing();
    const provider = adapter();
    const handler = createGenerationLifecycleHandler({
      store: store(current),
      billing: renderBilling,
      ...registries(provider),
      scheduleReconciliation: vi.fn(async () => Promise.reject(new Error("queue unavailable"))),
    });

    await expect(handler.handle(job, context())).rejects.toMatchObject({
      code: "reconciliation_schedule_failed",
      retryable: true,
    });
    expect(renderBilling.recordProviderSubmission).toHaveBeenCalledTimes(1);
    expect(renderBilling.finalizeProviderAccepted).toHaveBeenCalledTimes(1);
    expect(renderBilling.releaseRenderReservation).not.toHaveBeenCalled();
  });

  it("does not resubmit after provider identity was persisted but charge finalization failed", async () => {
    const job = payload();
    let current = snapshot(job);
    const load = vi.fn(async () => current);
    const renderStore = { ...store(current), load };
    const recordProviderSubmission = vi.fn(async (input: Parameters<GenerationLifecycleHandlerOptions["billing"]["recordProviderSubmission"]>[0]) => {
      current = {
        ...current,
        provider: input.provider,
        providerRequestId: input.providerRequestId,
      };
      return {} as never;
    });
    const finalizeProviderAccepted = vi.fn(async () => ({} as never));
    finalizeProviderAccepted.mockRejectedValueOnce(new Error("database timeout"));
    const renderBilling = {
      ...billing(),
      recordProviderSubmission,
      finalizeProviderAccepted,
    };
    const provider = adapter();
    const handler = createGenerationLifecycleHandler({
      store: renderStore,
      billing: renderBilling,
      ...registries(provider),
      scheduleReconciliation: vi.fn(async () => undefined),
    });

    await expect(handler.handle(job, context())).rejects.toMatchObject({
      code: "provider_acceptance_not_finalized",
      retryable: true,
    });
    expect(renderBilling.releaseRenderReservation).not.toHaveBeenCalled();

    // The next queue retry sees the persisted provider request and reconciles
    // it instead of calling submit again.
    await handler.handle(job, context());
    expect(provider.submit).toHaveBeenCalledTimes(1);
    expect(provider.getStatus).toHaveBeenCalledWith("provider-request-1");
    expect(renderBilling.finalizeProviderAccepted).toHaveBeenCalledTimes(2);
  });

  it("leaves a transient pre-acceptance failure for MongoDB worker retry, then releases on final retry", async () => {
    const job = payload();
    const failure = new Error("provider temporarily unavailable");
    const provider = adapter({ submit: vi.fn(async () => Promise.reject(failure)) });
    const current = snapshot(job);
    const renderBilling = billing();
    const handler = createGenerationLifecycleHandler({
      store: store(current),
      billing: renderBilling,
      ...registries(provider),
      scheduleReconciliation: vi.fn(async () => undefined),
    });

    await expect(handler.handle(job, context(0, 5))).rejects.toThrow("provider temporarily unavailable");
    expect(renderBilling.releaseRenderReservation).not.toHaveBeenCalled();

    await expect(handler.handle(job, context(5, 5))).resolves.toEqual({
      renderRunId: job.renderRunId,
      outcome: "reconciled",
    });
    expect(renderBilling.releaseRenderReservation).toHaveBeenCalledTimes(1);
  });

  it("marks terminal provider failure and refunds the charged render exactly through billing", async () => {
    const job = payload();
    const current = snapshot(job, {
      status: "processing",
      provider: "test-provider",
      providerRequestId: "provider-request-1",
      chargedAt: new Date("2026-08-12T12:00:00.000Z"),
    });
    const provider = adapter({
      getStatus: vi.fn(async () => ({
        providerRequestId: "provider-request-1",
        status: "failed" as const,
        errorCode: "provider_invalid_result",
      })),
    });
    const renderStore = store(current);
    const renderBilling = billing();
    const handler = createGenerationLifecycleHandler({
      store: renderStore,
      billing: renderBilling,
      ...registries(provider),
      scheduleReconciliation: vi.fn(async () => undefined),
    });

    await handler.handle(job, context());
    expect(renderStore.markTerminal).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", errorCode: "provider_invalid_result" }),
    );
    expect(renderBilling.refundRender).toHaveBeenCalledWith(
      expect.objectContaining({ runId: job.renderRunId, reason: "provider_invalid_result" }),
    );
  });

  it("keeps a cancellation pending until the provider confirms a terminal state", async () => {
    const job = payload();
    const current = snapshot(job, {
      status: "cancelling",
      provider: "test-provider",
      providerRequestId: "provider-request-1",
      chargedAt: new Date("2026-08-12T12:00:00.000Z"),
    });
    const provider = adapter({
      cancel: vi.fn(async (providerRequestId) => ({ providerRequestId, status: "processing" as const })),
    });
    const renderStore = store(current);
    const renderBilling = billing();
    const scheduleReconciliation = vi.fn(async () => undefined);
    const handler = createGenerationLifecycleHandler({
      store: renderStore,
      billing: renderBilling,
      ...registries(provider),
      scheduleReconciliation,
    });

    await handler.handle(job, context());
    expect(renderStore.updateProviderStatus).toHaveBeenCalledWith(expect.objectContaining({
      status: "cancelling",
    }));
    expect(scheduleReconciliation).toHaveBeenCalledWith(job, 15);
    expect(renderStore.markTerminal).not.toHaveBeenCalled();
    expect(renderBilling.refundRender).not.toHaveBeenCalled();
  });

  it("persists provider output before completing the render", async () => {
    const job = payload();
    const current = snapshot(job, {
      status: "processing",
      provider: "test-provider",
      providerRequestId: "provider-request-1",
      chargedAt: new Date("2026-08-12T12:00:00.000Z"),
    });
    const provider = adapter({
      getStatus: vi.fn(async () => ({
        providerRequestId: "provider-request-1",
        status: "completed" as const,
        outputUrl: "https://provider.example/output.mp4",
        telemetry: {
          providerCostMicrousd: 934_110,
          providerLatencyMs: 183_023,
          usage: { gateway_provider: "ByteDance", provider_total_tokens: 86_000 },
        },
      })),
    });
    const renderStore = store(current);
    const persist = vi.fn(async () => ({
      bucket: "creator-outputs",
      objectKey: `${job.userId}/${job.projectId}/${job.renderRunId}.mp4`,
    }));
    const handler = createGenerationLifecycleHandler({
      store: renderStore,
      billing: billing(),
      ...registries(provider),
      outputPersister: { persist },
      outputQualityReviewer: {
        review: vi.fn(async () => ({ status: "accepted", score: 96, failedDimensions: [] })),
      },
      scheduleReconciliation: vi.fn(async () => undefined),
    });

    await handler.handle(job, context());
    expect(renderStore.recordProviderTelemetry).toHaveBeenCalledWith(expect.objectContaining({
      runId: job.renderRunId,
      attemptNumber: 0,
      providerCostMicrousd: 934_110,
      providerLatencyMs: 183_023,
      providerUsage: { gateway_provider: "ByteDance", provider_total_tokens: 86_000 },
    }));
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ sourceUrl: "https://provider.example/output.mp4" }));
    expect(renderStore.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: job.renderRunId,
        outputBucket: "creator-outputs",
      }),
    );
  });

  it("records post-provider output failures and becomes terminal on the final queue attempt", async () => {
    const job = payload();
    const current = snapshot(job, {
      status: "processing",
      processingStage: "rendering",
      provider: "test-provider",
      providerRequestId: "provider-request-1",
      chargedAt: new Date("2026-08-12T12:00:00.000Z"),
    });
    const provider = adapter({
      getStatus: vi.fn(async () => ({
        providerRequestId: "provider-request-1",
        status: "completed" as const,
        outputUrl: "https://provider.example/output.mp4",
      })),
    });
    const renderStore = store(current);
    const renderBilling = billing();
    const handler = createGenerationLifecycleHandler({
      store: renderStore,
      billing: renderBilling,
      ...registries(provider),
      outputPersister: {
        persist: vi.fn(async () => {
          throw new RenderLifecycleError("provider_output_host_not_allowed", true, "provider_output_host_not_allowed:provider.example");
        }),
      },
      outputQualityReviewer: {
        review: vi.fn(async () => ({ status: "accepted", score: 96, failedDimensions: [] })),
      },
      scheduleReconciliation: vi.fn(async () => undefined),
    });

    await expect(handler.handle(job, context(0, 5))).rejects.toThrow("provider_output_host_not_allowed");
    expect(renderStore.updateProcessingStage).toHaveBeenCalledWith(expect.objectContaining({ stage: "securing_output" }));
    expect(renderStore.recordRetryableFailure).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: "provider_output_host_not_allowed",
    }));

    await expect(handler.handle(job, context(5, 5))).resolves.toEqual({
      renderRunId: job.renderRunId,
      outcome: "reconciled",
    });
    expect(renderStore.markTerminal).toHaveBeenCalledWith(expect.objectContaining({
      status: "failed",
      errorCode: "provider_output_host_not_allowed",
    }));
    expect(renderBilling.refundRender).toHaveBeenCalledOnce();
  });

  it("durably queues an internal retry when a candidate misses the premium quality gate", async () => {
    const job = payload();
    const current = snapshot(job, {
      status: "processing",
      provider: "test-provider",
      providerRequestId: "provider-request-1",
      chargedAt: new Date("2026-08-12T12:00:00.000Z"),
    });
    const provider = adapter({
      getStatus: vi.fn(async () => ({
        providerRequestId: "provider-request-1",
        status: "completed" as const,
        outputUrl: "https://provider.example/output.mp4",
      })),
    });
    const renderStore = store(current);
    const renderBilling = billing();
    const handler = createGenerationLifecycleHandler({
      store: renderStore,
      billing: renderBilling,
      ...registries(provider),
      outputPersister: {
        persist: vi.fn(async () => ({ bucket: "creator-outputs", objectKey: "candidate.mp4" })),
      },
      outputQualityReviewer: {
        review: vi.fn(async () => ({
          status: "retry",
          score: 71,
          failedDimensions: ["product_identity"],
          retryDirective: "Strengthen the product identity lock",
        })),
      },
      scheduleReconciliation: vi.fn(async () => undefined),
    });

    await handler.handle(job, context());
    expect(renderStore.complete).not.toHaveBeenCalled();
    expect(renderStore.prepareQualityRetry).toHaveBeenCalledWith(expect.objectContaining({
      runId: job.renderRunId,
      attemptNumber: 0,
      maxRetries: 2,
      outputObjectKey: "candidate.mp4",
      decision: expect.objectContaining({ status: "retry", score: 71 }),
    }));
    expect(renderStore.markTerminal).not.toHaveBeenCalled();
    expect(renderBilling.refundRender).not.toHaveBeenCalled();
  });

  it("uses a new provider idempotency key and targeted directive for each quality retry", async () => {
    const job = payload();
    const current = snapshot(job, {
      qualityAttempt: 1,
      qualityRetryDirective: "Preserve the exact bottle label and remove hand artifacts.",
      chargedAt: new Date("2026-08-12T12:00:00.000Z"),
    });
    const provider = adapter();
    const handler = createGenerationLifecycleHandler({
      store: store(current),
      billing: billing(),
      ...registries(provider),
      scheduleReconciliation: vi.fn(async () => undefined),
    });

    await handler.handle(job, context());
    expect(provider.submit).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: `provider.submit:${job.renderRunId}:1`,
      prompt: expect.stringContaining("Preserve the exact bottle label"),
    }));
  });

  it("never permits a third internal quality retry even if an old run stored a larger budget", async () => {
    const job = payload();
    const current = snapshot(job, {
      status: "processing",
      provider: "test-provider",
      providerRequestId: "provider-request-1",
      chargedAt: new Date("2026-08-12T12:00:00.000Z"),
      maxQualityRetries: 3,
    });
    const provider = adapter({
      getStatus: vi.fn(async () => ({
        providerRequestId: "provider-request-1",
        status: "completed" as const,
        outputUrl: "https://provider.example/output.mp4",
      })),
    });
    const renderStore = store(current);
    const handler = createGenerationLifecycleHandler({
      store: renderStore,
      billing: billing(),
      ...registries(provider),
      outputPersister: {
        persist: vi.fn(async () => ({ bucket: "creator-outputs", objectKey: "candidate.mp4" })),
      },
      outputQualityReviewer: {
        review: vi.fn(async () => ({
          status: "retry",
          score: 71,
          failedDimensions: ["motion_realism"],
          retryDirective: "Simplify the camera movement.",
        })),
      },
      scheduleReconciliation: vi.fn(async () => undefined),
    });

    await handler.handle(job, context());
    expect(renderStore.prepareQualityRetry).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 2 }));
  });
});
