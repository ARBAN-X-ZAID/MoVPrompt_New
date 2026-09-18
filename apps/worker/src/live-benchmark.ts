import { createHash } from "node:crypto";

import {
  evaluateAcceptedOutput,
  getCreativeTemplate,
  templateRequiresSynchronizedSpeech,
  type ProviderBenchmarkExecutionInput,
  type ProviderBenchmarkExecutionResult,
  type QualityObservation,
} from "@movprompt/creative-engine";
import type { JsonObject } from "@movprompt/db";
import type { ProviderAdapter, ProviderOperation, ProviderReference } from "@movprompt/providers";

import type { BenchmarkManifestItem } from "./benchmark-manifest.js";
import type { OutputQualityAnalyzer } from "./output-quality-reviewer.js";
import type { RenderOutputPersister } from "./render-lifecycle.js";

export type LiveBenchmarkExecutorOptions = {
  runId: string;
  adapter: ProviderAdapter;
  manifestByBrief: ReadonlyMap<string, BenchmarkManifestItem>;
  outputPersister: RenderOutputPersister;
  analyzers: readonly OutputQualityAnalyzer[];
  costUsdPerSecond: number;
  pollIntervalMs?: number;
  sampleTimeoutMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  taskCheckpointByBrief?: ReadonlyMap<string, LiveBenchmarkTaskCheckpoint>;
  onTaskAccepted?: (checkpoint: LiveBenchmarkTaskCheckpoint) => Promise<void> | void;
};

export type LiveBenchmarkTaskCheckpoint = {
  briefId: string;
  providerRequestId: string;
  acceptedAt: string;
};

function safeRunId(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/u.test(normalized)) {
    throw new Error("benchmark_run_id_invalid");
  }
  return normalized;
}

function positiveNumber(value: number, label: string, maximum: number): number {
  if (!Number.isFinite(value) || value <= 0 || value > maximum) throw new Error(`${label}_invalid`);
  return value;
}

function providerReferences(item: BenchmarkManifestItem): ProviderReference[] {
  return item.references.map((reference) => ({
    objectKey: reference.objectKey,
    mimeType: reference.mimeType,
  }));
}

function configuration(input: ProviderBenchmarkExecutionInput, references: ProviderReference[]): JsonObject {
  return JSON.parse(JSON.stringify({
    prompt: input.direction.prompt,
    durationSeconds: input.creativeBrief.scenes.reduce((sum, scene) => sum + scene.duration, 0),
    aspectRatio: input.brief.requiredRatio,
    references,
    creativeBrief: input.creativeBrief,
    benchmark: {
      corpusVersion: "kw-48-v1",
      briefId: input.brief.id,
      challenge: input.brief.challenge,
    },
  })) as JsonObject;
}

function zeroResult(input: {
  costUsd: number;
  errorCode: string;
  providerRequestId?: string;
}): ProviderBenchmarkExecutionResult {
  return {
    technicalSuccess: false,
    usable: false,
    productIdentity: 0,
    promptAdherence: 0,
    motionRealism: 0,
    arabicDialect: 0,
    costUsd: input.costUsd,
    errorCode: input.errorCode,
    ...(input.providerRequestId ? { providerRequestId: input.providerRequestId } : {}),
  };
}

function score(observations: readonly QualityObservation[], dimension: QualityObservation["dimension"]): number {
  return observations.find((observation) => observation.dimension === dimension)?.score ?? 0;
}

/**
 * Runs one first-pass sample through the real provider, private output copy,
 * deterministic campaign voice and independent quality analyzers. It does not
 * use the production READY flag: the complete 48-sample report is the evidence
 * required before an operator may set that flag.
 */
