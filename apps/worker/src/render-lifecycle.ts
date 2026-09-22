import type { GenerationJobPayload } from "@movprompt/contracts";
import {
  CreativeBriefSchema,
  compileCreativeDirection,
  preflightCreativeBrief,
  type QualityDecision,
} from "@movprompt/creative-engine";
import type { GenerationService, JsonObject } from "@movprompt/db";
import {
  CapabilityResolutionError,
  type CapabilityRegistry,
  type ProviderAdapter,
  type ProviderAdapterRegistry,
  type ProviderGenerationRequest,
  type ProviderOperation,
} from "@movprompt/providers";
import { z } from "zod";

import type { GenerationJobHandler, GenerationJobResult, WorkerJobContext } from "./handlers.js";

const GenerationConfigurationSchema = z
  .object({
    prompt: z.string().trim().min(1).max(8_000),
    durationSeconds: z.number().int().min(1).max(60).optional(),
    aspectRatio: z.enum(["9:16", "1:1", "4:5", "16:9"]).optional(),
    resolution: z.enum(["480p", "720p"]).default("720p"),
    audio: z.boolean().default(true),
    references: z
      .array(
        z
          .object({
            objectKey: z.string().trim().min(1).max(1_024),
            mimeType: z.string().trim().min(1).max(255),
          })
          .strict(),
      )
      .max(12)
      .default([]),
  })
  .passthrough();

const MAX_INTERNAL_QUALITY_RETRIES = 2;
const QUALITY_RETRY_DIRECTIVES: Record<QualityDecision["failedDimensions"][number], string> = {
  technical: "Restore the requested delivery media quality without changing campaign facts.",
  product_identity: "Match the confirmed product, packaging, label, logo and colour reference exactly.",
  prompt_adherence: "Follow the approved story, subject, camera and action without adding unconfirmed details.",
  motion_realism: "Use one physically plausible motion and remove unstable movement.",
  visual_artifacts: "Remove flicker, warped geometry, broken hands and reflection artifacts.",
  brand_safety: "Remove misleading or unsafe visual material while preserving confirmed facts.",
  dialect_fidelity: "Use the approved Kuwait Arabic and preserve correct Arabic and bilingual text order.",
  speech_sync: "Synchronize visible speech to the approved line or remove the speaking presenter.",
  safe_zones: "Keep subjects clear of protected price, logo, subtitle and CTA safe zones.",
  compliance: "Remove unconfirmed claims, transformations and consent-sensitive material.",
};

function deterministicQualityRetryDirective(failedDimensions: QualityDecision["failedDimensions"]): string {
  const unique = [...new Set(failedDimensions)];
  if (!unique.length || unique.some((dimension) => !(dimension in QUALITY_RETRY_DIRECTIVES))) {
    throw new RenderLifecycleError("quality_retry_directive_invalid", false);
  }
  return unique
    .sort((left, right) => left.localeCompare(right))
    .map((dimension) => QUALITY_RETRY_DIRECTIVES[dimension])
    .join(" ");
}

type RenderStatus =
  | "submitting"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelling"
  | "cancelled";

export type RenderLifecycleSnapshot = {
  id: string;
  userId: string;
  projectId: string;
  projectVersionId: string;
  quoteId: string;
  capabilityAlias: string;
  idempotencyKey: string;
  status: RenderStatus;
  processingStage: "preparing" | "rendering" | "securing_output" | "quality_review" | "ready" | "cancelling" | "failed" | "cancelled";
  provider: string | null;
  providerRequestId: string | null;
  chargedAt: Date | null;
  refundStatus: "not_required" | "pending" | "refunded";
  qualityAttempt: number;
  maxQualityRetries: number;
  qualityRetryDirective: string | null;
  configuration: JsonObject;
};

