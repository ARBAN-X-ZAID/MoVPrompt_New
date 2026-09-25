import type { GuestAccess } from "./guest-access.js";
import { registerTemplatePreviewRoutes, type TemplatePreviewStorage } from "./template-preview-routes.js";
import type { ApiErrorEnvelope, ServiceHealth } from "@movprompt/contracts";
import {
  createCapabilityRegistryFromEnvironment,
  type CapabilityRegistry,
} from "@movprompt/providers";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import {
  SEEDANCE_25_CAPABILITIES,
  SEEDANCE_FAST_CAPABILITIES,
  resolveSeedanceCapabilities,
  type SeedanceCapabilities,
} from "@movprompt/creative-engine";
import { VideoCapabilitiesResponseSchema } from "@movprompt/contracts";
import type { AssetRepository } from "./asset-repository.js";
import { registerAssetRoutes } from "./asset-routes.js";
import type { AssetStorageGateway } from "./asset-storage.js";
import type { AssetContentVerifier } from "./asset-content-verifier.js";
import type { FootageVerifier } from "./footage-verifier.js";
import type { AuthGateway } from "./auth-gateway.js";
import type { ApiConfig } from "./config.js";
import { loadApiConfig } from "./config.js";
import { ApiHttpError } from "./errors.js";
import type { CreatorRepository } from "./creator-repository.js";
import { registerCreatorRoutes } from "./creator-routes.js";
import type { GuestClaimService } from "./guest-claim-service.js";
import { registerGenerationRoutes } from "./generation-routes.js";
import type { GenerationApiService } from "./generation-service.js";
import type { GenerationAvailabilityService } from "./generation-availability.js";
import { createOpenApiDocument } from "./openapi.js";
import { requestContext, type ApiEnvironment } from "./request-context.js";
import type { RemoteImageFetcher } from "./remote-image-fetcher.js";
import type { SourceScanner } from "./source-scanner.js";
import type { RequestRateLimiter } from "./request-rate-limiter.js";

export type ReadinessDependency = {
  name: string;
  check: () => Promise<void>;
};

export type CreateApiOptions = {
  config?: ApiConfig;
  capabilityRegistry?: CapabilityRegistry;
  readinessDependencies?: ReadinessDependency[];
  environment?: Readonly<Record<string, string | undefined>>;
  authGateway?: AuthGateway;
  guestAccess?: GuestAccess;
  templatePreviewStorage?: TemplatePreviewStorage;
  assetRepository?: AssetRepository;
  assetStorage?: AssetStorageGateway;
  assetContentVerifier?: AssetContentVerifier;
  footageVerifier?: FootageVerifier;
  remoteImageFetcher?: RemoteImageFetcher;
  creatorRepository?: CreatorRepository;
  guestClaimService?: GuestClaimService;
  sourceScanner?: SourceScanner;
  requestRateLimiter?: RequestRateLimiter;
  generationService?: GenerationApiService;
  generationAvailability?: GenerationAvailabilityService;
};

async function checkDependencies(dependencies: ReadinessDependency[]) {
  return Promise.all(
    dependencies.map(async (dependency) => {
      const startedAt = Date.now();
      try {
        await dependency.check();
        return {
          name: dependency.name,
          status: "ok" as const,
          latencyMs: Date.now() - startedAt,
        };
      } catch {
        return {
          name: dependency.name,
          status: "unavailable" as const,
          latencyMs: Date.now() - startedAt,
        };
      }
    }),
  );
}