export function createLiveBenchmarkExecutor(options: LiveBenchmarkExecutorOptions): (
  input: ProviderBenchmarkExecutionInput,
) => Promise<ProviderBenchmarkExecutionResult> {
  const runId = safeRunId(options.runId);
  const costUsdPerSecond = positiveNumber(options.costUsdPerSecond, "benchmark_cost_usd_per_second", 100);
  const pollIntervalMs = positiveNumber(options.pollIntervalMs ?? 5_000, "benchmark_poll_interval_ms", 60_000);
  const sampleTimeoutMs = positiveNumber(options.sampleTimeoutMs ?? 20 * 60_000, "benchmark_sample_timeout_ms", 60 * 60_000);
  if (!options.analyzers.length) throw new Error("benchmark_quality_analyzers_required");
  const analyzerIds = new Set(options.analyzers.map((analyzer) => analyzer.id));
  if (analyzerIds.size !== options.analyzers.length) throw new Error("benchmark_quality_analyzer_ids_must_be_unique");
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));

  return async (input) => {
    const manifestItem = options.manifestByBrief.get(input.brief.id);
    if (!manifestItem) throw new Error(`benchmark_manifest_item_missing:${input.brief.id}`);
    const template = getCreativeTemplate(input.brief.templateId);
    const durationSeconds = input.creativeBrief.scenes.reduce((sum, scene) => sum + scene.duration, 0);
    const billedCost = Number((durationSeconds * costUsdPerSecond).toFixed(4));
    const references = providerReferences(manifestItem);
    const operationId = `${runId}-${input.brief.id}`;
    const idempotencyKey = createHash("sha256").update(operationId).digest("hex");
    const existingTask = options.taskCheckpointByBrief?.get(input.brief.id);
    const submitted = existingTask
      ? {
          providerRequestId: existingTask.providerRequestId,
          status: "queued" as const,
          acceptedAt: existingTask.acceptedAt,
        }
      : await options.adapter.submit({
          operationId,
          userId: "benchmark",
          projectId: runId,
          capability: options.adapter.capability,
          prompt: input.direction.prompt,
          durationSeconds,
          aspectRatio: input.brief.requiredRatio,
          references,
          generateAudio: templateRequiresSynchronizedSpeech(template.id),
          idempotencyKey,
        });
    if (!existingTask) {
      await options.onTaskAccepted?.({
        briefId: input.brief.id,
        providerRequestId: submitted.providerRequestId,
        acceptedAt: submitted.acceptedAt,
      });
    }
    const deadline = now() + sampleTimeoutMs;
    let operation: ProviderOperation = submitted;
    while (operation.status === "queued" || operation.status === "processing") {
      if (now() >= deadline) {
        await options.adapter.cancel(submitted.providerRequestId).catch(() => undefined);
        return zeroResult({
          costUsd: billedCost,
          errorCode: "benchmark_provider_timeout",
          providerRequestId: submitted.providerRequestId,
        });
      }
      await sleep(pollIntervalMs);
      operation = await options.adapter.getStatus(submitted.providerRequestId);
    }
    if (operation.status !== "completed" || !operation.outputUrl) {
      return zeroResult({
        costUsd: billedCost,
        errorCode: operation.errorCode ?? `benchmark_provider_${operation.status}`,
        providerRequestId: submitted.providerRequestId,
      });
    }

    const generationConfiguration = configuration(input, references);
    const stored = await options.outputPersister.persist({
      runId: operationId,
      userId: "benchmark",
      projectId: runId,
      projectVersionId: input.brief.id,
      attemptNumber: 0,
      sourceUrl: operation.outputUrl,
      configuration: generationConfiguration,
    });
    const candidate = {
      bucket: stored.bucket,
      objectKey: stored.objectKey,
      runId: operationId,
      projectId: runId,
      projectVersionId: input.brief.id,
    };
    const observations = (
      await Promise.all(options.analyzers.map((analyzer) => analyzer.analyze({
        candidate,
        configuration: generationConfiguration,
        attemptNumber: 0,
      })))
    ).flat();
    const dimensions = new Set<string>();
    for (const observation of observations) {
      if (dimensions.has(observation.dimension)) throw new Error(`benchmark_duplicate_quality_dimension:${observation.dimension}`);
      dimensions.add(observation.dimension);
    }
    const decision = evaluateAcceptedOutput({
      observations,
      policy: template.qualityPolicy,
      attempt: 0,
    });
    const technical = observations.find((observation) => observation.dimension === "technical");
    const technicalSuccess = Boolean(technical && !technical.hardFailure && technical.score >= 75);
    return {
      technicalSuccess,
      usable: technicalSuccess && decision.status === "accepted",
      productIdentity: score(observations, "product_identity"),
      promptAdherence: score(observations, "prompt_adherence"),
      motionRealism: score(observations, "motion_realism"),
      arabicDialect: input.brief.language === "en" ? 100 : score(observations, "dialect_fidelity"),
      costUsd: billedCost,
      providerRequestId: submitted.providerRequestId,
      artifactObjectKey: stored.objectKey,
      ...(decision.status === "accepted" ? {} : { errorCode: `benchmark_quality_${decision.status}` }),
    };
  };
}
