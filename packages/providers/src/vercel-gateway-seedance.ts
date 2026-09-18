import { z } from "zod";

import type {
  ProviderAdapter,
  ProviderGenerationRequest,
  ProviderOperation,
  ProviderReference,
  ProviderSubmission,
} from "./adapter.js";

export const VERCEL_GATEWAY_SEEDANCE_ADAPTER_ID = "vercel-ai-gateway" as const;
export const VERCEL_GATEWAY_SEEDANCE_MODEL_ID = "bytedance/seedance-2.5" as const;
/** Development-only cheaper model. It is never selected as a fallback. */
export const VERCEL_GATEWAY_SEEDANCE_FAST_MODEL_ID = "bytedance/seedance-v1.0-pro-fast" as const;
/** Exact output origin observed and reviewed for the current Seedance 2.5 route. */
export const VERCEL_GATEWAY_SEEDANCE_OUTPUT_HOSTS = [
  "ark-acg-ap-southeast-1.tos-ap-southeast-1.volces.com",
] as const;
/** Exact output origin observed for the explicit local fast-model profile. */
export const VERCEL_GATEWAY_SEEDANCE_FAST_OUTPUT_HOSTS = [
  "ark-content-generation-ap-southeast-1.tos-ap-southeast-1.volces.com",
] as const;

export type VercelGatewayApplicationEnvironment = "local" | "staging" | "production";
type VercelGatewaySeedanceModelPolicy = {
  modelId: typeof VERCEL_GATEWAY_SEEDANCE_MODEL_ID | typeof VERCEL_GATEWAY_SEEDANCE_FAST_MODEL_ID;
  outputHosts: readonly string[];
  minimumDurationSeconds: number;
  maximumDurationSeconds: number;
};

const GATEWAY_VIDEO_SPECIFICATION_VERSION = "4";
const GATEWAY_PROTOCOL_VERSION = "0.0.1";
const PROVIDER_REQUEST_PREFIX = "vgw4.";
const MAX_OPERATION_BYTES = 64 * 1024;

const GatewayJsonSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(GatewayJsonSchema),
    z.record(z.string(), GatewayJsonSchema),
  ]),
);

const GatewayWarningSchema = z.object({
  type: z.string(),
}).passthrough();

const GatewayStartResponseSchema = z.object({
  operation: GatewayJsonSchema,
  warnings: z.array(GatewayWarningSchema).nullish(),
}).passthrough();

const GatewayVideoSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("url"),
    url: z.string().url(),
    mediaType: z.string().optional(),
  }).passthrough(),
  z.object({
    type: z.literal("base64"),
    data: z.string(),
    mediaType: z.string().optional(),
  }).passthrough(),
]);

const GatewayStatusResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending") }).passthrough(),
  z.object({
    status: z.literal("completed"),
    videos: z.array(GatewayVideoSchema),
  }).passthrough(),
  z.object({
    status: z.literal("error"),
    error: z.string().trim().min(1),
  }).passthrough(),
  z.object({ status: z.literal("cancelled") }).passthrough(),
]);

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
export type VercelGatewayResolvedReference = {
  url: string;
  /** Authoritative server-verified MIME; never copied from client JSON. */
  mediaType: string;
};
type ReferenceUrlResolver = (
  reference: ProviderReference,
  generation: ProviderGenerationRequest,
) => Promise<VercelGatewayResolvedReference>;

export type VercelGatewayInlineFirstFrame = {
  type: "file";
  data: string;
  mediaType: "image/jpeg";
};

type FirstFrameResolver = (
  reference: ProviderReference,
  generation: ProviderGenerationRequest,
) => Promise<VercelGatewayInlineFirstFrame>;

export type VercelGatewaySeedanceAdapterOptions = {
  capability: "video.cinematic" | "video.product_fidelity";
  apiKey: string;
  modelId: string;
  /** Defaults to production-safe policy when omitted. */
  applicationEnvironment?: string;
  resolveReferenceUrl: ReferenceUrlResolver;
  resolveFirstFrame: FirstFrameResolver;
  baseUrl?: string;
  resolutionTier?: "480p" | "720p";
  generateAudio?: boolean;
  fetcher?: Fetcher;
  requestTimeoutMs?: number;
};

