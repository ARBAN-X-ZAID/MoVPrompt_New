import {
  CancelRenderRunRequestSchema,
  CreateGenerationQuoteRequestSchema,
  IdempotencyKeySchema,
  RenderRunParametersSchema,
  RenderRunListQuerySchema,
  RetryRenderOutputRequestSchema,
  StartRenderRunRequestSchema,
  type GenerationQuoteResponse,
  type RenderRunListResponse,
  type RenderRunResponse,
} from "@movprompt/contracts";
import type { Hono } from "hono";

import type { AuthGateway, AuthenticatedSession } from "./auth-gateway.js";
import { ApiHttpError } from "./errors.js";
import {
  GenerationApplicationError,
  generationDependencyUnavailable,
  type GenerationApiService,
} from "./generation-service.js";
import type { GenerationAvailabilityService } from "./generation-availability.js";
import type { ApiEnvironment } from "./request-context.js";

export type GenerationRouteServices = {
  enabled: boolean;
  auth?: AuthGateway;
  generation?: GenerationApiService;
  availability?: GenerationAvailabilityService;
};

function requireServices(
  services: GenerationRouteServices,
): { auth: AuthGateway; generation: GenerationApiService } {
  if (!services.enabled || !services.auth || !services.generation) {
    throw new ApiHttpError({
      code: "generation_service_unavailable",
      message: "Video and image generation are not available in this environment.",
      status: 503,
      retryable: true,
    });
  }
  return { auth: services.auth, generation: services.generation };
}

async function requireSubmissionServices(
  services: GenerationRouteServices,
): Promise<{ auth: AuthGateway; generation: GenerationApiService }> {
  const configured = requireServices(services);
  const availability = await services.availability?.evaluate();
  if (!availability || availability.status !== "ready") {
    const reason = availability?.reason ?? "disabled";
    const messages = {
      disabled: "Video generation is temporarily unavailable.",
      pricing_unavailable: "Authoritative generation pricing is not configured.",
      capability_unavailable: "The approved video capability is temporarily unavailable.",
      worker_unavailable: "Generation is temporarily paused. Saved projects remain available.",
      storage_unavailable: "Private generation storage is temporarily unavailable.",
      quality_unavailable: "Video quality verification is temporarily unavailable.",
    } as const;
    throw new ApiHttpError({
      code: reason,
      message: messages[reason],
      status: 503,
      retryable: availability?.retryable ?? true,
    });
  }
  return configured;
}

async function sessionOrNull(auth: AuthGateway, headers: Headers): Promise<AuthenticatedSession | null> {
  return auth.getSession(headers);
}

