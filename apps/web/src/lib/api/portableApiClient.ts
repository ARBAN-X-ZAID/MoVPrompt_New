import {
  CreditSummaryResponseSchema,
  FeatureFlagsResponseSchema,
  GenerationQuoteResponseSchema,
  OutputDownloadResponseSchema,
  ProjectListResponseSchema,
  ProjectResponseSchema,
  ProjectVersionResponseSchema,
  ReplaceProjectSourceResponseSchema,
  RenderRunListResponseSchema,
  RenderRunResponseSchema,
  SourceScanResponseSchema,
  SignedAssetDownloadResponseSchema,
  TemplateListResponseSchema,
  TemplateResponseSchema,
  VideoCapabilitiesResponseSchema,
  type ClaimDraftRequest,
  type CreateGenerationQuoteRequest,
  type CreateProjectVersionRequest,
  type CreatorProjectRecord,
  type CreditSummaryResponse,
  type GenerationQuoteResponse,
  type FeatureFlagsResponse,
  type ProjectVersion,
  type ReplaceProjectSourceRequest,
  type PublicRenderRun,
  type PublicTemplate,
  type SourceScanResponse,
  type StartRenderRunRequest,
  type VideoCapabilitiesResponse,
} from "@movprompt/contracts";
import { z } from "zod";

function apiOrigin(): string {
  const configured = import.meta.env.VITE_API_ORIGIN?.trim();
  if (!configured) return window.location.origin;
  try {
    const url = new URL(configured);
    if (!/^https?:$/.test(url.protocol)) throw new Error("unsupported protocol");
    return url.origin;
  } catch {
    throw new Error("VITE_API_ORIGIN must be an absolute HTTP(S) origin");
  }
}

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export class PortableApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly requestId?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PortableApiError";
  }
}

async function request<T>(path: string, schema: z.ZodType<T>, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers({ accept: "application/json" });
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.idempotencyKey) headers.set("idempotency-key", options.idempotencyKey);
  const response = await fetch(`${apiOrigin()}${path}`, {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
  });
  const raw: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = raw && typeof raw === "object" && "error" in raw ? raw.error : null;
    if (error && typeof error === "object") {
      const value = error as Record<string, unknown>;
      throw new PortableApiError(
        typeof value.message === "string" ? value.message : "MovPrompt could not complete the request.",
        typeof value.code === "string" ? value.code : "api_error",
        value.retryable === true,
        typeof value.requestId === "string" ? value.requestId : undefined,
        response.status,
      );
    }
    throw new PortableApiError("MovPrompt could not complete the request.", "api_error", response.status >= 500, undefined, response.status);
  }
  return schema.parse(raw);
}

const GuestSessionResponseSchema = z.object({ user: z.object({ id: z.string(), name: z.string(), email: z.string() }), guest: z.boolean(), expiresAt: z.string().optional() });
let pendingGuestSession: Promise<z.infer<typeof GuestSessionResponseSchema>> | undefined;