export interface RenderLifecycleStore {
  load(payload: GenerationJobPayload): Promise<RenderLifecycleSnapshot>;
  beginProviderSubmission(input: {
    runId: string;
    userId: string;
    provider: string;
    attemptNumber: number;
    now: Date;
  }): Promise<boolean>;
  updateProviderStatus(input: {
    runId: string;
    userId: string;
    status: "queued" | "processing" | "cancelling";
    attemptNumber: number;
    now: Date;
  }): Promise<void>;
  updateProcessingStage(input: {
    runId: string;
    userId: string;
    stage: "securing_output" | "quality_review";
    now: Date;
  }): Promise<void>;
  recordRetryableFailure(input: {
    runId: string;
    userId: string;
    errorCode: string;
    errorMessage: string;
    now: Date;
  }): Promise<void>;
  recordProviderTelemetry(input: {
    runId: string;
    userId: string;
    attemptNumber: number;
    providerCostMicrousd?: number;
    providerLatencyMs?: number;
    providerUsage?: JsonObject;
    now: Date;
  }): Promise<void>;
  complete(input: {
    runId: string;
    userId: string;
    outputBucket: string;
    outputObjectKey: string;
    attemptNumber: number;
    now: Date;
  }): Promise<void>;
  markTerminal(input: {
    runId: string;
    userId: string;
    status: "failed" | "cancelled";
    errorCode: string;
    errorMessage?: string;
    attemptNumber: number;
    now: Date;
  }): Promise<void>;
  prepareQualityRetry(input: {
    runId: string;
    userId: string;
    attemptNumber: number;
    maxRetries: number;
    outputBucket: string;
    outputObjectKey: string;
    decision: QualityDecision;
    now: Date;
  }): Promise<void>;
}

export interface RenderOutputPersister {
  persist(input: {
    runId: string;
    userId: string;
    projectId: string;
    projectVersionId: string;
    attemptNumber: number;
    sourceUrl: string;
    configuration: JsonObject;
  }): Promise<{ bucket: string; objectKey: string }>;
}

export interface RenderOutputQualityReviewer {
  review(input: {
    runId: string;
    userId: string;
    projectId: string;
    projectVersionId: string;
    bucket: string;
    objectKey: string;
    attemptNumber: number;
    configuration: JsonObject;
  }): Promise<QualityDecision>;
}

export type ScheduleRenderReconciliation = (
  payload: GenerationJobPayload,
  delaySeconds: number,
) => Promise<void>;

export class RenderLifecycleError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    message = code,
  ) {
    super(message);
    this.name = "RenderLifecycleError";
  }
}

function cleanError(error: unknown): { code: string; message: string } {
  if (error && typeof error === "object" && "code" in error && [11000, 121].includes(Number(error.code))) {
    return { code: "generation_database_error", message: "MongoDB could not record this generation. Your campaign is saved." };
  }
  if (error instanceof RenderLifecycleError) {
    return { code: error.code, message: error.message.slice(0, 2_000) };
  }
  if (error instanceof CapabilityResolutionError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof z.ZodError) {
    return { code: "invalid_generation_configuration", message: z.prettifyError(error).slice(0, 2_000) };
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("provider_output_host_not_allowed:")) {
    return { code: "provider_output_host_not_allowed", message: message.slice(0, 2_000) };
  }
  if (message.startsWith("provider_output_")) {
    return { code: "provider_output_unavailable", message: message.slice(0, 2_000) };
  }
  return { code: "provider_operation_failed", message: message.slice(0, 2_000) };
}

function isPermanentPreAcceptanceError(error: unknown): boolean {
  if (error instanceof CapabilityResolutionError || error instanceof z.ZodError) return true;
  if (error instanceof RenderLifecycleError) return !error.retryable;
  if (error instanceof Error && error.message === "provider_adapter_unavailable") return true;
  return Boolean(
    typeof error === "object" && error !== null && "retryable" in error && error.retryable === false,
  );
}

function sourceUrl(value: string | undefined): string {
  if (!value) throw new RenderLifecycleError("provider_output_missing", false);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new RenderLifecycleError("provider_output_invalid", false);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new RenderLifecycleError("provider_output_invalid", false);
  }
  return parsed.toString();
}

function configurationInput(configuration: JsonObject): unknown {
  const nested = configuration.generation;
  return typeof nested === "object" && nested !== null && !Array.isArray(nested) ? nested : configuration;
}

