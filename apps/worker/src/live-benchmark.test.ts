import {
  PROVIDER_BENCHMARK_CORPUS,
  compileBenchmarkDirection,
  type QualityDimension,
} from "@movprompt/creative-engine";
import type { ProviderAdapter } from "@movprompt/providers";
import { describe, expect, it, vi } from "vitest";

import type { BenchmarkManifestItem } from "./benchmark-manifest.js";
import { createLiveBenchmarkExecutor } from "./live-benchmark.js";
import type { OutputQualityAnalyzer } from "./output-quality-reviewer.js";

const brief = PROVIDER_BENCHMARK_CORPUS.find((item) => item.language === "ar")!;
const compiled = compileBenchmarkDirection(brief);
const manifestItem: BenchmarkManifestItem = {
  briefId: brief.id,
  factsChecksumSha256: "a".repeat(64),
  rightsAttested: true,
  references: [{
    objectKey: "benchmarks/kw-48-v1/retail-identity/primary.jpg",
    mimeType: "image/jpeg",
    checksumSha256: "b".repeat(64),
  }],
};

function acceptedAnalyzers(): OutputQualityAnalyzer[] {
  const visualDimensions: QualityDimension[] = [
    "product_identity",
    "prompt_adherence",
    "motion_realism",
    "visual_artifacts",
    "brand_safety",
    "dialect_fidelity",
    "speech_sync",
    "safe_zones",
    "compliance",
  ];
  return [
    {
      id: "technical",
      dimensions: ["technical"],
      analyze: async () => [{ dimension: "technical", score: 100 }],
    },
    {
      id: "visual",
      dimensions: visualDimensions,
      analyze: async () => visualDimensions.map((dimension) => ({ dimension, score: 96 })),
    },
  ];
}

describe("live provider benchmark executor", () => {
  it("runs a paid sample through provider, owned storage and all quality dimensions", async () => {
    const adapter: ProviderAdapter = {
      id: "byteplus-modelark",
      capability: "video.product_fidelity",
      submit: vi.fn(async () => ({ providerRequestId: "task-1", status: "queued", acceptedAt: new Date().toISOString() })),
      getStatus: vi.fn(async () => ({ providerRequestId: "task-1", status: "completed", outputUrl: "https://provider.test/output.mp4" })),
      cancel: vi.fn(async () => ({ providerRequestId: "task-1", status: "cancelled" })),
    };
    const persist = vi.fn(async () => ({ bucket: "creator-outputs", objectKey: "benchmark/output.mp4" }));
    const onTaskAccepted = vi.fn();
    const execute = createLiveBenchmarkExecutor({
      runId: "bakeoff-2026-08-13",
      adapter,
      manifestByBrief: new Map([[brief.id, manifestItem]]),
      outputPersister: { persist },
      analyzers: acceptedAnalyzers(),
      costUsdPerSecond: 0.1,
      pollIntervalMs: 1,
      sleep: async () => undefined,
      onTaskAccepted,
    });
    const result = await execute({ brief, ...compiled });
    expect(result).toMatchObject({
      technicalSuccess: true,
      usable: true,
      productIdentity: 96,
      arabicDialect: 96,
      providerRequestId: "task-1",
      artifactObjectKey: "benchmark/output.mp4",
    });
    expect(result.costUsd).toBeGreaterThan(0);
    expect(onTaskAccepted).toHaveBeenCalledWith(expect.objectContaining({
      briefId: brief.id,
      providerRequestId: "task-1",
    }));
    expect(adapter.submit).toHaveBeenCalledWith(expect.objectContaining({ generateAudio: expect.any(Boolean) }));
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({
      sourceUrl: "https://provider.test/output.mp4",
      configuration: expect.objectContaining({ creativeBrief: expect.objectContaining({ arabicDialect: "kuwaiti" }) }),
    }));
  });

  it("resumes an accepted provider task without submitting a duplicate paid request", async () => {
    const submit = vi.fn(async () => {
      throw new Error("must_not_submit");
    });
    const adapter: ProviderAdapter = {
      id: "byteplus-modelark",
      capability: "video.product_fidelity",
      submit,
      getStatus: async () => ({
        providerRequestId: "task-existing",
        status: "completed",
        outputUrl: "https://provider.test/output.mp4",
      }),
      cancel: async () => ({ providerRequestId: "task-existing", status: "cancelled" }),
    };
    const execute = createLiveBenchmarkExecutor({
      runId: "bakeoff-resume",
      adapter,
      manifestByBrief: new Map([[brief.id, manifestItem]]),
      outputPersister: { persist: async () => ({ bucket: "creator-outputs", objectKey: "benchmark/resumed.mp4" }) },
      analyzers: acceptedAnalyzers(),
      costUsdPerSecond: 0.1,
      taskCheckpointByBrief: new Map([[brief.id, {
        briefId: brief.id,
        providerRequestId: "task-existing",
        acceptedAt: "2026-08-13T00:00:00.000Z",
      }]]),
      pollIntervalMs: 1,
      sleep: async () => undefined,
    });
    const result = await execute({ brief, ...compiled });
    expect(result.usable).toBe(true);
    expect(result.providerRequestId).toBe("task-existing");
    expect(submit).not.toHaveBeenCalled();
  });

  it("cancels a timed-out provider task and preserves its estimated paid cost", async () => {
    const cancel = vi.fn(async () => ({ providerRequestId: "task-timeout", status: "cancelled" as const }));
    const adapter: ProviderAdapter = {
      id: "byteplus-modelark",
      capability: "video.product_fidelity",
      submit: async () => ({ providerRequestId: "task-timeout", status: "queued", acceptedAt: new Date().toISOString() }),
      getStatus: async () => ({ providerRequestId: "task-timeout", status: "processing" }),
      cancel,
    };
    let clock = 0;
    const execute = createLiveBenchmarkExecutor({
      runId: "bakeoff-timeout",
      adapter,
      manifestByBrief: new Map([[brief.id, manifestItem]]),
      outputPersister: { persist: vi.fn() },
      analyzers: acceptedAnalyzers(),
      costUsdPerSecond: 0.1,
      pollIntervalMs: 1,
      sampleTimeoutMs: 1_000,
      now: () => {
        clock += 1_000;
        return clock;
      },
      sleep: async () => undefined,
    });
    const result = await execute({ brief, ...compiled });
    expect(result).toMatchObject({
      technicalSuccess: false,
      usable: false,
      errorCode: "benchmark_provider_timeout",
      providerRequestId: "task-timeout",
    });
    expect(result.costUsd).toBeGreaterThan(0);
    expect(cancel).toHaveBeenCalledWith("task-timeout");
  });
});
