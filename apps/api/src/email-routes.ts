import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { MongoDatabase } from "@movprompt/db";
import type { AuthGateway } from "./auth-gateway.js";
import type { ApiEnvironment } from "./request-context.js";
import {
  EMAIL,
  createAdminEmailService,
  EmailApprovalSchema,
  verifyUnsubscribeToken,
} from "./admin/email-delivery.js";
import {
  adminObjectId,
  adminError,
  adminJson,
  createAdminSecurity,
  writeAdminAudit,
  type AdminSecurity,
} from "./admin/security.js";

export type EmailRuntime = { database: MongoDatabase; auth: AuthGateway };
export function registerPublicEmailRoutes(
  app: Hono<ApiEnvironment>,
  runtime: EmailRuntime | undefined,
  environment: Readonly<Record<string, string | undefined>>,
) {
  if (!runtime) return;
  const { database, auth } = runtime;
  const security = createAdminSecurity(database, auth);
  const prefs = database.db.collection(EMAIL.preferences);
  app.use(
    "/api/v1/notification-preferences",
    bodyLimit({
      maxSize: 16384,
      onError: () =>
        adminError(
          "email_payload_too_large",
          "This request is too large.",
          400,
        ),
    }),
  );
  app.use(
    "/api/v1/email/unsubscribe",
    bodyLimit({
      maxSize: 16384,
      onError: () =>
        adminError(
          "email_payload_too_large",
          "This request is too large.",
          400,
        ),
    }),
  );
  app.get("/api/v1/notification-preferences", async (context) => {
    const current = await auth.getSession(context.req.raw.headers);
    if (!current || current.session.guest)
      return adminError(
        "authentication_required",
        "Sign in to manage email preferences.",
        401,
      );
    const row = await prefs.findOne(
      { userId: adminObjectId(current.user.id) },
      { projection: { marketingOptIn: 1, revision: 1, suppressedAt: 1 } },
    );
    context.header("Cache-Control", "private, no-store");
    return context.json({
      marketingOptIn: row?.marketingOptIn === true,
      revision: Number(row?.revision ?? 0),
      suppressed: Boolean(row?.suppressedAt),
    });
  });
  app.post("/api/v1/notification-preferences", async (context) => {
    const origin = context.req.header("origin");
    const allowed = [
      environment.WEB_ORIGIN,
      environment.BETTER_AUTH_URL,
      ...(environment.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(","),
    ]
      .filter(Boolean)
      .map((value) => {
        try {
          return new URL(value!).origin;
        } catch {
          return "";
        }
      });
    if (origin && !allowed.includes(origin))
      return adminError(
        "email_origin_rejected",
        "This origin cannot update email preferences.",
        403,
      );
    if (!context.req.header("content-type")?.startsWith("application/json"))
      return adminError("email_json_required", "Use a JSON request.", 400);
    const current = await auth.getSession(context.req.raw.headers);
    if (!current || current.session.guest)
      return adminError(
        "authentication_required",
        "Sign in to manage email preferences.",
        401,
      );
    const input = z
      .object({
        expectedRevision: z.number().int().nonnegative(),
        marketingOptIn: z.boolean(),
      })
      .strict()
      .parse(await context.req.json());
    const actor = {
      userId: current.user.id,
      sessionId: current.session.id,
      requestId: context.get("requestId"),
    };
    const result = await security.command(
      actor,
      z.string().min(8).max(200).parse(context.req.header("idempotency-key")),
      input,
      async (session) => {
        const userId = adminObjectId(current.user.id);
        const row = await prefs.findOne({ userId }, { session });
        if (Number(row?.revision ?? 0) !== input.expectedRevision)
          return adminError(
            "email_preferences_changed",
            "Reload your email preferences before saving.",
          );
        const now = new Date();
        const value = {
          userId,
          revision: input.expectedRevision + 1,
          marketingOptIn: input.marketingOptIn,
          suppressedAt: input.marketingOptIn ? null : now,
          consentAt: input.marketingOptIn ? now : null,
          updatedAt: now,
        };
        await prefs.updateOne(
          { userId },
          { $set: value },
          { upsert: !row, session },
        );
        await writeAdminAudit(
          database,
          actor,
          "email.preferences",
          String(userId),
          { marketingOptIn: value.marketingOptIn, revision: value.revision },
          session,
        );
        return {
          marketingOptIn: value.marketingOptIn,
          revision: value.revision,
          suppressed: !value.marketingOptIn,
        };
      },
    );
    return context.json(result);
  });
  app.get("/api/v1/email/unsubscribe", (context) => {
    const token = context.req.query("token") ?? "";
    const id = verifyUnsubscribeToken(
      token,
      environment.BETTER_AUTH_SECRET ?? "",
    );
    if (!id) return context.notFound();
    context.header("Cache-Control", "no-store");
    context.header(
      "Content-Security-Policy",
      "default-src 'none'; form-action 'self'; frame-ancestors 'none'",
    );
    return context.html(
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MovPrompt email preferences</title><main><h1>Unsubscribe from promotional emails</h1><p>Account and support emails remain available.</p><form method="post" action="/api/v1/email/unsubscribe?token=${token}"><button type="submit">Unsubscribe · إلغاء الاشتراك</button></form></main></html>`,
    );
  });
  app.post("/api/v1/email/unsubscribe", async (context) => {
    const id = verifyUnsubscribeToken(
      context.req.query("token") ?? "",
      environment.BETTER_AUTH_SECRET ?? "",
    );
    if (!id) return context.notFound();
    await database.transaction(async (session) => {
      const userId = adminObjectId(id);
      const now = new Date();
      const previous = await prefs.findOne({ userId }, { session });
      if (previous?.marketingOptIn === false && previous.suppressedAt) return;
      await prefs.updateOne(
        { userId },
        {
          $set: { marketingOptIn: false, suppressedAt: now, updatedAt: now },
          $inc: { revision: 1 },
        },
        { upsert: true, session },
      );
      // Queued mail is suppressed again at send time; never rewrite a submitted
      // or accepted SMTP outcome into a claimed cancellation.
      await database.db
        .collection(EMAIL.deliveries)
        .updateMany(
          { userId, kind: "promotional", status: "queued" },
          {
            $set: {
              status: "suppressed",
              suppressionReason: "unsubscribed",
              updatedAt: now,
            },
          },
          { session },
        );
    });
    context.header("Cache-Control", "no-store");
    return context.text(
      "You are unsubscribed from promotional emails. تم إلغاء الاشتراك في البريد الترويجي.",
    );
  });
}

export function registerAdminEmailRoutes(
  app: Hono<ApiEnvironment>,
  database: MongoDatabase,
  security: AdminSecurity,
  environment: Readonly<Record<string, string | undefined>>,
) {
  const service = createAdminEmailService(database, security, environment);
  app.post("/api/v1/admin/content/:id/email-audience", async (context) =>
    context.json(
      await service.preview(
        await security.requireOwner(
          context.req.raw.headers,
          context.get("requestId"),
        ),
        context.req.param("id"),
        z.string().min(8).max(200).parse(context.req.header("idempotency-key")),
      ),
    ),
  );
  app.post("/api/v1/admin/content/:id/email-approve", async (context) =>
    context.json(
      await service.approve(
        await security.requireOwner(
          context.req.raw.headers,
          context.get("requestId"),
          true,
        ),
        context.req.param("id"),
        z.string().min(8).max(200).parse(context.req.header("idempotency-key")),
        EmailApprovalSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.post("/api/v1/admin/content/:id/email-test", async (context) =>
    context.json(
      await service.test(
        await security.requireOwner(
          context.req.raw.headers,
          context.get("requestId"),
          true,
        ),
        context.req.param("id"),
        z.string().min(8).max(200).parse(context.req.header("idempotency-key")),
        z
          .object({ locale: z.enum(["en", "ar"]) })
          .strict()
          .parse(await context.req.json()).locale,
      ),
    ),
  );
  app.get("/api/v1/admin/content/:id/email-deliveries", async (context) => {
    await security.requireOwner(
      context.req.raw.headers,
      context.get("requestId"),
    );
    const contentId = adminObjectId(context.req.param("id"));
    const [campaigns, counts, tests] = await Promise.all([
      database.db
        .collection(EMAIL.campaigns)
        .find(
          { contentId },
          {
            projection: {
              recipientCount: 1,
              counts: 1,
              status: 1,
              createdAt: 1,
              availableAt: 1,
              contentRevision: 1,
            },
          },
        )
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray(),
      database.db
        .collection(EMAIL.deliveries)
        .aggregate([
          { $match: { contentId } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ])
        .toArray(),
      database.db
        .collection(EMAIL.deliveries)
        .find(
          { contentId, kind: "test" },
          { projection: { status: 1, locale: 1, createdAt: 1 } },
        )
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray(),
    ]);
    return context.json(
      adminJson({ campaigns, counts, tests, deliveryConfirmed: false }),
    );
  });
}
