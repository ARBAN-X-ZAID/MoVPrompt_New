import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import {
  PROVIDER_BENCHMARK_CORPUS,
  ProviderBenchmarkObservationSchema,
  runProviderBenchmark,
  type BenchmarkBrief,
  type ProviderBenchmarkObservation,
} from "@movprompt/creative-engine";
import { createBytePlusSeedanceAdapter } from "@movprompt/providers";
import { r2StorageConfigFromEnv, R2Storage } from "@movprompt/storage";
import { z } from "zod";

import {
  benchmarkManifestByBrief,
  parseBenchmarkManifest,
  verifyBenchmarkManifestAssets,
} from "./benchmark-manifest.js";
import { createLiveBenchmarkExecutor, type LiveBenchmarkTaskCheckpoint } from "./live-benchmark.js";
import { createFfprobeTechnicalAnalyzer, createGatewayVideoQualityAnalyzer } from "./media-quality-analyzers.js";
import { createProviderOutputPersister } from "./output-persister.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_required`);
  return value;
}

function positiveNumber(name: string, fallback?: number): number {
  const raw = process.env[name]?.trim();
  if (!raw && fallback !== undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name}_must_be_positive`);
  return value;
}

function integer(name: string, fallback: number, maximum: number): number {
  const value = positiveNumber(name, fallback);
  if (!Number.isSafeInteger(value) || value > maximum) throw new Error(`${name}_invalid`);
  return value;
}

async function existingCheckpoint(path: string): Promise<ProviderBenchmarkObservation[]> {
  let contents: string;
  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
  return contents.split(/\r?\n/u).filter(Boolean).map((line) =>
    ProviderBenchmarkObservationSchema.parse(JSON.parse(line)),
  );
}

const TaskCheckpointSchema = z.object({
  providerKey: z.string().min(1),
  runId: z.string().min(1),
  briefId: z.string().min(1),
  providerRequestId: z.string().min(1),
  acceptedAt: z.iso.datetime(),
}).strict();

async function existingTaskCheckpoint(input: {
  path: string;
  providerKey: string;
  runId: string;
}): Promise<Map<string, LiveBenchmarkTaskCheckpoint>> {
  let contents: string;
  try {
    contents = await readFile(input.path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return new Map();
    throw error;
  }
  const result = new Map<string, LiveBenchmarkTaskCheckpoint>();
  for (const line of contents.split(/\r?\n/u).filter(Boolean)) {
    const checkpoint = TaskCheckpointSchema.parse(JSON.parse(line));
    if (checkpoint.providerKey !== input.providerKey || checkpoint.runId !== input.runId) {
      throw new Error("benchmark_task_checkpoint_identity_mismatch");
    }
    if (result.has(checkpoint.briefId)) throw new Error("benchmark_task_checkpoint_duplicate");
    result.set(checkpoint.briefId, {
      briefId: checkpoint.briefId,
      providerRequestId: checkpoint.providerRequestId,
      acceptedAt: checkpoint.acceptedAt,
    });
  }
  return result;
}

function selectedBriefs(): BenchmarkBrief[] {
  const requested = (process.env.MOVPROMPT_BENCHMARK_BRIEF_IDS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!requested.length) return [...PROVIDER_BENCHMARK_CORPUS];
  const requestedSet = new Set(requested);
  const briefs = PROVIDER_BENCHMARK_CORPUS.filter((brief) => requestedSet.has(brief.id));
  const missing = requested.filter((id) => !briefs.some((brief) => brief.id === id));
  if (missing.length) throw new Error(`MOVPROMPT_BENCHMARK_BRIEF_IDS_unknown:${missing.join(",")}`);
  return briefs;
}

if (process.env.MOVPROMPT_BENCHMARK_CONFIRM_PAID_RUN !== "YES") {
  throw new Error("Set MOVPROMPT_BENCHMARK_CONFIRM_PAID_RUN=YES to acknowledge real provider charges.");
}

const runId = required("MOVPROMPT_BENCHMARK_RUN_ID");
const manifestPath = resolve(required("MOVPROMPT_BENCHMARK_MANIFEST_PATH"));
const reportPath = resolve(required("MOVPROMPT_BENCHMARK_REPORT_PATH"));
const checkpointPath = `${reportPath}.jsonl`;
const taskCheckpointPath = `${reportPath}.tasks.jsonl`;
const capability = required("MOVPROMPT_BENCHMARK_CAPABILITY");
if (capability !== "video.cinematic" && capability !== "video.product_fidelity") {
  throw new Error("MOVPROMPT_BENCHMARK_CAPABILITY_must_be_video_capability");
}
const capabilityPrefix = capability === "video.cinematic"
  ? "MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC"
  : "MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY";
const adapterId = required(`${capabilityPrefix}_ADAPTER_ID`);
if (adapterId !== "byteplus-modelark") throw new Error("benchmark_adapter_must_be_byteplus_modelark");
const modelId = required(`${capabilityPrefix}_MODEL_ID`);
const bytePlusApiKey = required("BYTEPLUS_ARK_API_KEY");
const outputHosts = required("PROVIDER_OUTPUT_ALLOWED_HOSTS").split(",").map((host) => host.trim()).filter(Boolean);
const storage = new R2Storage(r2StorageConfigFromEnv(process.env));
const manifest = parseBenchmarkManifest(JSON.parse(await readFile(manifestPath, "utf8")));
await verifyBenchmarkManifestAssets(manifest, storage);

const outputPersister = createProviderOutputPersister({
  storage,
  allowedHosts: outputHosts,
});
const analyzers = [
  createFfprobeTechnicalAnalyzer({ storage }),
  createGatewayVideoQualityAnalyzer({
    storage,
    apiKey: required("AI_GATEWAY_API_KEY"),
    modelId: required("MOVPROMPT_QUALITY_MODEL_ID"),
    gatewayBaseUrl: required("VERCEL_AI_GATEWAY_BASE_URL"),
  }),
];
const adapter = createBytePlusSeedanceAdapter({
  capability,
  apiKey: bytePlusApiKey,
  modelId,
  baseUrl: required("BYTEPLUS_ARK_BASE_URL"),
  resolution: process.env.BYTEPLUS_SEEDANCE_RESOLUTION === "720p" ? "720p" : "1080p",
  generateAudio: false,
  resolveReferenceUrl: async (reference) => ({
    url: (await storage.signDownload({
      bucket: storage.assetsBucket,
      key: reference.objectKey,
      expiresInSeconds: 3_600,
    })).url,
    mediaType: reference.mimeType,
  }),
});
const providerKey = `${adapter.id}:${capability}:${modelId}`;
const briefs = selectedBriefs();
const taskCheckpoints = await existingTaskCheckpoint({ path: taskCheckpointPath, providerKey, runId });
let taskCheckpointWrite = Promise.resolve();
const execute = createLiveBenchmarkExecutor({
  runId,
  adapter,
  manifestByBrief: benchmarkManifestByBrief(manifest),
  outputPersister,
  analyzers,
  costUsdPerSecond: positiveNumber("MOVPROMPT_BENCHMARK_COST_USD_PER_SECOND"),
  pollIntervalMs: integer("MOVPROMPT_BENCHMARK_POLL_INTERVAL_MS", 5_000, 60_000),
  sampleTimeoutMs: integer("MOVPROMPT_BENCHMARK_SAMPLE_TIMEOUT_MS", 20 * 60_000, 60 * 60_000),
  taskCheckpointByBrief: taskCheckpoints,
  onTaskAccepted(checkpoint) {
    taskCheckpointWrite = taskCheckpointWrite.then(() => appendFile(taskCheckpointPath, `${JSON.stringify({
      providerKey,
      runId,
      ...checkpoint,
    })}\n`, "utf8"));
    return taskCheckpointWrite;
  },
});
const selectedIds = new Set(briefs.map((brief) => brief.id));
const checkpoint = (await existingCheckpoint(checkpointPath)).filter((item) => selectedIds.has(item.briefId));
await mkdir(dirname(reportPath), { recursive: true });
let checkpointWrite = Promise.resolve();
const run = await runProviderBenchmark({
  providerKey,
  briefs,
  existingObservations: checkpoint,
  concurrency: integer("MOVPROMPT_BENCHMARK_CONCURRENCY", 1, 4),
  execute,
  onObservation(observation) {
    checkpointWrite = checkpointWrite.then(() => appendFile(checkpointPath, `${JSON.stringify(observation)}\n`, "utf8"));
    return checkpointWrite;
  },
});
await checkpointWrite;
await taskCheckpointWrite;
const report = {
  reportVersion: "movprompt-provider-benchmark-v1",
  automatedProviderApproval: run.score.approved,
  humanBlindReviewRequired: true,
  note: "Automated approval does not authorize a public better-than-competitor claim; retain five-person blind Kuwait review evidence.",
  run,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({
  reportPath,
  checkpointPath,
  taskCheckpointPath,
  samples: run.score.sampleSize,
  technicalSuccessRate: run.score.technicalSuccessRate,
  usableOutputRate: run.score.usableOutputRate,
  qualityScore: run.score.qualityScore,
  approved: run.score.approved,
})}\n`);
if (!run.score.approved) process.exitCode = 2;