export type GenerationLifecycleHandlerOptions = {
  store: RenderLifecycleStore;
  billing: Pick<
    GenerationService,
    "recordProviderSubmission" | "finalizeProviderAccepted" | "releaseRenderReservation" | "refundRender"
  >;
  capabilityRegistry: CapabilityRegistry;
  adapterRegistry: ProviderAdapterRegistry;
  outputPersister?: RenderOutputPersister;
  outputQualityReviewer?: RenderOutputQualityReviewer;
  scheduleReconciliation: ScheduleRenderReconciliation;
  reconciliationDelaySeconds?: number;
  now?: () => Date;
};

export function createGenerationLifecycleHandler(options: GenerationLifecycleHandlerOptions): GenerationJobHandler {
  const reconciliationDelaySeconds = options.reconciliationDelaySeconds ?? 15;
  if (!Number.isSafeInteger(reconciliationDelaySeconds) || reconciliationDelaySeconds < 1) {
    throw new Error("reconciliation_delay_must_be_positive");
  }
  const now = options.now ?? (() => new Date());

  async function schedule(payload: GenerationJobPayload): Promise<void> {
    await options.scheduleReconciliation(payload, reconciliationDelaySeconds);
  }

  function resolveAdapter(snapshot: RenderLifecycleSnapshot): ProviderAdapter {
    const capability = options.capabilityRegistry.resolve(snapshot.capabilityAlias);
    return options.adapterRegistry.get(capability.adapterId, capability.alias);
  }

  async function terminateBeforeAcceptance(
    snapshot: RenderLifecycleSnapshot,
    error: unknown,
    cancelled = false,
  ): Promise<GenerationJobResult> {
    const failure = cleanError(error);
    await options.billing.releaseRenderReservation({
      userId: snapshot.userId,
      runId: snapshot.id,
      reason: failure.code,
      terminalStatus: cancelled ? "cancelled" : "failed",
      now: now(),
    });
    await options.store.markTerminal({
      runId: snapshot.id,
      userId: snapshot.userId,
      status: cancelled ? "cancelled" : "failed",
      errorCode: failure.code,
      errorMessage: failure.message,
      attemptNumber: snapshot.qualityAttempt,
      now: now(),
    });
    return { renderRunId: snapshot.id, outcome: "reconciled" };
  }

  async function terminateAfterAcceptance(
    snapshot: RenderLifecycleSnapshot,
    error: unknown,
    cancelled = false,
  ): Promise<GenerationJobResult> {
    const failure = cleanError(error);
    await options.store.markTerminal({
      runId: snapshot.id,
      userId: snapshot.userId,
      status: cancelled ? "cancelled" : "failed",
      errorCode: failure.code,
      errorMessage: failure.message,
      attemptNumber: snapshot.qualityAttempt,
      now: now(),
    });
    if (snapshot.chargedAt) await options.billing.refundRender({
      userId: snapshot.userId,
      runId: snapshot.id,
      reason: failure.code,
      now: now(),
    });
    return { renderRunId: snapshot.id, outcome: "reconciled" };
  }

  async function persistCompleted(
    snapshot: RenderLifecycleSnapshot,
    operation: ProviderOperation,
    context: WorkerJobContext,
  ): Promise<GenerationJobResult> {
    if (!options.outputPersister) {
      return terminateAfterAcceptance(
        snapshot,
        new RenderLifecycleError("output_persister_unavailable", false),
      );
    }
    await options.store.updateProcessingStage({
      runId: snapshot.id,
      userId: snapshot.userId,
      stage: "securing_output",
      now: now(),
    });
    context.logger.info("render_output_processing_started", { renderRunId: snapshot.id, jobId: context.jobId });
    const persisted = await options.outputPersister.persist({
      runId: snapshot.id,
      userId: snapshot.userId,
      projectId: snapshot.projectId,
      projectVersionId: snapshot.projectVersionId,
      attemptNumber: snapshot.qualityAttempt,
      sourceUrl: sourceUrl(operation.outputUrl),
      configuration: snapshot.configuration,
    });
    if (!persisted.bucket.trim() || !persisted.objectKey.trim()) {
      throw new RenderLifecycleError("persisted_output_invalid", false);
    }
    if (!options.outputQualityReviewer) {
      return terminateAfterAcceptance(
        snapshot,
        new RenderLifecycleError("output_quality_reviewer_unavailable", false),
      );
    }
    await options.store.updateProcessingStage({
      runId: snapshot.id,
      userId: snapshot.userId,
      stage: "quality_review",
      now: now(),
    });
    context.logger.info("render_quality_review_started", { renderRunId: snapshot.id, jobId: context.jobId });
    const quality = await options.outputQualityReviewer.review({
      runId: snapshot.id,
      userId: snapshot.userId,
      projectId: snapshot.projectId,
      projectVersionId: snapshot.projectVersionId,
      bucket: persisted.bucket,
      objectKey: persisted.objectKey,
      attemptNumber: snapshot.qualityAttempt,
      configuration: snapshot.configuration,
    });
    context.logger.info("render_quality_review_finished", { renderRunId: snapshot.id, jobId: context.jobId, status: quality.status, score: quality.score });
    if (quality.status === "retry") {
      let maxRetries = Number.isSafeInteger(snapshot.maxQualityRetries)
        ? Math.max(0, Math.min(snapshot.maxQualityRetries, MAX_INTERNAL_QUALITY_RETRIES))
        : 0;
      const configuration = GenerationConfigurationSchema.parse(configurationInput(snapshot.configuration));
      if (configuration.creativeBrief !== undefined) {
        maxRetries = Math.max(
          0,
          Math.min(
            CreativeBriefSchema.parse(configuration.creativeBrief).qualityPolicy.internalRetryLimit,
            MAX_INTERNAL_QUALITY_RETRIES,
          ),
        );
      }
      await options.store.prepareQualityRetry({
        runId: snapshot.id,
        userId: snapshot.userId,
        attemptNumber: snapshot.qualityAttempt,
        maxRetries,
        outputBucket: persisted.bucket,
        outputObjectKey: persisted.objectKey,
        decision: quality,
        now: now(),
      });
      return { renderRunId: snapshot.id, outcome: "reconciled" };
    }
    if (quality.status !== "accepted") {
      return terminateAfterAcceptance(
        snapshot,
        new RenderLifecycleError(
          `quality_gate_${quality.status}`,
          false,
          `${quality.score}:${quality.failedDimensions.join(",")}`,
        ),
      );
    }
    await options.store.complete({
      runId: snapshot.id,
      userId: snapshot.userId,
      outputBucket: persisted.bucket,
      outputObjectKey: persisted.objectKey,
      attemptNumber: snapshot.qualityAttempt,
      now: now(),
    });
    context.logger.info("render_video_ready", { renderRunId: snapshot.id, projectId: snapshot.projectId, jobId: context.jobId });
    return { renderRunId: snapshot.id, outcome: "reconciled" };
  }

  async function applyProviderOperation(
    payload: GenerationJobPayload,
    snapshot: RenderLifecycleSnapshot,
    operation: ProviderOperation,
    context: WorkerJobContext,
  ): Promise<GenerationJobResult> {
    if (operation.providerRequestId !== snapshot.providerRequestId) {
      return terminateAfterAcceptance(
        snapshot,
        new RenderLifecycleError("provider_request_mismatch", false),
      );
    }
    if (operation.telemetry) {
      await options.store.recordProviderTelemetry({
        runId: snapshot.id,
        userId: snapshot.userId,
        attemptNumber: snapshot.qualityAttempt,
        ...(operation.telemetry.providerCostMicrousd === undefined
          ? {}
          : { providerCostMicrousd: operation.telemetry.providerCostMicrousd }),
        ...(operation.telemetry.providerLatencyMs === undefined
          ? {}
          : { providerLatencyMs: operation.telemetry.providerLatencyMs }),
        ...(operation.telemetry.usage === undefined
          ? {}
          : { providerUsage: operation.telemetry.usage as JsonObject }),
        now: now(),
      });
    }
    if (operation.status === "completed") return persistCompleted(snapshot, operation, context);
    if (operation.status === "failed") {
      return terminateAfterAcceptance(
        snapshot,
        new RenderLifecycleError(
          operation.errorCode?.trim() || "provider_failed",
          false,
          operation.errorMessage?.trim() || "provider_failed",
        ),
      );
    }
    if (operation.status === "cancelled") {
      return terminateAfterAcceptance(snapshot, new RenderLifecycleError("provider_cancelled", false), true);
    }

    await options.store.updateProviderStatus({
      runId: snapshot.id,
      userId: snapshot.userId,
      status: snapshot.status === "cancelling" ? "cancelling" : operation.status,
      attemptNumber: snapshot.qualityAttempt,
      now: now(),
    });
    await schedule(payload);
    return { renderRunId: snapshot.id, outcome: "reconciled" };
  }

  async function reconcile(
    payload: GenerationJobPayload,
    snapshot: RenderLifecycleSnapshot,
    context: WorkerJobContext,
  ): Promise<GenerationJobResult> {
    let adapter: ProviderAdapter;
    try {
      adapter = resolveAdapter(snapshot);
    } catch (error) {
      return terminateAfterAcceptance(snapshot, error);
    }

    // Once a provider request ID exists, acceptance is durable even if the
    // process died before the economic transition committed. Finalize that
    // idempotent transition before polling, completion, cancellation or any
    // refund path. If the database is temporarily unavailable, keep the run
    // recoverable and schedule another reconciliation instead of terminally
    // failing an accepted but not-yet-charged request.
    if (!snapshot.chargedAt) {
      try {
        await options.billing.recordProviderSubmission({ userId: snapshot.userId, runId: snapshot.id, provider: snapshot.provider!, providerRequestId: snapshot.providerRequestId!, now: now() });
        await options.billing.finalizeProviderAccepted({
          userId: snapshot.userId,
          runId: snapshot.id,
          provider: snapshot.provider!,
          providerRequestId: snapshot.providerRequestId!,
          now: now(),
        });
      } catch {
        try {
          await schedule(payload);
        } catch (error) {
          throw new RenderLifecycleError(
            "reconciliation_schedule_failed",
            true,
            error instanceof Error ? error.message : String(error),
          );
        }
        return { renderRunId: snapshot.id, outcome: "reconciled" };
      }
    }

    try {
      const operation =
        snapshot.status === "cancelling"
          ? await adapter.cancel(snapshot.providerRequestId!)
          : await adapter.getStatus(snapshot.providerRequestId!);
      context.logger.info("render_provider_status", { renderRunId: snapshot.id, requestId: payload.requestId, jobId: context.jobId, status: operation.status });
      return await applyProviderOperation(payload, snapshot, operation, context);
    } catch (error) {
      const lastAttempt = context.retryCount >= context.retryLimit;
      if (isPermanentPreAcceptanceError(error) || lastAttempt) {
        return terminateAfterAcceptance(snapshot, error, context.signal.aborted);
      }
      const failure = cleanError(error);
      await options.store.recordRetryableFailure({
        runId: snapshot.id,
        userId: snapshot.userId,
        errorCode: failure.code,
        errorMessage: failure.message,
        now: now(),
      });
      throw error;
    }
  }

  const handler: GenerationJobHandler = {
    async handle(payload, context) {
      const snapshot = await options.store.load(payload);
      context.logger.info("render_saved_state", { renderRunId: snapshot.id, requestId: payload.requestId, jobId: context.jobId, status: snapshot.status, stage: snapshot.processingStage, providerTracked: Boolean(snapshot.providerRequestId), attemptNumber: snapshot.qualityAttempt });

      if (snapshot.status === "completed") {
        return { renderRunId: snapshot.id, outcome: "reconciled" };
      }
      if (snapshot.status === "failed" || snapshot.status === "cancelled") {
        if (snapshot.chargedAt && snapshot.refundStatus !== "refunded") {
          await options.billing.refundRender({
            userId: snapshot.userId,
            runId: snapshot.id,
            reason: snapshot.status === "cancelled" ? "provider_cancelled" : "provider_failed",
            now: now(),
          });
        } else if (!snapshot.chargedAt) {
          await options.billing.releaseRenderReservation({
            userId: snapshot.userId,
            runId: snapshot.id,
            reason: snapshot.status === "cancelled" ? "provider_cancelled" : "provider_failed",
            terminalStatus: snapshot.status,
            now: now(),
          });
        }
        return { renderRunId: snapshot.id, outcome: "reconciled" };
      }

      if (snapshot.providerRequestId) return reconcile(payload, snapshot, context);
      if (snapshot.status === "cancelling" || context.signal.aborted) {
        return terminateBeforeAcceptance(
          snapshot,
          new RenderLifecycleError("provider_cancelled", false),
          true,
        );
      }
      if (snapshot.status !== "submitting") {
        throw new RenderLifecycleError("render_missing_provider_request", false);
      }

      let adapter: ProviderAdapter;
      let request: ProviderGenerationRequest;
      try {
        adapter = resolveAdapter(snapshot);
        const configuration = GenerationConfigurationSchema.parse(configurationInput(snapshot.configuration));
        let providerPrompt = configuration.prompt;
        let generateAudio = configuration.audio;
        if (configuration.creativeBrief !== undefined) {
          const creativeBrief = CreativeBriefSchema.parse(configuration.creativeBrief);
          const preflight = preflightCreativeBrief(creativeBrief);
          if (!preflight.passed) {
            throw new RenderLifecycleError(
              "creative_brief_preflight_failed",
              false,
              preflight.failures.join(","),
            );
          }
          const compiled = compileCreativeDirection({
            rawPrompt: configuration.prompt,
            creativeBrief,
            audioEnabled: configuration.audio,
            ...(configuration.aspectRatio === undefined ? {} : { aspectRatio: configuration.aspectRatio }),
          });
          if (compiled.dialectScore < 90) {
            throw new RenderLifecycleError(
              "kuwaiti_dialect_quality_failed",
              false,
              compiled.dialectWarnings.join(",") || "Kuwaiti dialect score is below the submission threshold.",
            );
          }
          providerPrompt = compiled.prompt;
          // Provider-native audio follows the explicit campaign toggle. The
          // compiled prompt additionally suppresses visible speech when audio
          // is disabled, including on presenter templates.
          generateAudio = configuration.audio;
        }
        if (snapshot.qualityAttempt > 0 && snapshot.qualityRetryDirective) {
          providerPrompt = `${providerPrompt}\n\nPREMIUM QUALITY RETRY ${snapshot.qualityAttempt}\nCorrect the rejected candidate without changing confirmed product or business facts:\n${snapshot.qualityRetryDirective}`;
        }
        const loggedBrief = configuration.creativeBrief === undefined ? null : CreativeBriefSchema.parse(configuration.creativeBrief);
        context.logger.info("render_configuration_validated", { renderRunId: snapshot.id, requestId: payload.requestId, templateId: loggedBrief?.templateId, templateVersion: loggedBrief?.templateRecipeVersion, imageCount: configuration.references.length, resolution: configuration.resolution, format: configuration.aspectRatio, durationSeconds: configuration.durationSeconds });
        request = {
          operationId: snapshot.id,
          userId: snapshot.userId,
          projectId: snapshot.projectId,
          capability: payload.capability,
          prompt: providerPrompt,
          references: configuration.references,
          generateAudio,
          idempotencyKey: `provider.submit:${snapshot.id}:${snapshot.qualityAttempt}`,
          ...(configuration.durationSeconds === undefined
            ? {}
            : { durationSeconds: configuration.durationSeconds }),
          ...(configuration.aspectRatio === undefined ? {} : { aspectRatio: configuration.aspectRatio }),
          resolution: configuration.resolution,
        };
      } catch (error) {
        return terminateBeforeAcceptance(snapshot, error);
      }

      try {
        const shouldSubmit = await options.store.beginProviderSubmission({
          runId: snapshot.id,
          userId: snapshot.userId,
          provider: adapter.id,
          attemptNumber: snapshot.qualityAttempt,
          now: now(),
        });
        if (!shouldSubmit) {
          const latest = await options.store.load(payload);
          if (!latest.providerRequestId) {
            throw new RenderLifecycleError("provider_submission_unavailable", true);
          }
          return reconcile(payload, latest, context);
        }
        context.logger.info("render_provider_submit_started", { renderRunId: snapshot.id, requestId: payload.requestId, jobId: context.jobId, attemptNumber: snapshot.qualityAttempt });
        const submission = await adapter.submit(request);
        context.logger.info("render_provider_submit_returned", { renderRunId: snapshot.id, requestId: payload.requestId, status: submission.status });
        // Persist the provider identity before any economic transition. If the
        // process dies after submit, the next MongoDB worker retry reconciles this
        // exact provider request instead of submitting a second render.
        await options.billing.recordProviderSubmission({
          userId: snapshot.userId,
          runId: snapshot.id,
          provider: adapter.id,
          providerRequestId: submission.providerRequestId,
          now: now(),
        });
        try {
          await options.billing.finalizeProviderAccepted({
            userId: snapshot.userId,
            runId: snapshot.id,
            provider: adapter.id,
            providerRequestId: submission.providerRequestId,
            now: now(),
          });
        } catch (error) {
          // The accepted request is already durable. Never release its hold as
          // a pre-acceptance failure; retry will reconcile/charge it by ID.
          throw new RenderLifecycleError(
            "provider_acceptance_not_finalized",
            true,
            error instanceof Error ? error.message : String(error),
          );
        }
      } catch (error) {
        const latest = await options.store.load(payload);
        if (latest.providerRequestId) throw error;
        const lastAttempt = context.retryCount >= context.retryLimit;
        if (isPermanentPreAcceptanceError(error) || lastAttempt || context.signal.aborted) {
          context.logger.error("render_stage_failed", { renderRunId: snapshot.id, requestId: payload.requestId, jobId: context.jobId, errorCode: cleanError(error).code, retrying: false });
          return terminateBeforeAcceptance(snapshot, error, context.signal.aborted);
        }
        throw error;
      }

      // Acceptance and charge are durable at this point. A queue outage must
      // be retried; it must never enter the pre-acceptance release path.
      try {
        await schedule(payload);
      } catch (error) {
        throw new RenderLifecycleError(
          "reconciliation_schedule_failed",
          true,
          error instanceof Error ? error.message : String(error),
        );
      }
      context.logger.info("render_provider_accepted", {
        renderRunId: snapshot.id,
        provider: adapter.id,
      });
      return { renderRunId: snapshot.id, outcome: "accepted" };
    },
  };
  return {
    async handle(payload, context) {
      const fields = { renderRunId: payload.renderRunId, projectId: payload.projectId, jobId: context.jobId, workerId: context.workerId, requestId: payload.requestId, retryCount: context.retryCount };
      context.logger.info("render_job_started", fields);
      try {
        const result = await handler.handle(payload, context);
        context.logger.info("render_job_finished", { ...fields, outcome: result.outcome });
        return result;
      } catch (error) {
        const failure = cleanError(error);
        const lastAttempt = context.retryCount >= context.retryLimit;
        context.logger.error("render_stage_failed", { ...fields, errorCode: failure.code, retrying: !lastAttempt });
        const latest = await options.store.load(payload);
        if (["completed", "cancelled", "failed"].includes(latest.status)) throw error;
        await options.store.recordRetryableFailure({ runId: latest.id, userId: latest.userId, errorCode: failure.code, errorMessage: failure.message, now: now() });
        if (lastAttempt) {
          if (latest.providerRequestId) return terminateAfterAcceptance(latest, error);
          await options.store.markTerminal({ runId: latest.id, userId: latest.userId, status: "failed", errorCode: failure.code, errorMessage: failure.message, attemptNumber: latest.qualityAttempt, now: now() });
          return terminateBeforeAcceptance(latest, error);
        }
        throw error;
      }
    },
  };
}