export class VercelGatewayProviderError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    message = code,
  ) {
    super(message);
    this.name = "VercelGatewayProviderError";
  }
}

function cleanBaseUrl(value: string): string {
  const parsed = new URL(value);
  const local = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
    throw new Error("vercel_gateway_base_url_must_use_https");
  }
  return parsed.toString().replace(/\/$/u, "");
}

function applicationEnvironment(value: string | undefined): VercelGatewayApplicationEnvironment {
  return value?.trim() === "local" ? "local" : value?.trim() === "staging" ? "staging" : "production";
}

/** One server-only policy shared by the adapter and capability readiness. */
export function resolveVercelGatewaySeedanceModelPolicy(
  modelId: string,
  environment?: string,
): VercelGatewaySeedanceModelPolicy {
  const selectedModelId = modelId.trim();
  if (selectedModelId === VERCEL_GATEWAY_SEEDANCE_MODEL_ID) {
    return {
      modelId: VERCEL_GATEWAY_SEEDANCE_MODEL_ID,
      outputHosts: VERCEL_GATEWAY_SEEDANCE_OUTPUT_HOSTS,
      minimumDurationSeconds: 4,
      maximumDurationSeconds: 30,
    };
  }
  if (selectedModelId === VERCEL_GATEWAY_SEEDANCE_FAST_MODEL_ID) {
    if (applicationEnvironment(environment) !== "local") {
      throw new Error("vercel_gateway_seedance_fast_model_local_only");
    }
    return {
      modelId: VERCEL_GATEWAY_SEEDANCE_FAST_MODEL_ID,
      outputHosts: VERCEL_GATEWAY_SEEDANCE_FAST_OUTPUT_HOSTS,
      minimumDurationSeconds: 2,
      maximumDurationSeconds: 12,
    };
  }
  throw new Error("vercel_gateway_seedance_25_model_required");
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

async function errorMessage(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  if (!body.trim()) return `HTTP ${response.status}`;
  try {
    const payload = z.object({
      error: z.union([
        z.string(),
        z.object({ message: z.string().optional() }).passthrough(),
      ]).optional(),
      message: z.string().optional(),
    }).passthrough().parse(JSON.parse(body));
    const gatewayMessage = typeof payload.error === "string"
      ? payload.error
      : payload.error?.message;
    return (gatewayMessage ?? payload.message ?? `HTTP ${response.status}`).trim().slice(0, 1_500);
  } catch {
    return body.trim().slice(0, 1_500);
  }
}

function encodeOperation(operation: unknown): string {
  const parsed = GatewayJsonSchema.parse(operation);
  const json = JSON.stringify(parsed);
  if (Buffer.byteLength(json, "utf8") > MAX_OPERATION_BYTES) {
    throw new VercelGatewayProviderError("vercel_gateway_operation_too_large", false);
  }
  return `${PROVIDER_REQUEST_PREFIX}${Buffer.from(json, "utf8").toString("base64url")}`;
}

function decodeOperation(providerRequestId: string): unknown {
  const value = providerRequestId.trim();
  if (!value.startsWith(PROVIDER_REQUEST_PREFIX)) {
    throw new VercelGatewayProviderError("vercel_gateway_operation_invalid", false);
  }
  try {
    const encoded = value.slice(PROVIDER_REQUEST_PREFIX.length);
    if (!encoded || encoded.length > Math.ceil(MAX_OPERATION_BYTES * 4 / 3) + 8) {
      throw new Error("operation_size_invalid");
    }
    const json = Buffer.from(encoded, "base64url").toString("utf8");
    if (!json || Buffer.byteLength(json, "utf8") > MAX_OPERATION_BYTES) {
      throw new Error("operation_size_invalid");
    }
    return GatewayJsonSchema.parse(JSON.parse(json));
  } catch (error) {
    if (error instanceof VercelGatewayProviderError) throw error;
    throw new VercelGatewayProviderError("vercel_gateway_operation_invalid", false);
  }
}

function safeReferenceUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new VercelGatewayProviderError("vercel_gateway_reference_url_invalid", false);
  }
  const host = parsed.hostname.toLowerCase();
  const inaccessibleHost =
    host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
    host === "[::1]" || host === "::1" ||
    /^127\./u.test(host) || /^10\./u.test(host) || /^192\.168\./u.test(host) ||
    /^169\.254\./u.test(host) || /^172\.(1[6-9]|2\d|3[01])\./u.test(host);
  if (parsed.protocol !== "https:" || inaccessibleHost) {
    throw new VercelGatewayProviderError("vercel_gateway_reference_url_invalid", false);
  }
  if (parsed.username || parsed.password) {
    throw new VercelGatewayProviderError("vercel_gateway_reference_url_invalid", false);
  }
  return parsed.toString();
}

