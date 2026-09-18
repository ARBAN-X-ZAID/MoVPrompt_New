import { z } from "zod";

import type {
  ProviderAdapter,
  ProviderGenerationRequest,
  ProviderOperation,
  ProviderReference,
  ProviderSubmission,
} from "./adapter.js";

const CreateResponseSchema = z.object({ id: z.string().trim().min(1) }).passthrough();
const TaskResponseSchema = z
  .object({
    id: z.string().trim().min(1),
    status: z.enum(["queued", "running", "cancelled", "succeeded", "failed", "expired"]),
    content: z.object({ video_url: z.string().url().optional() }).nullish(),
    error: z.object({ code: z.string().optional(), message: z.string().optional() }).nullish(),
    created_at: z.number().optional(),
  })
  .passthrough();

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
export type BytePlusResolvedReference = {
  url: string;
  /** Authoritative server-verified MIME; never copied from client JSON. */
  mediaType: string;
};
type ReferenceUrlResolver = (
  reference: ProviderReference,
  generation: ProviderGenerationRequest,
) => Promise<BytePlusResolvedReference>;

export type BytePlusSeedanceAdapterOptions = {
  capability: "video.cinematic" | "video.product_fidelity";
  apiKey: string;
  modelId: string;
  resolveReferenceUrl: ReferenceUrlResolver;
  baseUrl?: string;
  callbackUrl?: string;
  resolution?: "720p" | "1080p";
  generateAudio?: boolean;
  fetcher?: Fetcher;
  requestTimeoutMs?: number;
};

export class BytePlusProviderError extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    message = code,
  ) {
    super(message);
    this.name = "BytePlusProviderError";
  }
}

function cleanBaseUrl(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    throw new Error("byteplus_base_url_must_use_https");
  }
  return parsed.toString().replace(/\/$/u, "");
}