export const portableCreatorApi = {
  async guestSession() {
    pendingGuestSession ??= request("/api/v1/guest/session", GuestSessionResponseSchema, { method: "POST", body: {}, signal: AbortSignal.timeout(30_000) }).finally(() => { pendingGuestSession = undefined; });
    return pendingGuestSession;
  },
  async claimGuestResults() {
    return request("/api/v1/guest/claim", z.object({ claimed: z.boolean(), projectIds: z.array(z.string()) }), { method: "POST", body: {}, signal: AbortSignal.timeout(30_000) });
  },
  async guestPreview(projectId: string, runId: string) {
    const result = await request(`/api/v1/guest/projects/${encodeURIComponent(projectId)}/render-runs/${encodeURIComponent(runId)}/preview`, z.object({ url: z.string().url() }));
    return result.url;
  },
  async featureFlags(): Promise<FeatureFlagsResponse> {
    return request("/api/v1/feature-flags", FeatureFlagsResponseSchema);
  },
  async videoCapabilities(): Promise<VideoCapabilitiesResponse> {
    return request("/api/v1/capabilities/video", VideoCapabilitiesResponseSchema);
  },

  async listTemplates(filters: { vertical?: string; goal?: string; language?: string } = {}): Promise<PublicTemplate[]> {
    const query = new URLSearchParams();
    if (filters.vertical) query.set("vertical", filters.vertical);
    if (filters.goal) query.set("goal", filters.goal);
    if (filters.language) query.set("language", filters.language);
    const result = await request(`/api/v1/templates${query.size ? `?${query}` : ""}`, TemplateListResponseSchema);
    return result.templates;
  },

  async getTemplate(slug: string): Promise<PublicTemplate> {
    const result = await request(`/api/v1/templates/${encodeURIComponent(slug)}`, TemplateResponseSchema);
    return result.template;
  },

  async claimDraft(input: ClaimDraftRequest): Promise<CreatorProjectRecord> {
    // Canonical guest recovery owns `/drafts/claim`. This endpoint is retained
    // for authenticated, non-guest drafts and deliberately has a distinct
    // contract and route so the two lifecycles cannot be confused.
    const result = await request("/api/v1/projects/claim", ProjectResponseSchema, {
      method: "POST",
      body: input,
      idempotencyKey: input.draftId,
    });
    return result.project;
  },

  async listProjects(filters: { status?: string; includeTrashed?: boolean; search?: string } = {}): Promise<CreatorProjectRecord[]> {
    const query = new URLSearchParams();
    if (filters.status) query.set("status", filters.status);
    if (filters.includeTrashed) query.set("includeTrashed", "true");
    if (filters.search) query.set("search", filters.search);
    const result = await request(`/api/v1/projects${query.size ? `?${query}` : ""}`, ProjectListResponseSchema);
    return result.projects;
  },

  async getProject(projectId: string): Promise<CreatorProjectRecord> {
    const result = await request(`/api/v1/projects/${projectId}`, ProjectResponseSchema);
    return result.project;
  },

  async duplicateProject(projectId: string): Promise<CreatorProjectRecord> {
    const key = `project-duplicate:${projectId}:${crypto.randomUUID()}`;
    const result = await request(`/api/v1/projects/${projectId}/duplicate`, ProjectResponseSchema, {
      method: "POST",
      body: {},
      idempotencyKey: key,
    });
    return result.project;
  },

  async trashProject(projectId: string): Promise<CreatorProjectRecord> {
    const result = await request(`/api/v1/projects/${projectId}/trash`, ProjectResponseSchema, {
      method: "POST",
      body: {},
      idempotencyKey: `project-trash:${projectId}`,
    });
    return result.project;
  },

  async restoreProject(projectId: string): Promise<CreatorProjectRecord> {
    const result = await request(`/api/v1/projects/${projectId}/restore`, ProjectResponseSchema, {
      method: "POST",
      body: {},
      idempotencyKey: `project-restore:${projectId}`,
    });
    return result.project;
  },

  async createVersion(projectId: string, input: CreateProjectVersionRequest, idempotencyKey: string): Promise<ProjectVersion> {
    const result = await request(`/api/v1/projects/${projectId}/versions`, ProjectVersionResponseSchema, {
      method: "POST",
      body: input,
      idempotencyKey,
    });
    return result.version;
  },

  async replaceSource(projectId: string, input: ReplaceProjectSourceRequest, idempotencyKey: string) {
    const result = await request(`/api/v1/projects/${projectId}/source`, ReplaceProjectSourceResponseSchema, {
      method: "POST",
      body: input,
      idempotencyKey,
    });
    return result;
  },

  async generationQuote(
    input: CreateGenerationQuoteRequest,
    options: Pick<RequestOptions, "signal"> = {},
  ): Promise<GenerationQuoteResponse["quote"] & { requestId: string }> {
    const result = await request("/api/v1/generation-quotes", GenerationQuoteResponseSchema, {
      method: "POST",
      body: input,
      ...options,
    });
    return { ...result.quote, requestId: result.requestId };
  },

  async startRender(input: StartRenderRunRequest, idempotencyKey: string): Promise<PublicRenderRun> {
    const result = await request("/api/v1/render-runs", RenderRunResponseSchema, {
      method: "POST",
      body: input,
      idempotencyKey,
    });
    return result.run;
  },

  async renderStatus(runId: string): Promise<PublicRenderRun> {
    const result = await request(`/api/v1/render-runs/${encodeURIComponent(runId)}`, RenderRunResponseSchema);
    return result.run;
  },

  async listRenders(filters: { projectId?: string; limit?: number } = {}): Promise<PublicRenderRun[]> {
    const query = new URLSearchParams();
    if (filters.projectId) query.set("projectId", filters.projectId);
    if (filters.limit) query.set("limit", String(filters.limit));
    const result = await request(
      `/api/v1/render-runs${query.size ? `?${query}` : ""}`,
      RenderRunListResponseSchema,
    );
    return result.runs;
  },

  async retryRenderOutput(runId: string, idempotencyKey: string): Promise<PublicRenderRun> {
    const result = await request(
      `/api/v1/render-runs/${encodeURIComponent(runId)}/retry-output`,
      RenderRunResponseSchema,
      { method: "POST", body: {}, idempotencyKey },
    );
    return result.run;
  },

  async cancelRender(runId: string, idempotencyKey: string): Promise<PublicRenderRun> {
    const result = await request(`/api/v1/render-runs/${encodeURIComponent(runId)}/cancel`, RenderRunResponseSchema, {
      method: "POST",
      body: {},
      idempotencyKey,
    });
    return result.run;
  },

  async outputDownload(projectId: string, runId: string): Promise<string> {
    const result = await request(
      `/api/v1/projects/${encodeURIComponent(projectId)}/render-runs/${encodeURIComponent(runId)}/output`,
      OutputDownloadResponseSchema,
    );
    return result.download.url;
  },

  async outputFileDownload(projectId: string, runId: string): Promise<string> {
    // Validate account ownership/readiness before starting browser navigation.
    // The attachment endpoint rechecks ownership and streams R2 privately.
    await this.outputDownload(projectId, runId);
    return `${apiOrigin()}/api/v1/projects/${encodeURIComponent(projectId)}/render-runs/${encodeURIComponent(runId)}/output/file`;
  },

  async assetDownload(projectId: string, assetId: string): Promise<string> {
    const result = await request(
      `/api/v1/projects/${projectId}/assets/${assetId}/download-url`,
      SignedAssetDownloadResponseSchema,
    );
    return result.download.url;
  },

  async credits(): Promise<CreditSummaryResponse> {
    return request("/api/v1/credits", CreditSummaryResponseSchema);
  },

  async scan(kind: "product" | "business", url: string, signal?: AbortSignal): Promise<SourceScanResponse> {
    return request(`/api/v1/${kind}-scans`, SourceScanResponseSchema, {
      method: "POST",
      body: { url },
      ...(signal ? { signal } : {}),
    });
  },
};