type GatewayUrlFile = {
  type: "url";
  url: string;
  mediaType: string;
};

type GatewayFile = GatewayUrlFile | VercelGatewayInlineFirstFrame;

const MAX_INLINE_FIRST_FRAME_BYTES = 8 * 1024 * 1024;

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/tiff",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime"]);
const AUDIO_TYPES = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav"]);

async function referenceFiles(
  references: ProviderReference[],
  resolveReferenceUrl: ReferenceUrlResolver,
  resolveFirstFrame: FirstFrameResolver,
  firstImageAsFrame: boolean,
  generation: ProviderGenerationRequest,
): Promise<{ image?: GatewayFile; inputReferences?: GatewayFile[] }> {
  let imageCount = 0;
  let videoCount = 0;
  let audioCount = 0;
  if (references.length > 50) {
    throw new VercelGatewayProviderError("vercel_gateway_reference_limit", false);
  }

  const firstImageIndex = firstImageAsFrame
    ? references.findIndex((reference) => IMAGE_TYPES.has(reference.mimeType.trim().toLowerCase()))
    : -1;
  const files: GatewayFile[] = [];
  for (const [index, reference] of references.entries()) {
    const mimeType = reference.mimeType.trim().toLowerCase();
    if (IMAGE_TYPES.has(mimeType)) {
      imageCount += 1;
      if (imageCount > 30) throw new VercelGatewayProviderError("vercel_gateway_image_reference_limit", false);
    } else if (VIDEO_TYPES.has(mimeType)) {
      videoCount += 1;
      if (videoCount > 10) throw new VercelGatewayProviderError("vercel_gateway_video_reference_limit", false);
    } else if (AUDIO_TYPES.has(mimeType)) {
      audioCount += 1;
      if (audioCount > 1) throw new VercelGatewayProviderError("vercel_gateway_audio_reference_limit", false);
    } else {
      throw new VercelGatewayProviderError("vercel_gateway_reference_type_unsupported", false);
    }
    if (index === firstImageIndex) {
      const frame = await resolveFirstFrame(reference, generation);
      const data = frame.data.trim();
      if (frame.type !== "file" || frame.mediaType !== "image/jpeg" || !data || data.length % 4 !== 0) {
        throw new VercelGatewayProviderError("vercel_gateway_first_frame_invalid", false);
      }
      const bytes = Buffer.from(data, "base64");
      if (
        !bytes.byteLength ||
        bytes.byteLength > MAX_INLINE_FIRST_FRAME_BYTES ||
        bytes[0] !== 0xff ||
        bytes[1] !== 0xd8
      ) {
        throw new VercelGatewayProviderError("vercel_gateway_first_frame_invalid", false);
      }
      files.push({ type: "file", data, mediaType: "image/jpeg" });
    } else {
      const resolved = await resolveReferenceUrl(reference, generation);
      const authoritativeMime = resolved.mediaType.trim().toLowerCase();
      const sameClass =
        (IMAGE_TYPES.has(mimeType) && IMAGE_TYPES.has(authoritativeMime)) ||
        (VIDEO_TYPES.has(mimeType) && VIDEO_TYPES.has(authoritativeMime)) ||
        (AUDIO_TYPES.has(mimeType) && AUDIO_TYPES.has(authoritativeMime));
      if (!sameClass) {
        throw new VercelGatewayProviderError("vercel_gateway_reference_metadata_mismatch", false);
      }
      const url = safeReferenceUrl(resolved.url);
      files.push({
        type: "url",
        url,
        mediaType: authoritativeMime,
      });
    }
  }

  if (firstImageIndex < 0) {
    return files.length ? { inputReferences: files } : {};
  }
  const image = files[firstImageIndex]!;
  const inputReferences = files.filter((_, index) => index !== firstImageIndex);
  return {
    image,
    ...(inputReferences.length ? { inputReferences } : {}),
  };
}

