import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { basename, extname, resolve } from "node:path";

import { experimental_generateVideo as generateVideo } from "ai";
import { z } from "zod";

import {
  assertMp4,
  imageDimensions,
  resolveSeedanceSmokeConfiguration,
  SEEDANCE_25_MODEL_ID,
  SEEDANCE_DEV_FAST_MODEL_ID,
  SeedanceModelSchema,
  validateSeedanceSourceImage,
} from "./gateway-video-smoke.js";

const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url));

for (const name of [".env", ".env.local"]) {
  try {
    loadEnvFile(resolve(workspaceRoot, name));
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code !== "ENOENT") throw error;
  }
}

function requiredKey(): string {
  const key = process.env.AI_GATEWAY_API_KEY?.trim();
  if (!key) throw new Error("AI_GATEWAY_API_KEY is missing from the ignored local environment.");
  return key;
}

const ModelListSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    name: z.string().optional(),
    type: z.string(),
    video_capabilities: z.object({
      supported_operations: z.array(z.string()).optional(),
      supported_resolutions: z.array(z.string()).optional(),
      supported_aspect_ratios: z.array(z.string()).optional(),
      supported_durations_seconds: z.array(z.number()).optional(),
      generate_audio: z.boolean().optional(),
    }).passthrough().optional(),
  }).passthrough()),
}).passthrough();

const CreditsSchema = z.object({
  balance: z.string(),
  total_used: z.string(),
}).passthrough();