export function createApi(options: CreateApiOptions = {}) {
  const environment = options.environment ?? process.env;
  const config = options.config ?? loadApiConfig(environment);
  const capabilities =
    options.capabilityRegistry ?? createCapabilityRegistryFromEnvironment(environment);
  const readinessDependencies = options.readinessDependencies ?? [];
  const app = new Hono<ApiEnvironment>();
  const effectiveFeatures = {
    ...config.featureFlags,
    authentication: config.featureFlags.authentication && Boolean(options.authGateway),
    assets:
      config.featureFlags.assets &&
      config.featureFlags.authentication &&
      Boolean(options.authGateway && options.assetRepository && options.assetStorage),
    generation: false,
  };

  async function generationAvailability() {
    return options.generationAvailability?.evaluate() ?? {
      status: "unavailable" as const,
      reason: "disabled" as const,
      retryable: false,
    };
  }

  app.use("*", requestContext);
  if (config.corsOrigins.length > 0) {
    app.use(
      "/api/*",
      cors({
        origin: config.corsOrigins,
        allowHeaders: [
          "Content-Type",
          "Authorization",
          "X-Request-ID",
          "Idempotency-Key",
        ],
        allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
        exposeHeaders: ["Content-Length", "X-Request-ID"],
        maxAge: 600,
        credentials: true,
      }),
    );
  }

  registerTemplatePreviewRoutes(app, options.templatePreviewStorage);

  app.get("/healthz", (context) =>
    context.json({
      service: config.serviceName,
      status: "ok",
      version: config.version,
      timestamp: new Date().toISOString(),
    }),
  );

  app.get("/api/v1/health", async (context) => {
    const dependencies = await checkDependencies(readinessDependencies);
    const ready = dependencies.every((dependency) => dependency.status === "ok");
    const body: ServiceHealth = {
      service: config.serviceName,
      status: ready ? "ok" : "unavailable",
      version: config.version,
      environment: config.environment,
      timestamp: new Date().toISOString(),
      requestId: context.get("requestId"),
      dependencies,
    };

    context.header("cache-control", "no-store");
    return ready ? context.json(body, 200) : context.json(body, 503);
  });

  app.get("/api/v1/version", (context) => {
    context.header("cache-control", "no-store");
    return context.json({
      service: config.serviceName,
      version: config.version,
      commitSha: config.commitSha,
      builtAt: config.builtAt,
      environment: config.environment,
    });
  });

  app.on(["GET", "POST"], "/api/auth/*", async (context) => {
    if (!effectiveFeatures.authentication || !options.authGateway) {
      throw new ApiHttpError({
        code: "authentication_service_unavailable",
        message: "Authentication is not available in this environment.",
        status: 503,
        retryable: true,
      });
    }

    const response = await options.authGateway.handle(context.req.raw);
    const headers = new Headers(response.headers);
    headers.set("x-request-id", context.get("requestId"));
    headers.set("cache-control", "no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });

  options.guestAccess?.register(app);
  const creatorAuth = options.guestAccess?.scopedAuth ?? options.authGateway;

  registerAssetRoutes(app, {
    enabled: effectiveFeatures.assets,
    ...(creatorAuth ? { auth: creatorAuth } : {}),
    ...(options.assetRepository ? { repository: options.assetRepository } : {}),
    ...(options.assetStorage ? { storage: options.assetStorage } : {}),
    ...(options.assetContentVerifier ? { assetContentVerifier: options.assetContentVerifier } : {}),
    ...(options.footageVerifier ? { footageVerifier: options.footageVerifier } : {}),
    ...(options.remoteImageFetcher ? { remoteImages: options.remoteImageFetcher } : {}),
    ...(options.requestRateLimiter ? { rateLimiter: options.requestRateLimiter } : {}),
    ...(options.guestClaimService ? { guestClaimService: options.guestClaimService } : {}),
  });

  registerCreatorRoutes(app, {
    enabled: config.featureFlags.templateMode && Boolean(options.creatorRepository),
    ...(creatorAuth ? { auth: creatorAuth } : {}),
    ...(options.creatorRepository ? { repository: options.creatorRepository } : {}),
    ...(options.guestClaimService ? { guestClaimService: options.guestClaimService } : {}),
    ...(options.assetStorage ? { storage: options.assetStorage } : {}),
    ...(options.sourceScanner ? { scanner: options.sourceScanner } : {}),
    ...(options.requestRateLimiter ? { rateLimiter: options.requestRateLimiter } : {}),
  });

  registerGenerationRoutes(app, {
    enabled: Boolean(options.authGateway && options.generationService),
    ...(options.generationAvailability ? { availability: options.generationAvailability } : {}),
    ...(creatorAuth ? { auth: creatorAuth } : {}),
    ...(options.generationService ? { generation: options.generationService } : {}),
  });

  app.get("/api/v1/feature-flags", async (context) => {
    const availability = await generationAvailability();
    const publicCapabilities = capabilities.listPublic().map((capability) => ({
      ...capability,
      available:
        capability.kind === "video"
          ? capability.available && availability.status === "ready"
          : capability.available,
    }));
    context.header("cache-control", "private, no-store");
    return context.json({
      features: { ...effectiveFeatures, generation: availability.status === "ready" },
      auth: options.authGateway?.publicCapability ?? null,
      capabilities: publicCapabilities,
      generationAvailability: availability,
      evaluatedAt: new Date().toISOString(),
    });
  });

  app.get("/api/v1/capabilities/video", (context) => {
    // Public, cache-friendly video capability list. Source of truth is
    // @movprompt/creative-engine's seedance-capabilities module. We expose
    // both the production (Seedance 2.5) and the local-only (Fast) model so
    // the web client can render accurate duration pickers in either
    // environment without a hard-coded model id.
    const explicitModel =
      environment["MOVPROMPT_GATEWAY_VIDEO_MODEL_ID"]?.trim() ||
      environment["MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC_MODEL_ID"]?.trim() ||
      null;
    const resolved: SeedanceCapabilities = resolveSeedanceCapabilities(
      explicitModel,
      (environment["APP_ENV"] === "local" || environment["APP_ENV"] === "staging")
        ? (environment["APP_ENV"] as "local" | "staging")
        : "production",
    );
    const models: SeedanceCapabilities[] = [SEEDANCE_25_CAPABILITIES];
    if (resolved.environment === "local" || resolved.modelId === SEEDANCE_FAST_CAPABILITIES.modelId) {
      models.push(SEEDANCE_FAST_CAPABILITIES);
    }
    const body = {
      models,
      activeModelId: resolved.modelId,
      evaluatedAt: new Date().toISOString(),
    };
    const validated = VideoCapabilitiesResponseSchema.parse(body);
    context.header("cache-control", "private, max-age=60");
    return context.json(validated);
  });

  app.get("/openapi.json", (context) => {
    context.header("cache-control", "no-store");
    return context.json(createOpenApiDocument(config.version));
  });

  app.notFound((context) => {
    const body: ApiErrorEnvelope = {
      error: {
        code: "route_not_found",
        message: "The requested API route does not exist.",
        retryable: false,
        requestId: context.get("requestId"),
      },
    };
    return context.json(body, 404);
  });

  app.onError((error, context) => {
    const requestId = context.get("requestId") || crypto.randomUUID();

    if (error instanceof ApiHttpError) {
      const path = new URL(context.req.url).pathname;
      console.warn(
        JSON.stringify({
          level: "warn",
          message: "api_request_rejected",
          requestId,
          code: error.code,
          status: error.status,
          method: context.req.method,
          path,
        }),
      );
      const body: ApiErrorEnvelope = {
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          requestId,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      };
      return context.json(body, error.status);
    }

    if (error instanceof z.ZodError) {
      const body: ApiErrorEnvelope = {
        error: {
          code: "validation_failed",
          message: "The request is invalid.",
          retryable: false,
          requestId,
          details: error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
        },
      };
      return context.json(body, 400);
    }

    console.error(
      JSON.stringify({
        level: "error",
        message: "unhandled_api_error",
        requestId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );

    const body: ApiErrorEnvelope = {
      error: {
        code: "internal_error",
        message: "The service could not complete the request.",
        retryable: true,
        requestId,
      },
    };
    return context.json(body, 500);
  });

  return app;
}

export type MovPromptApi = ReturnType<typeof createApi>;
