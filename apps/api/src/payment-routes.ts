import {
  CreateTopUpRequestSchema,
  IdempotencyKeySchema,
  TopUpOrderParametersSchema,
  type CreateTopUpResponse,
  type CreditPackagesResponse,
  type TopUpOrderResponse,
} from "@movprompt/contracts";
import type { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { AuthGateway, AuthenticatedSession } from "./auth-gateway.js";
import { ApiHttpError } from "./errors.js";
import { TopUpError, type TopUpService } from "./payments/top-up-service.js";
import type { ApiEnvironment } from "./request-context.js";

export type PaymentRouteServices = {
  auth?: AuthGateway;
  topUps?: TopUpService;
};

function requireTopUps(services: PaymentRouteServices): { auth: AuthGateway; topUps: TopUpService } {
  if (!services.auth || !services.topUps) {
    throw new ApiHttpError({ code: "payments_unavailable", message: "Credit top-ups are not available yet.", status: 503, retryable: true });
  }
  return { auth: services.auth, topUps: services.topUps };
}

async function requireSession(auth: AuthGateway, headers: Headers): Promise<AuthenticatedSession> {
  const session = await auth.getSession(headers);
  if (!session) {
    throw new ApiHttpError({ code: "authentication_required", message: "Sign in to top up credits.", status: 401, retryable: false });
  }
  return session;
}

function topUpError(error: unknown): never {
  if (!(error instanceof TopUpError)) throw error;
  const status: ContentfulStatusCode = ({
    payments_unavailable: 503,
    authentication_required: 401,
    package_not_found: 400,
    custom_amount_unavailable: 400,
    custom_amount_invalid: 400,
    order_not_found: 404,
    checkout_failed: 502,
    webhook_rejected: 400,
    idempotency_conflict: 409,
    order_not_creditable: 409,
    payment_amount_mismatch: 409,
    top_up_limit_reached: 429,
  } as const)[error.code];
  const message = error.message === error.code
    ? {
        top_up_limit_reached: "Too many top-ups in the last hour. Try again later.",
        package_not_found: "That credit package is no longer available.",
        order_not_found: "Top-up not found.",
      }[error.code as "top_up_limit_reached" | "package_not_found" | "order_not_found"] ?? "The top-up could not be completed."
    : error.message;
  throw new ApiHttpError({ code: error.code, message, status, retryable: status >= 500 || status === 429 });
}

/** Only the gateway's opaque payment reference is forwarded; providers re-verify it with the gateway. */
function returnParams(trackId: string | undefined): Record<string, string> | undefined {
  return trackId && /^[A-Za-z0-9_-]{8,80}$/.test(trackId) ? { track_id: trackId } : undefined;
}

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiHttpError({ code: "invalid_json", message: "The request body must contain valid JSON.", status: 400, retryable: false });
  }
}

export function registerPaymentRoutes(app: Hono<ApiEnvironment>, services: PaymentRouteServices): void {
  app.get("/api/v1/credits/packages", (context) => {
    const { topUps } = requireTopUps(services);
    const body: CreditPackagesResponse = { ...topUps.packages(), requestId: context.get("requestId") };
    context.header("cache-control", "private, no-store");
    return context.json(body, 200);
  });

  app.post("/api/v1/credits/top-ups", async (context) => {
    const { auth, topUps } = requireTopUps(services);
    const session = await requireSession(auth, context.req.raw.headers);
    const request = CreateTopUpRequestSchema.parse(await parseJson(context.req.raw));
    const idempotencyKey = IdempotencyKeySchema.parse(context.req.header("idempotency-key") ?? "");
    try {
      const result = await topUps.createTopUp(session, request, idempotencyKey);
      const body: CreateTopUpResponse = { ...result, requestId: context.get("requestId") };
      console.info(JSON.stringify({ level: "info", message: "credit_top_up_created", requestId: context.get("requestId"), orderId: result.order.id, status: result.order.status, provider: result.order.provider }));
      context.header("cache-control", "private, no-store");
      return context.json(body, 201);
    } catch (error) {
      topUpError(error);
    }
  });

  app.get("/api/v1/credits/top-ups/:id", async (context) => {
    const { auth, topUps } = requireTopUps(services);
    const session = await requireSession(auth, context.req.raw.headers);
    const { id } = TopUpOrderParametersSchema.parse({ id: context.req.param("id") });
    try {
      const body: TopUpOrderResponse = { order: await topUps.getOrder(session.user.id, id, returnParams(context.req.query("track_id"))), requestId: context.get("requestId") };
      context.header("cache-control", "private, no-store");
      return context.json(body, 200);
    } catch (error) {
      topUpError(error);
    }
  });

  /** Gateways call this server-to-server; the provider verifies the signature on the raw body. */
  app.post("/api/v1/payments/webhooks/:provider", async (context) => {
    const { topUps } = requireTopUps(services);
    const rawBody = await context.req.text();
    try {
      await topUps.handleWebhook(context.req.param("provider"), { headers: context.req.raw.headers, rawBody });
      return context.json({ received: true }, 200);
    } catch (error) {
      topUpError(error);
    }
  });
}