const DIRECT_RATIO = {
  "9:16": "9:16",
  "1:1": "1:1",
  // Seedance 2.5 has no native 4:5 mode. Generate the closest supported
  // portrait canvas and let the deterministic export pipeline crop to 4:5.
  "4:5": "3:4",
  "16:9": "16:9",
} as const;

function generationBody(
  generation: ProviderGenerationRequest,
  defaultResolutionTier: "480p" | "720p",
  references: { image?: GatewayFile; inputReferences?: GatewayFile[] },
  defaultGenerateAudio: boolean,
  modelPolicy: VercelGatewaySeedanceModelPolicy,
): Record<string, unknown> {
  const prompt = generation.prompt.trim();
  if (!prompt || prompt.length > 8_000) {
    throw new VercelGatewayProviderError("vercel_gateway_prompt_invalid", false);
  }
  const duration = generation.durationSeconds ?? 8;
  if (
    !Number.isInteger(duration) ||
    duration < modelPolicy.minimumDurationSeconds ||
    duration > modelPolicy.maximumDurationSeconds
  ) {
    throw new VercelGatewayProviderError("vercel_gateway_duration_unsupported", false);
  }
  const requestedRatio = generation.aspectRatio ?? "9:16";
  const aspectRatio = DIRECT_RATIO[requestedRatio];
  const resolutionTier = generation.resolution ?? defaultResolutionTier;
  const generateAudio = generation.generateAudio ?? defaultGenerateAudio;
  const referenceImages = references.inputReferences
    ?.filter((reference): reference is GatewayUrlFile => reference.type === "url" && IMAGE_TYPES.has(reference.mediaType))
    .map((reference) => reference.url) ?? [];
  const referenceVideos = references.inputReferences
    ?.filter((reference): reference is GatewayUrlFile => reference.type === "url" && VIDEO_TYPES.has(reference.mediaType))
    .map((reference) => reference.url) ?? [];
  const referenceAudio = references.inputReferences
    ?.filter((reference): reference is GatewayUrlFile => reference.type === "url" && AUDIO_TYPES.has(reference.mediaType))
    .map((reference) => reference.url) ?? [];

  return {
    prompt,
    n: 1,
    // A first-frame request inherits its ratio from the exact prepared image.
    // Do not send a separate aspectRatio field: the live Seedance 2.5 Gateway
    // contract rejects first-frame requests that also carry that field. The
    // quote remains ratio-bound because the server prepares the image canvas.
    ...(!references.image ? { aspectRatio } : {}),
    // Gateway's live Seedance catalog exposes resolution tiers, not pixel
    // dimensions. The quoted ratio determines the actual canvas while the
    // tier controls price/quality.
    resolution: resolutionTier,
    duration,
    fps: 24,
    generateAudio,
    providerOptions: {
      gateway: {
        user: `render:${generation.operationId}`,
        tags: ["app:movprompt", "service:worker", `capability:${generation.capability}`],
      },
      // ByteDance requires semantic reference roles. Gateway's generic
      // `inputReferences` field can be interpreted as a first frame, which
      // makes the source canvas override the quote-bound output ratio. Use the
      // documented provider options so the upstream request carries
      // `reference_image`, `reference_video`, and `reference_audio` roles.
      bytedance: {
        generateAudio,
        ...(referenceImages.length ? { referenceImages } : {}),
        ...(referenceVideos.length ? { referenceVideos } : {}),
        ...(referenceAudio.length ? { referenceAudio } : {}),
      },
    },
    ...(references.image ? { image: references.image } : {}),
  };
}