async function requireSession(auth: AuthGateway, headers: Headers): Promise<AuthenticatedSession> {
  const session = await sessionOrNull(auth, headers);
  if (!session) {
    throw new ApiHttpError({
      code: "authentication_required",
      message: "Sign in to generate or manage a render.",
      status: 401,
      retryable: false,
    });
  }
  return session;
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

function applicationError(error: unknown): never {
  if (generationDependencyUnavailable(error)) {
    throw new ApiHttpError({
      code: "generation_service_unavailable",
      message: "Authoritative generation pricing is not configured.",
      status: 503,
      retryable: true,
    });
  }
  if (!(error instanceof GenerationApplicationError)) throw error;

  switch (error.code) {
    case "authentication_required":
      throw new ApiHttpError({ code: error.code, message: "Sign in to save this quote.", status: 401 });
    case "generation_service_unavailable":
    case "capability_unavailable":
      throw new ApiHttpError({ code: error.code, message: error.message, status: 503, retryable: true });
    case "unapproved_capability":
    case "invalid_generation_configuration":
    case "invalid_campaign_configuration":
    case "invalid_generation_reference":
    case "template_configuration_ineligible":
      throw new ApiHttpError({ code: error.code, message: error.message, status: 400 });
    case "presenter_configuration_ineligible":
      throw new ApiHttpError({
        code: error.code,
        message: error.message,
        status: 400,
      });
    case "project_version_not_found":
      throw new ApiHttpError({
        code: error.code,
        message: "The requested project version was not found.",
        status: 404,
      });
    case "template_version_not_found":
      throw new ApiHttpError({
        code: error.code,
        message: "The published template version was not found.",
        status: 404,
      });
    case "quote_not_found":
      throw new ApiHttpError({ code: error.code, message: "The generation quote was not found.", status: 404 });
    case "render_not_found":
      throw new ApiHttpError({ code: error.code, message: "The render was not found.", status: 404 });
    case "insufficient_credits":
      throw new ApiHttpError({
        code: error.code,
        message: "There are not enough available credits for this render.",
        status: 402,
      });
    case "quote_expired":
    case "quote_configuration_mismatch":
    case "quote_price_changed":
    case "starter_entitlement_unavailable":
    case "project_render_active":
    case "user_render_limit_reached":
    case "idempotency_conflict":
    case "render_not_cancellable":
    case "render_output_not_recoverable":
      throw new ApiHttpError({ code: error.code, message: error.message, status: 409 });
    case "provider_acceptance_in_progress":
      throw new ApiHttpError({ code: error.code, message: error.message, status: 409, retryable: true });
  }
}

export function registerGenerationRoutes(
  app: Hono<ApiEnvironment>,
  services: GenerationRouteServices,
): void {
  app.post("/api/v1/generation-quotes", async (context) => {
    const { auth, generation } = await requireSubmissionServices(services);
    const request = CreateGenerationQuoteRequestSchema.parse(await parseJson(context.req.raw));
    const session = await sessionOrNull(auth, context.req.raw.headers);
    try {
      const quote = await generation.createQuote(request, session);
      const response: GenerationQuoteResponse = { quote, requestId: context.get("requestId") };
      context.header("cache-control", "private, no-store");
      return context.json(response, 200);
    } catch (error) {
      applicationError(error);
    }
  });

  app.post("/api/v1/render-runs", async (context) => {
    const { auth, generation } = await requireSubmissionServices(services);
    const session = await requireSession(auth, context.req.raw.headers);
    const request = StartRenderRunRequestSchema.parse(await parseJson(context.req.raw));
    const idempotencyKey = IdempotencyKeySchema.parse(context.req.header("idempotency-key") ?? "");
    try {
      const run = await generation.startRender({
        userId: session.user.id,
        projectId: request.projectId,
        projectVersionId: request.projectVersionId,
        quoteId: request.quoteId,
        idempotencyKey,
      });
      const response: RenderRunResponse = { run, requestId: context.get("requestId") };
      console.info(JSON.stringify({ level: "info", message: "generation_job_submitted", timestamp: new Date().toISOString(), requestId: context.get("requestId"), renderRunId: run.id, projectId: run.projectId, status: run.status, stage: run.processingStage }));
      context.header("cache-control", "private, no-store");
      return context.json(response, 202);
    } catch (error) {
      applicationError(error);
    }
  });

  app.get("/api/v1/render-runs/:id", async (context) => {
    const { auth, generation } = requireServices(services);
    const session = await requireSession(auth, context.req.raw.headers);
    const { id } = RenderRunParametersSchema.parse({ id: context.req.param("id") });
    try {
      const run = await generation.getRender(session.user.id, id);
      const response: RenderRunResponse = { run, requestId: context.get("requestId") };
      context.header("cache-control", "private, no-store");
      return context.json(response, 200);
    } catch (error) {
      applicationError(error);
    }
  });

  app.get("/api/v1/render-runs", async (context) => {
    const { auth, generation } = requireServices(services);
    const session = await requireSession(auth, context.req.raw.headers);
    const query = RenderRunListQuerySchema.parse({
      projectId: context.req.query("projectId"),
      limit: context.req.query("limit") ?? undefined,
    });
    try {
      const runs = await generation.listRenders(session.user.id, query.projectId, query.limit);
      const response: RenderRunListResponse = { runs, requestId: context.get("requestId") };
      context.header("cache-control", "private, no-store");
      return context.json(response, 200);
    } catch (error) {
      applicationError(error);
    }
  });

  app.post("/api/v1/render-runs/:id/retry-output", async (context) => {
    const { auth, generation } = requireServices(services);
    const session = await requireSession(auth, context.req.raw.headers);
    const { id } = RenderRunParametersSchema.parse({ id: context.req.param("id") });
    RetryRenderOutputRequestSchema.parse(await parseJson(context.req.raw));
    const idempotencyKey = IdempotencyKeySchema.parse(context.req.header("idempotency-key") ?? "");
    try {
      const run = await generation.retryRenderOutput(session.user.id, id, idempotencyKey);
      const response: RenderRunResponse = { run, requestId: context.get("requestId") };
      context.header("cache-control", "private, no-store");
      return context.json(response, 202);
    } catch (error) {
      applicationError(error);
    }
  });

  app.post("/api/v1/render-runs/:id/cancel", async (context) => {
    const { auth, generation } = requireServices(services);
    const session = await requireSession(auth, context.req.raw.headers);
    const { id } = RenderRunParametersSchema.parse({ id: context.req.param("id") });
    CancelRenderRunRequestSchema.parse(await parseJson(context.req.raw));
    const idempotencyKey = IdempotencyKeySchema.parse(context.req.header("idempotency-key") ?? "");
    try {
      const run = await generation.cancelRender(session.user.id, id, idempotencyKey);
      const response: RenderRunResponse = { run, requestId: context.get("requestId") };
      context.header("cache-control", "private, no-store");
      return context.json(response, 202);
    } catch (error) {
      applicationError(error);
    }
  });
}
