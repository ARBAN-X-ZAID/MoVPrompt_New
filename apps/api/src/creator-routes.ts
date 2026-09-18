import {
  AcceptProjectVersionRequestSchema,
  ClaimDraftRequestSchema,
  CreditSummaryResponseSchema,
  CreateProjectVersionRequestSchema,
  EmptyMutationRequestSchema,
  GuestClaimOperationResponseSchema,
  GuestClaimRouteParametersSchema,
  GuestClaimResponseSchema,
  GuestClaimSnapshotSchema,
  IdempotencyKeySchema,
  ProjectListQuerySchema,
  ProjectRouteParametersSchema,
  ReplaceProjectSourceRequestSchema,
  ReplaceProjectSourceResponseSchema,
  SourceScanRequestSchema,
  TemplateListQuerySchema,
  type CreditSummaryResponse,
  type OutputDownloadResponse,
  type ProjectListResponse,
  type ProjectResponse,
  type ProjectVersionListResponse,
  type ProjectVersionResponse,
  type ReplaceProjectSourceResponse,
  type TemplateListResponse,
  type TemplateResponse,
} from "@movprompt/contracts";
import type { Handler, Hono } from "hono";

import type { AssetStorageGateway } from "./asset-storage.js";
import type { AuthGateway } from "./auth-gateway.js";
import { CreatorRepositoryError, type CreatorRepository } from "./creator-repository.js";
import { ApiHttpError } from "./errors.js";
import { GuestClaimServiceError, type GuestClaimService } from "./guest-claim-service.js";
import type { ApiEnvironment } from "./request-context.js";
import type { SourceScanner } from "./source-scanner.js";
import { createSourceChangeService } from "./source-change-service.js";
import type { RequestRateLimiter } from "./request-rate-limiter.js";

export type CreatorRouteServices = {
  enabled: boolean;
  auth?: AuthGateway;
  repository?: CreatorRepository;
  storage?: AssetStorageGateway;
  scanner?: SourceScanner;
  rateLimiter?: RequestRateLimiter;
  guestClaimService?: GuestClaimService;
};

function requireRepository(services: CreatorRouteServices): CreatorRepository {
  if (!services.enabled || !services.repository) {
    throw new ApiHttpError({
      code: "creator_service_unavailable",
      message: "Creator projects are not available in this environment.",
      status: 503,
      retryable: true,
    });
  }
  return services.repository;
}

function requireAuth(services: CreatorRouteServices): AuthGateway {
  if (!services.auth) {
    throw new ApiHttpError({
      code: "authentication_service_unavailable",
      message: "Authentication is not available in this environment.",
      status: 503,
      retryable: true,
    });
  }
  return services.auth;
}

function requireGuestClaimService(services: CreatorRouteServices): GuestClaimService {
  if (!services.enabled || !services.guestClaimService) {
    throw new ApiHttpError({
      code: "guest_claim_service_unavailable",
      message: "Campaign recovery is not available in this environment.",
      status: 503,
      retryable: true,
    });
  }
  return services.guestClaimService;
}

async function requireUserId(services: CreatorRouteServices, headers: Headers): Promise<string> {
  const session = await requireAuth(services).getSession(headers);
  if (!session) {
    throw new ApiHttpError({
      code: "authentication_required",
      message: "Sign in to manage your campaigns.",
      status: 401,
      retryable: false,
    });
  }
  return session.user.id;
}

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiHttpError({
      code: "invalid_json",
      message: "The request body must contain valid JSON.",
      status: 400,
      retryable: false,
    });
  }
}

function mapRepositoryError(error: unknown): never {
  if (!(error instanceof CreatorRepositoryError)) throw error;
  if (error.code === "project_has_generated_video" || error.code === "project_generation_in_progress") {
    throw new ApiHttpError({
      code: error.code,
      message: error.code === "project_has_generated_video"
        ? "Projects with generated videos cannot be deleted. Only unfinished drafts can be deleted."
        : "This campaign is still generating. Wait until generation finishes before deleting a draft.",
      status: 409,
      retryable: false,
    });
  }
  if (error.code === "invalid_campaign_configuration") {
    throw new ApiHttpError({
      code: error.code,
      message: "Campaign settings are incomplete or no longer match the saved project.",
      status: 400,
      retryable: false,
    });
  }
  if (error.code === "idempotency_conflict") {
    throw new ApiHttpError({
      code: error.code,
      message: "This operation key was already used for a different campaign.",
      status: 409,
      retryable: false,
    });
  }
  throw new ApiHttpError({
    code: error.code,
    message:
      error.code === "template_not_found"
        ? "The published template version was not found."
        : error.code === "parent_version_not_found"
          ? "The parent version was not found in this project."
          : "The requested project was not found.",
    status: 404,
    retryable: false,
  });
}