function statusOperation(
  providerRequestId: string,
  payload: z.infer<typeof GatewayStatusResponseSchema>,
): ProviderOperation {
  const telemetry = providerTelemetry(payload);
  if (payload.status === "pending") {
    return { providerRequestId, status: "processing", ...(telemetry ? { telemetry } : {}) };
  }
  if (payload.status === "cancelled") {
    return { providerRequestId, status: "cancelled", ...(telemetry ? { telemetry } : {}) };
  }
  if (payload.status === "error") {
    return {
      providerRequestId,
      status: "failed",
      errorCode: "vercel_gateway_generation_failed",
      errorMessage: payload.error.slice(0, 2_000),
      ...(telemetry ? { telemetry } : {}),
    };
  }
  const video = payload.videos.find((candidate) => candidate.type === "url");
  if (!video) {
    // Gateway completion without a usable output is ambiguous, not a customer
    // failure. Keep polling the exact persisted operation: a later status can
    // expose the output without another billable submission.
    return {
      providerRequestId,
      status: "processing",
      ...(telemetry ? { telemetry } : {}),
    };
  }
  return { providerRequestId, status: "completed", outputUrl: video.url, ...(telemetry ? { telemetry } : {}) };
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 160) : undefined;
}

function safeScaledInteger(value: number | undefined, multiplier: number): number | undefined {
  if (value === undefined || value < 0) return undefined;
  const scaled = Math.round(value * multiplier);
  return Number.isSafeInteger(scaled) ? scaled : undefined;
}

function providerTelemetry(payload: unknown): ProviderOperation["telemetry"] | undefined {
  const metadata = object(object(payload)?.providerMetadata);
  const gateway = object(metadata?.gateway);
  const bytedance = object(metadata?.bytedance);
  const usage = object(bytedance?.usage);
  const routing = object(gateway?.routing);
  const cost = finiteNumber(gateway?.cost);
  const generationSeconds = finiteNumber(gateway?.generationTime);
  const latencySeconds = finiteNumber(gateway?.latency);
  const sanitized: Record<string, string | number | boolean | null> = {};
  for (const [name, value] of [
    ["gateway_generation_id", safeString(gateway?.generationId)],
    ["gateway_provider", safeString(routing?.provider)],
    ["gateway_region", safeString(routing?.region)],
    ["gateway_cost_usd", cost],
    ["gateway_cost_usd_internal", finiteNumber(gateway?.gatewayCost)],
    ["gateway_market_cost_usd", finiteNumber(gateway?.marketCost)],
    ["provider_prompt_tokens", finiteNumber(usage?.prompt_tokens)],
    ["provider_completion_tokens", finiteNumber(usage?.completion_tokens)],
    ["provider_total_tokens", finiteNumber(usage?.total_tokens)],
  ] as const) {
    if (value !== undefined) sanitized[name] = value;
  }
  const providerCostMicrousd = safeScaledInteger(cost, 1_000_000);
  const measuredSeconds = generationSeconds ?? latencySeconds;
  const providerLatencyMs = safeScaledInteger(measuredSeconds, 1_000);
  if (providerCostMicrousd === undefined && providerLatencyMs === undefined && !Object.keys(sanitized).length) {
    return undefined;
  }
  return {
    ...(providerCostMicrousd === undefined ? {} : { providerCostMicrousd }),
    ...(providerLatencyMs === undefined ? {} : { providerLatencyMs }),
    ...(Object.keys(sanitized).length ? { usage: sanitized } : {}),
  };
}

/**
 * Durable Seedance adapter for the AI Gateway v4 async video operation.
 * contract. Provider/model identifiers stay entirely on the server.
 *
 * The current Gateway contract exposes start/status but no request-cancel
 * endpoint. `cancel` therefore observes the authoritative provider status and
 * never fabricates a cancellation/refund. The worker keeps the run in
 * `cancelling` while Gateway remains pending.
 */