async function modelList() {
  const response = await fetch("https://ai-gateway.vercel.sh/v1/models", {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`gateway_model_list_http_${response.status}`);
  return ModelListSchema.parse(await response.json()).data;
}

async function gatewayCredits() {
  const response = await fetch("https://ai-gateway.vercel.sh/v1/credits", {
    headers: { authorization: `Bearer ${requiredKey()}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`gateway_credits_http_${response.status}`);
  return CreditsSchema.parse(await response.json());
}

async function verifyAuthentication(): Promise<void> {
  const credits = await gatewayCredits();
  process.stdout.write(`${JSON.stringify({
    status: "ok",
    authentication: "AI Gateway key accepted",
    creditBalanceUsd: credits.balance,
    totalUsedUsd: credits.total_used,
  }, null, 2)}\n`);
}

async function printReadiness(): Promise<void> {
  const [credits, models] = await Promise.all([gatewayCredits(), modelList()]);
  const seedance = models.find((model) => model.id === "bytedance/seedance-2.5");
  const omni = models.find((model) => model.id === "google/gemini-omni-flash-preview");
  process.stdout.write(`${JSON.stringify({
    status: seedance && omni ? "ready_for_guarded_smoke_tests" : "blocked",
    gateway: {
      authenticated: true,
      creditBalanceUsd: credits.balance,
      totalUsedUsd: credits.total_used,
    },
    models: {
      seedance25: {
        available: Boolean(seedance),
        id: seedance?.id ?? "bytedance/seedance-2.5",
        type: seedance?.type ?? "missing",
        operations: seedance?.video_capabilities?.supported_operations ?? [],
        resolutions: seedance?.video_capabilities?.supported_resolutions ?? [],
        durations: seedance?.video_capabilities?.supported_durations_seconds ?? [],
        audio: seedance?.video_capabilities?.generate_audio ?? false,
      },
      omniFlash: {
        available: Boolean(omni),
        id: omni?.id ?? "google/gemini-omni-flash-preview",
        type: omni?.type ?? "missing",
        note: "Omni is exposed as a multimodal language model with video output, not as the Gateway video-model contract used by Seedance.",
      },
    },
    paidSmokeTestsRun: false,
  }, null, 2)}\n`);
}

async function printVideoModels(): Promise<void> {
  requiredKey();
  const models = (await modelList())
    .filter((model) => model.type === "video")
    .map((model) => ({
      id: model.id,
      name: model.name ?? model.id,
      operations: model.video_capabilities?.supported_operations ?? [],
      resolutions: model.video_capabilities?.supported_resolutions ?? [],
      durations: model.video_capabilities?.supported_durations_seconds ?? [],
      audio: model.video_capabilities?.generate_audio ?? false,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  process.stdout.write(`${JSON.stringify({ count: models.length, models }, null, 2)}\n`);
}

type OutputDownloadObservation = {
  requestedHost?: string;
  finalHost?: string;
  redirected?: boolean;
  httpStatus?: number;
  contentType?: string;
};

function describeJsonShape(value: unknown, depth = 0): unknown {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return {
      type: "array",
      length: value.length,
      ...(value.length && depth < 2 ? { item: describeJsonShape(value[0], depth + 1) } : {}),
    };
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return depth >= 2
      ? { type: "object", keys: entries.map(([key]) => key) }
      : Object.fromEntries(entries.map(([key, child]) => [key, describeJsonShape(child, depth + 1)]));
  }
  return typeof value;
}

async function downloadObservedVideo(input: {
  url: URL;
  abortSignal?: AbortSignal;
  maxBytes: number;
  observation: OutputDownloadObservation;
  persistRecovery: (status: "observed" | "downloading", url: URL) => Promise<void>;
}): Promise<{ data: Uint8Array; mediaType: string | undefined }> {
  if (input.url.protocol !== "https:" || input.url.username || input.url.password) {
    throw new Error("gateway_video_output_url_invalid");
  }
  input.observation.requestedHost = input.url.hostname.toLowerCase();
  // The signed provider URL exists only inside the AI SDK download callback.
  // Persist it to a private, ignored recovery record before network I/O so a
  // transient DNS/TLS/download failure cannot strand an already-billed output.
  await input.persistRecovery("observed", input.url);
  const response = await fetch(input.url, {
    redirect: "follow",
    ...(input.abortSignal ? { signal: input.abortSignal } : {}),
  });
  const finalUrl = new URL(response.url || input.url.toString());
  if (finalUrl.protocol !== "https:" || finalUrl.username || finalUrl.password) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("gateway_video_output_redirect_invalid");
  }
  input.observation.finalHost = finalUrl.hostname.toLowerCase();
  input.observation.redirected = finalUrl.toString() !== input.url.toString();
  input.observation.httpStatus = response.status;
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType) input.observation.contentType = contentType;
  await input.persistRecovery("downloading", finalUrl);
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`gateway_video_output_http_${response.status}`);
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > input.maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`gateway_video_output_too_large:${declaredLength}`);
  }
  if (!response.body) throw new Error("gateway_video_output_body_missing");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > input.maxBytes) throw new Error(`gateway_video_output_too_large:${totalBytes}`);
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const data = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { data, mediaType: input.observation.contentType };
}

async function generateSmokeVideo(): Promise<void> {
  requiredKey();
  if (process.env.MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO?.trim() !== "YES") {
    throw new Error("Set MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO=YES for one real paid smoke video.");
  }
  const requestedModel = process.env.MOVPROMPT_GATEWAY_VIDEO_MODEL_ID?.trim() || SEEDANCE_25_MODEL_ID;
  if (requestedModel !== SEEDANCE_25_MODEL_ID && requestedModel !== SEEDANCE_DEV_FAST_MODEL_ID) {
    throw new Error(`gateway_video_model_not_approved:${requestedModel}`);
  }
  const modelRecord = (await modelList()).find((item) => item.id === requestedModel);
  if (!modelRecord) throw new Error(`gateway_video_model_unavailable:${requestedModel}`);
  const model = SeedanceModelSchema.parse(modelRecord);
  const configuration = resolveSeedanceSmokeConfiguration({
    workspaceRoot,
    environment: process.env,
    model,
  });
  const sourceImage = await readFile(configuration.sourceImagePath);
  const extension = configuration.sourceImagePath.toLowerCase();
  const sourceMimeType = extension.endsWith(".png") ? "image/png" : "image/jpeg";
  const dimensions = imageDimensions(sourceImage, sourceMimeType);
  const source = validateSeedanceSourceImage({
    model,
    path: configuration.sourceImagePath,
    bytes: sourceImage,
    ...dimensions,
  });
  if (!configuration.sourceImageUrl) {
    throw new Error("gateway_video_image_url_required");
  }
  const outputDirectory = resolve(workspaceRoot, "artifacts", "gateway-smoke");
  await mkdir(outputDirectory, { recursive: true });
  const sourceSlug = basename(configuration.sourceImagePath, extname(configuration.sourceImagePath))
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "") || "source";
  const modelSlug = configuration.modelId.split("/").at(-1)?.replace(/[^a-z0-9]+/giu, "-") || "seedance";
  const artifactId = `${modelSlug}-${sourceSlug}-${Date.now()}`;
  const outputPath = resolve(outputDirectory, `${artifactId}.mp4`);
  const metadataPath = resolve(outputDirectory, `${artifactId}.json`);
  const recoveryPath = resolve(outputDirectory, `${artifactId}.output-recovery.json`);
  const creditsBefore = await gatewayCredits();
  const startedAt = Date.now();
  const outputDownload: OutputDownloadObservation = {};
  const sourceMetadata = {
    path: configuration.sourceImagePath,
    inputMode: "reference_url",
    url: configuration.sourceImageUrl,
    urlHost: new URL(configuration.sourceImageUrl).hostname.toLowerCase(),
    mimeType: source.mimeType,
    width: dimensions.width,
    height: dimensions.height,
    bytes: sourceImage.byteLength,
    checksumSha256: source.checksumSha256,
  };
  const baseMetadata = {
    model: configuration.modelId,
    capability: "video.cinematic",
    operation: "image-to-video",
    durationSeconds: configuration.duration,
    aspectRatio: configuration.aspectRatio,
    aspectRatioControl: "first_frame_source",
    resolutionTier: configuration.resolutionTier,
    resolution: configuration.resolution,
    providerResolution: configuration.providerResolution,
    audioMode: "disabled",
    sourceImage: sourceMetadata,
    outputPath,
    metadataPath,
    recoveryPath,
  };
  await writeFile(metadataPath, `${JSON.stringify({
    status: "submitting",
    ...baseMetadata,
    startedAt: new Date(startedAt).toISOString(),
    gatewayCredits: {
      beforeUsd: creditsBefore.balance,
      totalUsedBeforeUsd: creditsBefore.total_used,
    },
  }, null, 2)}\n`, "utf8");

  const persistRecovery = async (status: "observed" | "downloading", url: URL) => {
    await writeFile(recoveryPath, `${JSON.stringify({
      status,
      artifactId,
      model: configuration.modelId,
      observedAt: new Date().toISOString(),
      outputUrl: url.toString(),
      outputHost: url.hostname.toLowerCase(),
      metadataPath,
      note: "Ephemeral local recovery data. Never commit or copy this signed URL into MongoDB.",
    }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  };

  let result: Awaited<ReturnType<typeof generateVideo>>;
  try {
    result = await generateVideo({
      model: configuration.modelId,
      prompt: {
        image: configuration.sourceImageUrl,
        text: configuration.prompt,
      },
      n: 1,
      duration: configuration.duration,
      // First-frame generation inherits the exact 9:16 source canvas. Passing
      // `aspectRatio` makes ByteDance reject the request even when it matches.
      // AI SDK 7's public type still documents `{width}x{height}`, but the
      // current Gateway Seedance v1 wire contract requires the catalog tier
      // string (`480p`/`720p`). The guarded configuration is catalog-validated
      // before this isolated compatibility cast.
      resolution: configuration.providerResolution as `${number}x${number}`,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(configuration.timeoutMs),
      download: ({ url, abortSignal }) => downloadObservedVideo({
        url,
        ...(abortSignal ? { abortSignal } : {}),
        maxBytes: configuration.maxOutputBytes,
        observation: outputDownload,
        persistRecovery,
      }),
      providerOptions: {
        gateway: {
          user: "movprompt-local-video-smoke",
          tags: ["app:movprompt", "env:local", "purpose:image-to-video-smoke"],
        },
      },
    });
  } catch (error) {
    const creditsAfterFailure = await gatewayCredits().catch(() => undefined);
    const errorObject = error && typeof error === "object" ? error as Record<string, unknown> : {};
    const failureMetadata = {
      status: outputDownload.requestedHost ? "output_download_failed" : "generation_failed",
      ...baseMetadata,
      startedAt: new Date(startedAt).toISOString(),
      failedAt: new Date().toISOString(),
      elapsedSeconds: Number(((Date.now() - startedAt) / 1_000).toFixed(1)),
      ...(typeof errorObject.generationId === "string" ? { generationId: errorObject.generationId } : {}),
      error: {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
      },
      outputDownload,
      gatewayCredits: {
        beforeUsd: creditsBefore.balance,
        totalUsedBeforeUsd: creditsBefore.total_used,
        ...(creditsAfterFailure ? {
          afterUsd: creditsAfterFailure.balance,
          totalUsedAfterUsd: creditsAfterFailure.total_used,
        } : {}),
      },
    };
    await writeFile(metadataPath, `${JSON.stringify(failureMetadata, null, 2)}\n`, "utf8");
    if (error instanceof Error) {
      Object.assign(error, { artifactMetadataPath: metadataPath, outputRecoveryPath: recoveryPath });
    }
    throw error;
  }
  const video = result.videos[0];
  if (!video?.uint8Array.byteLength) throw new Error("gateway_video_output_missing");
  assertMp4(video.uint8Array);
  await writeFile(outputPath, video.uint8Array);
  const creditsAfter = await gatewayCredits();
  const metadata = {
    status: "completed",
    model: configuration.modelId,
    capability: "video.cinematic",
    operation: "image-to-video",
    durationSeconds: configuration.duration,
    aspectRatio: configuration.aspectRatio,
    aspectRatioControl: "first_frame_source",
    resolutionTier: configuration.resolutionTier,
    resolution: configuration.resolution,
    audioMode: "disabled",
    sourceImage: sourceMetadata,
    mediaType: video.mediaType,
    bytes: video.uint8Array.byteLength,
    elapsedSeconds: Number(((Date.now() - startedAt) / 1_000).toFixed(1)),
    outputPath,
    metadataPath,
    warningCount: result.warnings.length,
    warningTypes: result.warnings.map((warning) => warning.type),
    responseModels: result.responses.map((response) => ({
      modelId: response.modelId,
      timestamp: response.timestamp.toISOString(),
      headerNames: Object.keys(response.headers ?? {}).sort(),
      providerMetadataShape: describeJsonShape(response.providerMetadata),
    })),
    providerMetadataShape: describeJsonShape(result.providerMetadata),
    outputDownload,
    gatewayCredits: {
      beforeUsd: creditsBefore.balance,
      afterUsd: creditsAfter.balance,
      totalUsedBeforeUsd: creditsBefore.total_used,
      totalUsedAfterUsd: creditsAfter.total_used,
    },
  };
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  // Once the MP4 is durable, scrub the signed recovery URL while retaining a
  // small audit record that the emergency path is no longer needed.
  await writeFile(recoveryPath, `${JSON.stringify({
    status: "downloaded",
    artifactId,
    model: configuration.modelId,
    completedAt: new Date().toISOString(),
    outputDownload,
    outputPath,
    metadataPath,
  }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  process.stdout.write(`${JSON.stringify(metadata, null, 2)}\n`);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "auth") await verifyAuthentication();
  else if (command === "readiness") await printReadiness();
  else if (command === "models") await printVideoModels();
  else if (command === "video") await generateSmokeVideo();
  else throw new Error("Usage: gateway-local-cli.ts <auth|readiness|models|video>");
}

try {
  await main();
} catch (error) {
  const errorObject = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const cause = errorObject.cause && typeof errorObject.cause === "object"
    ? errorObject.cause as Record<string, unknown>
    : {};
  const data = cause.data && typeof cause.data === "object" ? cause.data as Record<string, unknown> : {};
  const gatewayError = data.error && typeof data.error === "object" ? data.error as Record<string, unknown> : {};
  const statusCode = typeof errorObject.statusCode === "number"
    ? errorObject.statusCode
    : typeof cause.statusCode === "number" ? cause.statusCode : undefined;
  const gatewayType = typeof gatewayError.type === "string" ? gatewayError.type : undefined;
  const artifactMetadataPath = typeof errorObject.artifactMetadataPath === "string"
    ? errorObject.artifactMetadataPath
    : undefined;
  const outputRecoveryPath = typeof errorObject.outputRecoveryPath === "string"
    ? errorObject.outputRecoveryPath
    : undefined;
  if (statusCode === 403 && gatewayType === "customer_verification_required") {
    process.stderr.write(`${JSON.stringify({
      status: "blocked",
      code: "vercel_customer_verification_required",
      message: "Vercel requires a valid card on this team before AI Gateway can service even free-credit requests.",
      action: "Open the Vercel AI Gateway dashboard, add/verify a card, and rerun gateway:auth.",
      charged: false,
    }, null, 2)}\n`);
  } else {
    process.stderr.write(`${JSON.stringify({
      status: "failed",
      code: gatewayType ?? "gateway_local_command_failed",
      message: error instanceof Error ? error.message : String(error),
      ...(statusCode === undefined ? {} : { statusCode }),
      ...(artifactMetadataPath ? { artifactMetadataPath } : {}),
      ...(outputRecoveryPath ? { outputRecoveryPath } : {}),
    }, null, 2)}\n`);
  }
  process.exitCode = 1;
}