function mapGuestClaimServiceError(error: GuestClaimServiceError): never {
  if (error.code === "invalid_campaign_configuration") {
    throw new ApiHttpError({
      code: error.code,
      message: "Campaign settings are incomplete, invalid, or no longer match the saved template.",
      status: 400,
      retryable: false,
    });
  }
  throw new ApiHttpError({
    code: error.code === "presenter_configuration_ineligible" ? error.code : "guest_claim_conflict",
    message: error.code === "presenter_configuration_ineligible" ? error.message : "This campaign claim cannot be completed.",
    status: 409,
    retryable: error.retryable,
  });
}

function noStore(context: { header(name: string, value: string): void }) {
  context.header("cache-control", "private, no-store");
}

async function scanSourceWithOneRetry(
  scanner: SourceScanner,
  input: Parameters<SourceScanner["scan"]>[0],
) {
  try {
    return await scanner.scan(input);
  } catch (error) {
    // One retry is reserved for transient upstream/network failures. Calling
    // scan again restarts URL parsing, DNS resolution, public-IP checks,
    // address pinning and redirect validation from the beginning.
    if (!(error instanceof ApiHttpError) || !error.retryable) throw error;
    return scanner.scan(input);
  }
}

export function registerCreatorRoutes(
  app: Hono<ApiEnvironment>,
  services: CreatorRouteServices,
): void {
  app.get("/api/v1/templates", async (context) => {
    const repository = requireRepository(services);
    const query = TemplateListQuerySchema.parse(context.req.query());
    const body: TemplateListResponse = {
      templates: await repository.listPublishedTemplates({
        ...(query.vertical ? { vertical: query.vertical } : {}),
        ...(query.goal ? { goal: query.goal } : {}),
        ...(query.language ? { language: query.language } : {}),
      }),
      requestId: context.get("requestId"),
    };
    context.header("cache-control", "public, max-age=60, stale-while-revalidate=300");
    return context.json(body);
  });

  app.get("/api/v1/templates/:slug", async (context) => {
    const repository = requireRepository(services);
    const template = await repository.findPublishedTemplate(context.req.param("slug"));
    if (!template) {
      throw new ApiHttpError({
        code: "template_not_found",
        message: "The published template was not found.",
        status: 404,
        retryable: false,
      });
    }
    const body: TemplateResponse = { template, requestId: context.get("requestId") };
    context.header("cache-control", "public, max-age=60, stale-while-revalidate=300");
    return context.json(body);
  });

  /** Authenticated non-guest drafts use a deliberately separate route from the canonical guest-claim protocol. */
  app.post("/api/v1/projects/claim", async (context) => {
    const repository = requireRepository(services);
    const userId = await requireUserId(services, context.req.raw.headers);
    const idempotencyKey = IdempotencyKeySchema.parse(context.req.header("idempotency-key") ?? "");
    const input = ClaimDraftRequestSchema.parse(await parseJson(context.req.raw));
    if (idempotencyKey !== input.draftId) {
      throw new ApiHttpError({
        code: "idempotency_conflict",
        message: "The draft ID must be used as the stable project claim operation key.",
        status: 409,
        retryable: false,
      });
    }
    try {
      const project = await repository.claimDraft(userId, input);
      const body: ProjectResponse = { project, requestId: context.get("requestId") };
      noStore(context);
      return context.json(body, 201);
    } catch (error) {
      mapRepositoryError(error);
    }
  });

  app.post("/api/v1/drafts/claim", async (context) => {
    const claimService = requireGuestClaimService(services);
    const userId = await requireUserId(services, context.req.raw.headers);
    const idempotencyKey = IdempotencyKeySchema.parse(context.req.header("idempotency-key") ?? "");
    const snapshot = GuestClaimSnapshotSchema.parse(await parseJson(context.req.raw));
    if (idempotencyKey !== snapshot.pendingGenerationId) {
      throw new ApiHttpError({
        code: "idempotency_conflict",
        message: "The pending generation ID must be used as the stable claim operation key.",
        status: 409,
        retryable: false,
      });
    }
    try {
      const claim = await claimService.claimGuestDraft({ userId, snapshot });
      const body = GuestClaimResponseSchema.parse({
        claim,
        requestId: context.get("requestId"),
      });
      noStore(context);
      return context.json(body, 201);
    } catch (error) {
      if (error instanceof GuestClaimServiceError) {
        mapGuestClaimServiceError(error);
      }
      mapRepositoryError(error);
    }
  });

  app.post("/api/v1/drafts/claim/start", async (context) => {
    const claimService = requireGuestClaimService(services);
    const userId = await requireUserId(services, context.req.raw.headers);
    const idempotencyKey = IdempotencyKeySchema.parse(context.req.header("idempotency-key") ?? "");
    const snapshot = GuestClaimSnapshotSchema.parse(await parseJson(context.req.raw));
    if (idempotencyKey !== snapshot.pendingGenerationId) {
      throw new ApiHttpError({
        code: "idempotency_conflict",
        message: "The pending generation ID must be used as the stable claim operation key.",
        status: 409,
        retryable: false,
      });
    }
    try {
      const operation = await claimService.startClaim({ userId, snapshot });
      const body = GuestClaimOperationResponseSchema.parse({
        operation,
        requestId: context.get("requestId"),
      });
      noStore(context);
      return context.json(body, 201);
    } catch (error) {
      if (error instanceof GuestClaimServiceError) {
        mapGuestClaimServiceError(error);
      }
      mapRepositoryError(error);
    }
  });

  app.get("/api/v1/drafts/claim/:pendingGenerationId", async (context) => {
    const claimService = requireGuestClaimService(services);
    const userId = await requireUserId(services, context.req.raw.headers);
    const { pendingGenerationId } = GuestClaimRouteParametersSchema.parse({
      pendingGenerationId: context.req.param("pendingGenerationId"),
    });
    try {
      const operation = await claimService.resumeClaim({ userId, pendingGenerationId });
      const body = GuestClaimOperationResponseSchema.parse({
        operation,
        requestId: context.get("requestId"),
      });
      noStore(context);
      return context.json(body);
    } catch (error) {
      if (error instanceof GuestClaimServiceError) {
        mapGuestClaimServiceError(error);
      }
      mapRepositoryError(error);
    }
  });

  app.post("/api/v1/drafts/claim/:pendingGenerationId/finalize", async (context) => {
    const claimService = requireGuestClaimService(services);
    const userId = await requireUserId(services, context.req.raw.headers);
    const { pendingGenerationId } = GuestClaimRouteParametersSchema.parse({
      pendingGenerationId: context.req.param("pendingGenerationId"),
    });
    const idempotencyKey = IdempotencyKeySchema.parse(context.req.header("idempotency-key") ?? "");
    EmptyMutationRequestSchema.parse(await parseJson(context.req.raw));
    if (idempotencyKey !== pendingGenerationId) {
      throw new ApiHttpError({
        code: "idempotency_conflict",
        message: "The pending generation ID must be used as the stable claim operation key.",
        status: 409,
        retryable: false,
      });
    }
    try {
      const claim = await claimService.finalizeClaim({ userId, pendingGenerationId });
      const body = GuestClaimResponseSchema.parse({ claim, requestId: context.get("requestId") });
      noStore(context);
      return context.json(body, 201);
    } catch (error) {
      if (error instanceof GuestClaimServiceError) {
        mapGuestClaimServiceError(error);
      }
      mapRepositoryError(error);
    }
  });

  app.get("/api/v1/projects", async (context) => {
    const repository = requireRepository(services);
    const userId = await requireUserId(services, context.req.raw.headers);
    const query = ProjectListQuerySchema.parse(context.req.query());
    const body: ProjectListResponse = {
      projects: await repository.listProjects(userId, {
        ...(query.status ? { status: query.status } : {}),
        includeTrashed: query.includeTrashed === "true",
        ...(query.search ? { search: query.search } : {}),
      }),
      requestId: context.get("requestId"),
    };
    noStore(context);
    return context.json(body);
  });

  app.get("/api/v1/projects/:projectId", async (context) => {
    const repository = requireRepository(services);
    const userId = await requireUserId(services, context.req.raw.headers);
    const { projectId } = ProjectRouteParametersSchema.parse({
      projectId: context.req.param("projectId"),
    });
    const project = await repository.findOwnedProject(userId, projectId);
    if (!project) mapRepositoryError(new CreatorRepositoryError("project_not_found"));
    const body: ProjectResponse = { project: project!, requestId: context.get("requestId") };
    noStore(context);
    return context.json(body);
  });

  app.post("/api/v1/projects/:projectId/duplicate", async (context) => {
    const repository = requireRepository(services);
    const userId = await requireUserId(services, context.req.raw.headers);
    const { projectId } = ProjectRouteParametersSchema.parse({
      projectId: context.req.param("projectId"),
    });
    EmptyMutationRequestSchema.parse(await parseJson(context.req.raw));
    const idempotencyKey = IdempotencyKeySchema.parse(context.req.header("idempotency-key") ?? "");
    try {
      const body: ProjectResponse = {
        project: await repository.duplicateProject(userId, projectId, idempotencyKey),
        requestId: context.get("requestId"),
      };
      noStore(context);
      return context.json(body, 201);
    } catch (error) {
      mapRepositoryError(error);
    }
  });

  for (const action of ["trash", "restore"] as const) {
    app.post(`/api/v1/projects/:projectId/${action}`, async (context) => {
      const repository = requireRepository(services);
      const userId = await requireUserId(services, context.req.raw.headers);
      const { projectId } = ProjectRouteParametersSchema.parse({
        projectId: context.req.param("projectId"),
      });
      EmptyMutationRequestSchema.parse(await parseJson(context.req.raw));
      IdempotencyKeySchema.parse(context.req.header("idempotency-key") ?? "");
      try {
        const project =
          action === "trash"
            ? await repository.trashProject(userId, projectId)
            : await repository.restoreProject(userId, projectId);
        const body: ProjectResponse = { project, requestId: context.get("requestId") };
        noStore(context);
        return context.json(body);
      } catch (error) {
        mapRepositoryError(error);
      }
    });
  }

  app.get("/api/v1/projects/:projectId/versions", async (context) => {
    const repository = requireRepository(services);
    const userId = await requireUserId(services, context.req.raw.headers);
    const { projectId } = ProjectRouteParametersSchema.parse({
      projectId: context.req.param("projectId"),
    });
    try {
      const body: ProjectVersionListResponse = {
        versions: await repository.listVersions(userId, projectId),
        requestId: context.get("requestId"),
      };
      noStore(context);
      return context.json(body);
    } catch (error) {
      mapRepositoryError(error);
    }
  });

  app.post("/api/v1/projects/:projectId/versions", async (context) => {
    const repository = requireRepository(services);
    const userId = await requireUserId(services, context.req.raw.headers);
    const { projectId } = ProjectRouteParametersSchema.parse({
      projectId: context.req.param("projectId"),
    });
    const idempotencyKey = IdempotencyKeySchema.parse(context.req.header("idempotency-key") ?? "");
    const input = CreateProjectVersionRequestSchema.parse(await parseJson(context.req.raw));
    try {
      const body: ProjectVersionResponse = {
        version: await repository.createVersion(userId, projectId, input, idempotencyKey),
        requestId: context.get("requestId"),
      };
      noStore(context);
      return context.json(body, 201);
    } catch (error) {
      mapRepositoryError(error);
    }
  });

  app.post("/api/v1/projects/:projectId/source", async (context) => {
    const repository = requireRepository(services);
    const userId = await requireUserId(services, context.req.raw.headers);
    const { projectId } = ProjectRouteParametersSchema.parse({ projectId: context.req.param("projectId") });
    const idempotencyKey = IdempotencyKeySchema.parse(context.req.header("idempotency-key") ?? "");
    const input = ReplaceProjectSourceRequestSchema.parse(await parseJson(context.req.raw));
    try {
      const result = await createSourceChangeService({ repository }).replace({ userId, projectId, idempotencyKey, input });
      const body: ReplaceProjectSourceResponse = {
        version: result.version,
        sourceFingerprint: result.sourceFingerprint,
        requestId: context.get("requestId"),
      };
      noStore(context);
      return context.json(ReplaceProjectSourceResponseSchema.parse(body), 201);
    } catch (error) {
      mapRepositoryError(error);
    }
  });

  app.post("/api/v1/projects/:projectId/accepted-version", async (context) => {
    const repository = requireRepository(services);
    const userId = await requireUserId(services, context.req.raw.headers);
    const { projectId } = ProjectRouteParametersSchema.parse({
      projectId: context.req.param("projectId"),
    });
    IdempotencyKeySchema.parse(context.req.header("idempotency-key") ?? "");
    const { versionId } = AcceptProjectVersionRequestSchema.parse(await parseJson(context.req.raw));
    try {
      const body: ProjectResponse = {
        project: await repository.acceptVersion(userId, projectId, versionId),
        requestId: context.get("requestId"),
      };
      noStore(context);
      return context.json(body);
    } catch (error) {
      mapRepositoryError(error);
    }
  });

  app.get("/api/v1/credits", async (context) => {
    const repository = requireRepository(services);
    const userId = await requireUserId(services, context.req.raw.headers);
    const body: CreditSummaryResponse = CreditSummaryResponseSchema.parse({
      ...(await repository.creditSummary(userId)),
      requestId: context.get("requestId"),
    });
    noStore(context);
    return context.json(body);
  });

  for (const [route, kind] of [
    ["product-scans", "product"],
    ["business-scans", "business"],
  ] as const) {
    app.post(`/api/v1/${route}`, async (context) => {
      if (!services.scanner) {
        throw new ApiHttpError({
          code: "source_scan_unavailable",
          message: "Link import is not available in this environment.",
          status: 503,
          retryable: true,
        });
      }
      const { url } = SourceScanRequestSchema.parse(await parseJson(context.req.raw));
      if (!services.rateLimiter) {
        throw new ApiHttpError({
          code: "source_scan_unavailable",
          message: "Link import is not available in this environment.",
          status: 503,
          retryable: true,
        });
      }
      const directAddress = context.env?.incoming?.socket.remoteAddress;
      const quota = await services.rateLimiter.consumePublicScan({
        headers: context.req.raw.headers,
        ...(directAddress === undefined ? {} : { directAddress }),
      });
      if (!quota.allowed) {
        context.header("retry-after", String(quota.retryAfterSeconds));
        throw new ApiHttpError({
          code: "source_scan_rate_limited",
          message: "Too many link imports. Please try again shortly.",
          status: 429,
          retryable: true,
        });
      }
      const body = await scanSourceWithOneRetry(services.scanner, {
        url,
        kind,
        requestId: context.get("requestId"),
      });
      // Imported business facts and URLs can be campaign-sensitive. Never put
      // a POST result in a shared proxy cache; scanner-side safe caching can be
      // introduced later with a normalized URL key and explicit abuse limits.
      noStore(context);
      return context.json(body);
    });
  }

  const serveOutput: Handler<ApiEnvironment> = async (context) => {
    const session = await requireAuth(services).getSession(context.req.raw.headers);
    if (session?.session.guest) throw new ApiHttpError({ code: "authentication_required", message: "Sign in to download the clean video.", status: 401, retryable: false });
    const repository = requireRepository(services);
    const userId = await requireUserId(services, context.req.raw.headers);
    const { projectId, runId } = ProjectRouteParametersSchema.parse({
      projectId: context.req.param("projectId"),
      runId: context.req.param("runId"),
    });
    if (!services.storage) {
      throw new ApiHttpError({
        code: "storage_unavailable",
        message: "Output download is not available in this environment.",
        status: 503,
        retryable: true,
      });
    }
    const output = await repository.findOwnedOutput(userId, projectId, runId!);
    if (!output) {
      throw new ApiHttpError({
        code: "output_not_found",
        message: "The completed output was not found.",
        status: 404,
        retryable: false,
      });
    }
    if (output.bucket !== services.storage.outputsBucket) {
      throw new ApiHttpError({
        code: "output_not_ready",
        message: "The output has not been copied into MovPrompt storage.",
        status: 409,
        retryable: true,
      });
    }
    const download = await services.storage.signDownload({
      bucket: output.bucket,
      key: output.objectKey,
      downloadFilename: `${projectId}.mp4`,
    });
    if (context.req.path.endsWith("/output/file")) {
      // Account ownership is checked above. R2 is read server-side so bucket
      // CORS and browser blocking of third-party storage cannot break exports.
      let upstream: Response;
      try {
        upstream = await fetch(download.url, {
          signal: AbortSignal.any([context.req.raw.signal, AbortSignal.timeout(30_000)]),
          redirect: "error",
        });
      } catch {
        throw new ApiHttpError({ code: "output_download_failed", message: "Could not retrieve your saved video. Please try again.", status: 502, retryable: true });
      }
      if (!upstream.ok || !upstream.body) {
        await upstream.body?.cancel();
        throw new ApiHttpError({ code: "output_download_failed", message: "Could not retrieve your saved video. Please try again.", status: 502, retryable: true });
      }
      return context.newResponse(upstream.body, 200, {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${projectId}.mp4"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ...(upstream.headers.get("content-length") ? { "Content-Length": upstream.headers.get("content-length")! } : {}),
      });
    }
    const body: OutputDownloadResponse = {
      runId: runId!,
      projectId,
      download: {
        method: "GET",
        url: download.url,
        expiresInSeconds: download.expiresInSeconds,
      },
      requestId: context.get("requestId"),
    };
    noStore(context);
    return context.json(body);
  };
  app.get("/api/v1/projects/:projectId/render-runs/:runId/output", serveOutput);
  app.get("/api/v1/projects/:projectId/render-runs/:runId/output/file", serveOutput);
}