function assertModel(modelId: string): string {
  const model = modelId.trim();
  if (!/^dreamina-seedance-2-0-[a-z0-9-]+$/u.test(model)) {
    throw new Error("byteplus_seedance_2_model_required");
  }
  return model;
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

async function errorMessage(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  return body.trim().slice(0, 1_500) || `HTTP ${response.status}`;
}

function providerStatus(task: z.infer<typeof TaskResponseSchema>): ProviderOperation {
  if (task.status === "queued") return { providerRequestId: task.id, status: "queued" };
  if (task.status === "running") return { providerRequestId: task.id, status: "processing" };
  if (task.status === "cancelled") return { providerRequestId: task.id, status: "cancelled" };
  if (task.status === "succeeded") {
    if (!task.content?.video_url) {
      return {
        providerRequestId: task.id,
        status: "failed",
        errorCode: "byteplus_output_missing",
        errorMessage: "BytePlus returned succeeded without a video URL.",
      };
    }
    return { providerRequestId: task.id, status: "completed", outputUrl: task.content.video_url };
  }
  return {
    providerRequestId: task.id,
    status: "failed",
    errorCode: task.error?.code?.trim() || (task.status === "expired" ? "byteplus_task_expired" : "byteplus_task_failed"),
    errorMessage: task.error?.message?.trim() || task.status,
  };
}

async function referenceContent(
  references: ProviderReference[],
  resolveReferenceUrl: ReferenceUrlResolver,
  generation: ProviderGenerationRequest,
): Promise<Array<Record<string, unknown>>> {
  let imageCount = 0;
  let videoCount = 0;
  let audioCount = 0;
  const content: Array<Record<string, unknown>> = [];
  for (const reference of references) {
    const resolved = await resolveReferenceUrl(reference, generation);
    const mimeType = resolved.mediaType.trim().toLowerCase();
    const url = resolved.url;
    if (mimeType.startsWith("image/")) {
      imageCount += 1;
      if (imageCount > 9) throw new BytePlusProviderError("byteplus_image_reference_limit", false);
      content.push({ type: "image_url", image_url: { url }, role: "reference_image" });
    } else if (mimeType.startsWith("video/")) {
      videoCount += 1;
      if (videoCount > 3) throw new BytePlusProviderError("byteplus_video_reference_limit", false);
      content.push({ type: "video_url", video_url: { url }, role: "reference_video" });
    } else if (mimeType.startsWith("audio/")) {
      audioCount += 1;
      if (audioCount > 3) throw new BytePlusProviderError("byteplus_audio_reference_limit", false);
      content.push({ type: "audio_url", audio_url: { url }, role: "reference_audio" });
    } else {
      throw new BytePlusProviderError("byteplus_reference_type_unsupported", false);
    }
  }
  if (audioCount && imageCount + videoCount === 0) {
    throw new BytePlusProviderError("byteplus_audio_requires_visual_reference", false);
  }
  return content;
}

export function createBytePlusSeedanceAdapter(options: BytePlusSeedanceAdapterOptions): ProviderAdapter {
  const apiKey = options.apiKey.trim();
  if (!apiKey) throw new Error("byteplus_api_key_required");
  const model = assertModel(options.modelId);
  const baseUrl = cleanBaseUrl(options.baseUrl ?? "https://ark.ap-southeast.bytepluses.com/api/v3");
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.requestTimeoutMs ?? 30_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    throw new Error("byteplus_request_timeout_invalid");
  }

  async function request(path: string, init: RequestInit): Promise<Response> {
    const response = await fetcher(`${baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        ...init.headers,
      },
    });
    if (!response.ok) {
      throw new BytePlusProviderError(
        `byteplus_http_${response.status}`,
        retryableStatus(response.status),
        await errorMessage(response),
      );
    }
    return response;
  }

  async function getTask(providerRequestId: string): Promise<ProviderOperation> {
    const id = encodeURIComponent(providerRequestId.trim());
    if (!id) throw new BytePlusProviderError("byteplus_task_id_required", false);
    const response = await request(`/contents/generations/tasks/${id}`, { method: "GET" });
    return providerStatus(TaskResponseSchema.parse(await response.json()));
  }

  return {
    id: "byteplus-modelark",
    capability: options.capability,

    async submit(generation): Promise<ProviderSubmission> {
      const duration = generation.durationSeconds ?? 8;
      if (!Number.isInteger(duration) || duration < 4 || duration > 15) {
        throw new BytePlusProviderError("byteplus_duration_unsupported", false);
      }
      const references = await referenceContent(generation.references, options.resolveReferenceUrl, generation);
      const body = {
        model,
        content: [{ type: "text", text: generation.prompt }, ...references],
        duration,
        ratio: generation.aspectRatio ?? "9:16",
        resolution: options.resolution ?? "1080p",
        generate_audio: generation.generateAudio ?? options.generateAudio ?? true,
        watermark: false,
        safety_identifier: generation.operationId.replace(/[^A-Za-z0-9_-]/gu, "").slice(0, 64),
        execution_expires_after: 3_600,
        ...(options.callbackUrl ? { callback_url: options.callbackUrl } : {}),
      };
      const response = await request("/contents/generations/tasks", {
        method: "POST",
        headers: { "x-client-request-id": generation.idempotencyKey },
        body: JSON.stringify(body),
      });
      const created = CreateResponseSchema.parse(await response.json());
      return { providerRequestId: created.id, status: "queued", acceptedAt: new Date().toISOString() };
    },

    getStatus: getTask,

    async cancel(providerRequestId) {
      const id = encodeURIComponent(providerRequestId.trim());
      if (!id) throw new BytePlusProviderError("byteplus_task_id_required", false);
      try {
        await request(`/contents/generations/tasks/${id}`, { method: "DELETE" });
        return { providerRequestId, status: "cancelled" };
      } catch (error) {
        if (error instanceof BytePlusProviderError && error.code === "byteplus_http_409") {
          return getTask(providerRequestId);
        }
        throw error;
      }
    },
  };
}