export function createVercelGatewaySeedanceAdapter(
  options: VercelGatewaySeedanceAdapterOptions,
): ProviderAdapter {
  const apiKey = options.apiKey.trim();
  if (!apiKey) throw new Error("vercel_gateway_api_key_required");
  const modelPolicy = resolveVercelGatewaySeedanceModelPolicy(
    options.modelId,
    options.applicationEnvironment,
  );
  const modelId = modelPolicy.modelId;
  const baseUrl = cleanBaseUrl(options.baseUrl ?? "https://ai-gateway.vercel.sh/v4/ai");
  const resolutionTier = options.resolutionTier ?? "720p";
  const defaultGenerateAudio = options.generateAudio ?? false;
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.requestTimeoutMs ?? 30_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    throw new Error("vercel_gateway_request_timeout_invalid");
  }

  async function request(path: "/video-model/start" | "/video-model/status", body: unknown, idempotencyKey?: string) {
    let response: Response;
    try {
      response = await fetcher(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "ai-gateway-protocol-version": GATEWAY_PROTOCOL_VERSION,
          "ai-gateway-auth-method": "api-key",
          "ai-video-model-specification-version": GATEWAY_VIDEO_SPECIFICATION_VERSION,
          "ai-model-id": modelId,
          ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new VercelGatewayProviderError(
        "vercel_gateway_network_error",
        true,
        error instanceof Error ? error.message.slice(0, 1_500) : "AI Gateway network request failed.",
      );
    }
    if (!response.ok) {
      throw new VercelGatewayProviderError(
        `vercel_gateway_http_${response.status}`,
        retryableStatus(response.status),
        await errorMessage(response),
      );
    }
    return response;
  }

  async function getStatus(providerRequestId: string): Promise<ProviderOperation> {
    const operation = decodeOperation(providerRequestId);
    const response = await request("/video-model/status", { operation });
    let payload: z.infer<typeof GatewayStatusResponseSchema>;
    try {
      payload = GatewayStatusResponseSchema.parse(await response.json());
    } catch (error) {
      throw new VercelGatewayProviderError(
        "vercel_gateway_status_response_invalid",
        true,
        error instanceof Error ? error.message.slice(0, 1_500) : "AI Gateway status response was invalid.",
      );
    }
    return statusOperation(providerRequestId, payload);
  }

  return {
    id: VERCEL_GATEWAY_SEEDANCE_ADAPTER_ID,
    capability: options.capability,

    async submit(generation): Promise<ProviderSubmission> {
      if (
        options.capability === "video.product_fidelity" &&
        !generation.references.some((reference) => IMAGE_TYPES.has(reference.mimeType.trim().toLowerCase()))
      ) {
        throw new VercelGatewayProviderError("vercel_gateway_product_reference_required", false);
      }
      // Gateway/Seedance currently rejects product-fidelity referenceImages
      // combined with an explicit ratio. The worker therefore reads the first
      // private product image, contain+pads it to the exact quote-bound canvas
      // and supplies it as an inline first-frame file. The request omits the
      // separate ratio field so Seedance inherits that prepared canvas without
      // exposing local storage to the provider.
      const references = await referenceFiles(
        generation.references,
        options.resolveReferenceUrl,
        options.resolveFirstFrame,
        true,
        generation,
      );
      const body = generationBody(
        generation,
        resolutionTier,
        references,
        defaultGenerateAudio,
        modelPolicy,
      );
      const response = await request("/video-model/start", body, generation.idempotencyKey);
      let started: z.infer<typeof GatewayStartResponseSchema>;
      try {
        started = GatewayStartResponseSchema.parse(await response.json());
      } catch (error) {
        // The start endpoint is billable. A malformed/lost response is
        // retryable only because every retry reuses the same Gateway-supported
        // idempotency key.
        throw new VercelGatewayProviderError(
          "vercel_gateway_start_response_invalid",
          true,
          error instanceof Error ? error.message.slice(0, 1_500) : "AI Gateway start response was invalid.",
        );
      }
      return {
        providerRequestId: encodeOperation(started.operation),
        status: "queued",
        acceptedAt: new Date().toISOString(),
      };
    },

    getStatus,

    // Gateway currently publishes no request-cancel endpoint. Observe status
    // only: cancelled is returned only when Gateway itself confirms it.
    cancel: getStatus,
  };
}
