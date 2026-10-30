import { createCustomerViews } from "./customer-views.js";
import { AdminPaymentQuerySchema, AdminDurationAvailabilitySchema, AdminCustomerTabSchema, AdminCustomerRecordsSchema, AdminPaymentHistorySchema } from "@movprompt/contracts";
import { PasswordCooldownError } from "../password-attempts.js";
import { registerSystemRoutes } from "./system-routes.js";
import { registerMigrationRoutes } from "./migration-routes.js";
import { registerRetentionRoutes } from "./retention-routes.js";
import { registerBusinessRenderRoutes } from "./business-render-routes.js";
import { registerAdminEmailRoutes } from "../email-routes.js";
import { registerSupportAttachmentRoutes } from "./support-attachments.js";
import { SupportReplySchema } from "@movprompt/contracts";
import { bodyLimit } from "hono/body-limit";
import { contentAudienceCount } from "./content-scheduler.js";
import { createAdminOwnedMediaService } from "./owned-media-service.js";
import { createAdminPrivacyService } from "./privacy-service.js";
import { createAdminModerationService } from "./moderation-service.js";
import { AdminModerationDecisionSchema } from "@movprompt/contracts";
import { createAdminReportService } from "./report-service.js";
import {
  createAdminPricingService,
  AdminPricingDraftSchema,
  AdminPricingPublishSchema,
} from "./pricing-service.js";
import {
  TemplatePublishInputSchema,
  TemplateRollbackInputSchema,
  TemplateDuplicateInputSchema,
} from "./template-publishing.js";
import { z } from "zod";
import type { Hono, Context } from "hono";
import type { MongoDatabase } from "@movprompt/db";
import {
  AdminAssuranceSchema,
  AdminOwnedMediaImportSchema,
  AdminOwnedMediaActionSchema,
  AdminPrivacyReviewSchema,
  AdminAssetActionSchema,
  AdminCaseSchema,
  AdminCaseUpdateSchema,
  AdminContentSchema,
  AdminCustomerMutationSchema,
  AdminExportSchema,
  AdminFinancialRequestSchema,
  AdminIdSchema,
  AdminListQuerySchema,
  AdminModerationSchema,
  AdminResourceSchema,
  AdminReviewSchema,
  AdminRunActionSchema,
  AdminSettingsSchema,
} from "@movprompt/contracts";
import type { AuthGateway } from "../auth-gateway.js";
import type { AssetStorageGateway } from "../asset-storage.js";
import type { ApiEnvironment } from "../request-context.js";
import {
  createAdminSecurity,
  adminError,
  adminObjectId,
  adminJson,
  ADMIN_COLLECTIONS as A,
  writeAdminAudit,
} from "./security.js";
import { createAdminDataService } from "./data-service.js";
import { createAdminFinanceService } from "./finance-service.js";
import { createAdminWorkspaceService } from "./workspace-service.js";
import {
  createAdminTemplateService,
  TemplateDraftInputSchema,
  TemplateStateInputSchema,
} from "./template-service.js";

export type AdminRuntime = {
  database: MongoDatabase;
  auth: AuthGateway;
  storage?: AssetStorageGateway;
};
export function registerAdminRoutes(
  app: Hono<ApiEnvironment>,
  runtime: AdminRuntime | undefined,
  environment: Readonly<Record<string, string | undefined>>,
) {
  const base = "/api/v1/admin";
  const enabled =
    environment.FEATURE_OWNER_ADMIN === "true" && Boolean(runtime);
  const boundedJson = bodyLimit({
    maxSize: 256 * 1024,
    onError: () =>
      adminError("admin_payload_too_large", "This request is too large.", 400),
  });
  const binarySupportUpload = (request: Request) =>
    request.method === "PUT" &&
    /^\/api\/v1\/(?:admin\/)?support\/[a-f\d]{24}\/attachments\/[a-f\d]{24}\/upload$/i.test(
      new URL(request.url).pathname,
    );
  const boundedRequest: typeof boundedJson = async (context, next) =>
    binarySupportUpload(context.req.raw) ? next() : boundedJson(context, next);
  app.use(`${base}/*`, boundedRequest);
  app.use("/api/v1/support", boundedRequest);
  app.use("/api/v1/support/*", boundedRequest);
  app.use(`${base}/*`, async (context, next) => {
    context.header("Cache-Control", "private, no-store");
    context.header("X-Content-Type-Options", "nosniff");
    context.header("X-Robots-Tag", "noindex, nofollow");
    if (!enabled)
      return adminError(
        "admin_unavailable",
        "Owner administration is not enabled.",
        503,
      );
    // Reject browser cross-site mutations even when SameSite=None is necessary
    // for the separate customer API hostname. CORS is not a CSRF boundary.
    if (context.req.method !== "GET" && context.req.method !== "OPTIONS") {
      const origin = context.req.header("origin");
      const trusted = new Set(
        [
          environment.BETTER_AUTH_URL,
          environment.WEB_ORIGIN,
          environment.APP_URL,
          ...(environment.CORS_ORIGINS ?? "").split(","),
          ...(environment.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(","),
        ]
          .filter(Boolean)
          .map((value) => {
            try {
              return new URL(value!.trim()).origin;
            } catch {
              return "";
            }
          }),
      );
      if (origin && !trusted.has(origin))
        return adminError(
          "admin_origin_rejected",
          "This origin cannot make admin changes.",
          403,
        );
      if (context.req.header("sec-fetch-site") === "cross-site" && !origin)
        return adminError(
          "admin_origin_rejected",
          "An approved origin is required.",
          403,
        );
      if (
        !binarySupportUpload(context.req.raw) &&
        !context.req.header("content-type")?.startsWith("application/json")
      )
        return adminError("admin_json_required", "Use a JSON request.", 400);
      const length = Number(context.req.header("content-length") ?? 0);
      if (
        length >
        (binarySupportUpload(context.req.raw) ? 12 * 1024 * 1024 : 256 * 1024)
      )
        return adminError(
          "admin_payload_too_large",
          "This request is too large.",
          400,
        );
    }
    await next();
    if (context.error && runtime) {
      const failure = context.error as Error & { code?: string };
      const current = await runtime.auth
        .getSession(context.req.raw.headers)
        .catch(() => null);
      await runtime.database.db.collection("audit_logs").insertOne({
        actorId: current ? adminObjectId(current.user.id) : null,
        action: "admin.request-rejected",
        target: new URL(context.req.url).pathname,
        requestId: context.get("requestId"),
        outcome: "failed",
        changes: {
          code: failure.code ?? "request_failed",
          method: context.req.method,
        },
        createdAt: new Date(),
      });
    }
  });
  if (!runtime) return;
  const { database, auth, storage } = runtime;
  const readOnly = environment.ADMIN_READ_ONLY === "true";
  const security = createAdminSecurity(database, auth, { readOnly });
  app.use(`${base}/*`, async (context, next) => {
    if (
      readOnly &&
      !["GET", "OPTIONS"].includes(context.req.method) &&
      ![`${base}/assurance`, `${base}/confirm-password`].includes(new URL(context.req.url).pathname)
    ) {
      await security.requireOwner(
        context.req.raw.headers,
        context.get("requestId"),
      );
      return adminError(
        "admin_read_only",
        "This owner workspace is read-only while production activation checks are pending.",
        503,
      );
    }
    await next();
  });
  registerSystemRoutes(app, database, security, environment);
  registerMigrationRoutes(app, database, security);
  registerAdminEmailRoutes(app, database, security, environment);
  registerBusinessRenderRoutes(app, database, security, environment);
  registerRetentionRoutes(app, database, security, environment);
  const pricing = createAdminPricingService(database, security, environment);
  const moderation = createAdminModerationService(database, security);
  const reports = createAdminReportService(database);
  const privacy = createAdminPrivacyService(database, security, environment);
  const data = createAdminDataService(database, security, environment);
  const finance = createAdminFinanceService(database, security, environment);
  const workspace = createAdminWorkspaceService(
    database,
    security,
    storage,
    environment,
  );
  const ownedMedia = createAdminOwnedMediaService(database, security, storage);
  const templates = createAdminTemplateService(database, security, environment);
  const views = createCustomerViews(database, environment);
  const actor = (context: Context<ApiEnvironment>, recent = false) =>
    security.requireOwner(
      context.req.raw.headers,
      context.get("requestId"),
      recent,
    );
  const key = (context: Context<ApiEnvironment>) =>
    z.string().min(8).max(200).parse(context.req.header("idempotency-key"));
  app.get(`${base}/email/status`, async (context) => {
    await actor(context);
    return context.json({
      enabled: environment.ADMIN_EMAIL_ENABLED === "true",
      smtpConfigured: Boolean(
        environment.SMTP_HOST &&
        environment.EMAIL_FROM &&
        environment.BETTER_AUTH_SECRET &&
        environment.BETTER_AUTH_URL,
      ),
      deliveryConfirmed: false,
    });
  });
  app.get(`${base}/identity`, async (context) =>
    context.json(await security.identity(context.req.raw.headers)),
  );
  app.post(`${base}/assurance`, async (context) => {
    const input = AdminAssuranceSchema.parse(await context.req.json());
    return context.json(
      await security.assure(
        context.req.raw.headers,
        input.code,
        context.get("requestId"),
        input.mode,
      ),
    );
  });
  app.post(`${base}/confirm-password`, async (context) => {
    const input = z.object({ password: z.string().min(1).max(128) }).strict().parse(await context.req.json());
    try { return context.json(await security.confirmPassword(context.req.raw.headers, input.password, context.get("requestId"))); }
    catch (error) {
      if (!(error instanceof PasswordCooldownError)) throw error;
      context.header("Retry-After", String(error.retryAfter));
      return context.json({ error: { code: error.code, message: error.message, retryable: true, requestId: context.get("requestId"), details: { retryAfter: error.retryAfter } } }, 429);
    }
  });
  app.get(`${base}/customers/:id/summary`, async (context) => { await actor(context); return context.json(await views.summary(AdminIdSchema.parse(context.req.param("id")))); });
  app.get(`${base}/customers/:id/records/:tab`, async (context) => {
    await actor(context);
    const tab = AdminCustomerTabSchema.parse(context.req.param("tab"));
    const query = AdminListQuerySchema.parse({ ...context.req.query(), userId: AdminIdSchema.parse(context.req.param("id")) });
    return context.json(AdminCustomerRecordsSchema.parse(await data.list(tab, query, true)));
  });
  app.get(`${base}/payment-history`, async (context) => { await actor(context); return context.json(AdminPaymentHistorySchema.parse(await views.payments(AdminPaymentQuerySchema.parse(context.req.query())))); });
  app.get(`${base}/security`, async (context) => {
    const owner = await actor(context);
    const sessions = await database.db
      .collection("sessions")
      .find(
        { userId: adminObjectId(owner.userId), expiresAt: { $gt: new Date() } },
        {
          projection: {
            createdAt: 1,
            updatedAt: 1,
            expiresAt: 1,
            userAgent: 1,
          },
        },
      )
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();
    return context.json(
      adminJson({ sessions, currentSessionId: owner.sessionId }),
    );
  });
  app.post(`${base}/security/revoke-other-sessions`, async (context) => {
    const owner = await actor(context, true);
    const input = z
      .object({ reason: z.string().trim().min(8).max(2000) })
      .strict()
      .parse(await context.req.json());
    return context.json(
      await security.command(owner, key(context), input, async (session) => {
        const result = await database.db.collection("sessions").deleteMany(
          {
            userId: adminObjectId(owner.userId),
            _id: { $ne: adminObjectId(owner.sessionId) },
          },
          { session },
        );
        await writeAdminAudit(
          database,
          owner,
          "owner.revoke-other-sessions",
          owner.userId,
          { reason: input.reason, count: result.deletedCount },
          session,
        );
        return { revoked: result.deletedCount };
      }),
    );
  });
  app.get(`${base}/privacy/:id`, async (context) => {
    await actor(context);
    return context.json(
      await privacy.load(AdminIdSchema.parse(context.req.param("id"))),
    );
  });
  app.post(`${base}/privacy/:id/review`, async (context) =>
    context.json(
      await privacy.review(
        await actor(context, true),
        AdminIdSchema.parse(context.req.param("id")),
        key(context),
        AdminPrivacyReviewSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.get(`${base}/overview`, async (context) => {
    await actor(context);
    return context.json(
      await data.overview(
        z.coerce
          .number()
          .int()
          .min(1)
          .max(366)
          .default(30)
          .parse(context.req.query("days")),
      ),
    );
  });
  app.get(`${base}/settings`, async (context) => {
    await actor(context);
    return context.json(await workspace.getSettings());
  });
  app.post(`${base}/settings`, async (context) =>
    context.json(
      await workspace.settings(
        await actor(context, true),
        key(context),
        AdminSettingsSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.post(`${base}/customers/:id/actions`, async (context) =>
    context.json(
      await data.customerAction(
        await actor(context, true),
        AdminIdSchema.parse(context.req.param("id")),
        key(context),
        AdminCustomerMutationSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.post(`${base}/finance/preview`, async (context) => {
    await actor(context);
    return context.json(
      await finance.impact(
        AdminFinancialRequestSchema.parse(await context.req.json()),
      ),
    );
  });
  app.post(`${base}/finance/requests`, async (context) =>
    context.json(
      await finance.request(
        await actor(context),
        key(context),
        AdminFinancialRequestSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.post(`${base}/finance/requests/:id/review`, async (context) =>
    context.json(
      await finance.review(
        await actor(context, true),
        AdminIdSchema.parse(context.req.param("id")),
        key(context),
        AdminReviewSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.post(`${base}/support`, async (context) =>
    context.json(
      await workspace.createCase(
        await actor(context),
        key(context),
        AdminCaseSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.post(`${base}/support/:id`, async (context) =>
    context.json(
      await workspace.updateCase(
        await actor(context),
        AdminIdSchema.parse(context.req.param("id")),
        key(context),
        AdminCaseUpdateSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.get(`${base}/owned-media/sources`, async (context) =>
    context.json(await ownedMedia.sources(await actor(context))),
  );
  app.post(`${base}/owned-media`, async (context) =>
    context.json(
      await ownedMedia.importRevision(
        await actor(context, true),
        null,
        key(context),
        AdminOwnedMediaImportSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.get(`${base}/owned-media/approved`, async (context) => {
    await actor(context);
    const items = await database.db
      .collection("admin_owned_media")
      .find(
        { status: "approved", deletedAt: null },
        { projection: { name: 1, kind: 1, revision: 1 } },
      )
      .sort({ updatedAt: -1 })
      .limit(200)
      .toArray();
    return context.json(adminJson({ items }));
  });
  app.post(`${base}/owned-media/:id/replace`, async (context) =>
    context.json(
      await ownedMedia.importRevision(
        await actor(context, true),
        AdminIdSchema.parse(context.req.param("id")),
        key(context),
        AdminOwnedMediaImportSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.post(`${base}/owned-media/:id/actions`, async (context) =>
    context.json(
      await ownedMedia.action(
        await actor(context, true),
        AdminIdSchema.parse(context.req.param("id")),
        key(context),
        AdminOwnedMediaActionSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.post(`${base}/assets/:id/actions`, async (context) =>
    context.json(
      await workspace.assetAction(
        await actor(context, true),
        AdminIdSchema.parse(context.req.param("id")),
        key(context),
        AdminAssetActionSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.get(`${base}/content/audience`, async (context) => {
    await actor(context);
    return context.json(
      await contentAudienceCount(
        database,
        z
          .enum(["all", "verified", "active"])
          .parse(context.req.query("audience") ?? "all"),
      ),
    );
  });
  app.post(`${base}/content`, async (context) =>
    context.json(
      await workspace.content(
        await actor(context, true),
        null,
        key(context),
        AdminContentSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.post(`${base}/content/:id`, async (context) =>
    context.json(
      await workspace.content(
        await actor(context, true),
        AdminIdSchema.parse(context.req.param("id")),
        key(context),
        AdminContentSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.post(`${base}/moderation/:id/decision`, async (context) =>
    context.json(
      await moderation.decide(
        await actor(context, true),
        AdminIdSchema.parse(context.req.param("id")),
        key(context),
        AdminModerationDecisionSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.post(`${base}/moderation`, async (context) =>
    context.json(
      await workspace.moderation(
        await actor(context),
        key(context),
        AdminModerationSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.post(`${base}/templates/:id/publish`, async (context) =>
    context.json(
      await templates.publish(
        await actor(context, true),
        AdminIdSchema.parse(context.req.param("id")),
        key(context),
        TemplatePublishInputSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.post(`${base}/templates/:id/rollback`, async (context) =>
    context.json(
      await templates.rollback(
        await actor(context, true),
        AdminIdSchema.parse(context.req.param("id")),
        key(context),
        TemplateRollbackInputSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.post(`${base}/templates/:id/duplicate`, async (context) =>
    context.json(
      await templates.duplicate(
        await actor(context, true),
        AdminIdSchema.parse(context.req.param("id")),
        key(context),
        TemplateDuplicateInputSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.get(`${base}/templates/:id/compare/:version`, async (context) => {
    await actor(context);
    return context.json(
      await templates.compare(
        AdminIdSchema.parse(context.req.param("id")),
        AdminIdSchema.parse(context.req.param("version")),
      ),
    );
  });
  app.get(`${base}/reports/summary`, async (context) => {
    await actor(context);
    const days = z.coerce
      .number()
      .int()
      .min(1)
      .max(366)
      .parse(context.req.query("days") ?? "30");
    return context.json(await reports.summary(days));
  });
  app.get(`${base}/pricing`, async (context) => {
    await actor(context);
    return context.json(await pricing.load());
  });
  app.post(`${base}/pricing/draft`, async (context) =>
    context.json(
      await pricing.save(
        await actor(context),
        key(context),
        AdminPricingDraftSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.post(`${base}/pricing/publish`, async (context) =>
    context.json(
      await pricing.publish(
        await actor(context, true),
        key(context),
        AdminPricingPublishSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.get(`${base}/templates/:id/editor`, async (context) => {
    await actor(context);
    return context.json(
      await templates.load(AdminIdSchema.parse(context.req.param("id"))),
    );
  });
  app.post(`${base}/templates/:id/draft`, async (context) =>
    context.json(
      await templates.save(
        await actor(context),
        AdminIdSchema.parse(context.req.param("id")),
        key(context),
        TemplateDraftInputSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.post(`${base}/templates/:id/availability`, async (context) => context.json(await templates.availability(await actor(context), AdminIdSchema.parse(context.req.param("id")), key(context), AdminDurationAvailabilitySchema.parse(await context.req.json()))));
  app.post(`${base}/templates/:id/state`, async (context) =>
    context.json(
      await templates.changeState(
        await actor(context),
        AdminIdSchema.parse(context.req.param("id")),
        key(context),
        TemplateStateInputSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.get(`${base}/media/:kind/:id`, async (context) => {
    const restricted =
      context.req.query("restricted") === "true" ||
      context.req.query("revision") !== undefined;
    const owner = await actor(context, restricted);
    const media = await workspace.media(owner, {
      kind: z
        .enum(["asset", "owned", "campaign", "generation"])
        .parse(context.req.param("kind")),
      id: AdminIdSchema.parse(context.req.param("id")),
      ...(context.req.query("photoId")
        ? { photoId: AdminIdSchema.parse(context.req.query("photoId")) }
        : {}),
      ...(context.req.query("revision")
        ? {
            revision: z.coerce
              .number()
              .int()
              .positive()
              .parse(context.req.query("revision")),
          }
        : {}),
      download: context.req.query("download") === "true",
      restricted,
      ...(context.req.header("range")
        ? { range: context.req.header("range")! }
        : {}),
    });
    context.header("Content-Type", media.mimeType);
    context.header(
      "Content-Disposition",
      `${context.req.query("download") === "true" ? "attachment" : "inline"}; filename="movprompt-media.${media.mimeType === "video/mp4" ? "mp4" : "bin"}"`,
    );
    context.header("Accept-Ranges", "bytes");
    if (media.contentRange) context.header("Content-Range", media.contentRange);
    context.header("Content-Length", String(media.contentLength));
    if (media.status === 416) return context.body(null, 416);
    return new Response(
      media.stream ?? (media.body ? new Uint8Array(media.body).buffer : null),
      { status: media.status, headers: context.res.headers },
    );
  });
  app.post(`${base}/generations/:id/actions`, async (context) => {
    const owner = await actor(context, true);
    const id = AdminIdSchema.parse(context.req.param("id"));
    const input = AdminRunActionSchema.parse(await context.req.json());
    const result = await security.command(
      owner,
      key(context),
      { id, ...input },
      async (session) => {
        const run = await database.db
          .collection("render_runs")
          .findOne({ _id: adminObjectId(id) }, { session });
        if (!run)
          return adminError(
            "admin_run_not_found",
            "Generation not found.",
            404,
          );
        if (
          input.action === "reconcile" &&
          !["submitting", "queued", "processing", "cancelling"].includes(
            run.status,
          )
        )
          return adminError(
            "generation_reconcile_unsafe",
            "Only an active or uncertain operation can be rechecked.",
          );
        const now = new Date();
        const operation = await database.db.collection(A.operations).insertOne(
          {
            kind: `generation.${input.action}`,
            runId: run._id,
            userId: run.userId,
            reason: input.reason,
            status: "queued",
            availableAt: now,
            attempts: 0,
            createdAt: now,
            updatedAt: now,
          },
          { session },
        );
        await writeAdminAudit(
          database,
          owner,
          `generation.${input.action}.requested`,
          id,
          {
            reason: input.reason,
            previousStatus: run.status,
            operationId: operation.insertedId,
          },
          session,
        );
        return {
          operationId: String(operation.insertedId),
          status: "queued",
          ...(input.action === "cancel"
            ? {
                warning:
                  "Cancellation is requested only. The provider may continue processing and incur cost.",
              }
            : {}),
        };
      },
    );
    return context.json(result);
  });
  app.post(`${base}/reports`, async (context) => {
    const owner = await actor(context, true);
    const input = AdminExportSchema.parse(await context.req.json());
    return context.json(
      await security.command(owner, key(context), input, async (session) => {
        const now = new Date();
        const result = await database.db.collection(A.operations).insertOne(
          {
            kind: "report.export",
            report: input.report,
            from: new Date(input.from),
            to: new Date(input.to),
            actorId: adminObjectId(owner.userId),
            status: "queued",
            availableAt: now,
            attempts: 0,
            createdAt: now,
            updatedAt: now,
          },
          { session },
        );
        await writeAdminAudit(
          database,
          owner,
          "report.request",
          String(result.insertedId),
          {
            report: input.report,
            from: input.from,
            to: input.to,
            reason: input.reason,
          },
          session,
        );
        return { operationId: String(result.insertedId), status: "queued" };
      }),
    );
  });
  app.get(`${base}/exports/:id/file`, async (context) => {
    const owner = await actor(context);
    const id = AdminIdSchema.parse(context.req.param("id"));
    const row = await database.db.collection(A.operations).findOne({
      _id: adminObjectId(id),
      status: "completed",
      expiresAt: { $gt: new Date() },
      kind: { $in: ["report.export", "customer.export"] },
    });
    if (!row?.objectKey || !storage || row.bucket !== storage.outputsBucket)
      return adminError(
        "admin_export_unavailable",
        "This export is missing or expired.",
        404,
      );
    await writeAdminAudit(
      database,
      owner,
      "report.download",
      id,
      { report: row.report ?? "customer-data" },
      undefined,
      "authorized",
    );
    const result = await storage.get({
      bucket: row.bucket,
      key: row.objectKey,
      maxBytes: 32 * 1024 * 1024,
    });
    context.header("Content-Type", row.contentType);
    context.header(
      "Content-Disposition",
      `attachment; filename="movprompt-${id}.${row.kind === "report.export" ? "csv" : "json"}"`,
    );
    return context.body(new Uint8Array(result.body).buffer);
  });
  // Specific routes above precede the shared read-only record browser.
  app.get(`${base}/:resource`, async (context) => {
    await actor(context);
    return context.json(
      await data.list(
        AdminResourceSchema.parse(context.req.param("resource")),
        AdminListQuerySchema.parse(context.req.query()),
      ),
    );
  });
  app.get(`${base}/:resource/:id`, async (context) =>
    context.json(
      await data.detail(
        AdminResourceSchema.parse(context.req.param("resource")),
        AdminIdSchema.parse(context.req.param("id")),
        await actor(context),
      ),
    ),
  );
  const assertSupportMutation = (request: Request, binary = false) => {
    const origin = request.headers.get("origin");
    const trusted = [
      environment.WEB_ORIGIN,
      ...(environment.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(","),
    ]
      .filter(Boolean)
      .map((value) => {
        try {
          return new URL(value!.trim()).origin;
        } catch {
          return "";
        }
      });
    if (origin && !trusted.includes(origin))
      return adminError(
        "support_origin_rejected",
        "This origin cannot change support cases.",
        403,
      );
    if (!origin && request.headers.get("sec-fetch-site") === "cross-site")
      return adminError(
        "support_origin_rejected",
        "An approved origin is required.",
        403,
      );
    if (
      binary
        ? !["image/png", "image/jpeg", "image/webp"].includes(
            request.headers.get("content-type") ?? "",
          )
        : !request.headers.get("content-type")?.startsWith("application/json")
    )
      return adminError("support_json_required", "Use a JSON request.", 400);
  };
  registerSupportAttachmentRoutes(app, {
    database,
    security,
    auth,
    ...(storage ? { storage } : {}),
    assertMutation: assertSupportMutation,
  });
  app.post("/api/v1/support/:id/replies", async (context) => {
    assertSupportMutation(context.req.raw);
    const current = await auth.getSession(context.req.raw.headers);
    if (!current || current.session.guest)
      return adminError(
        "authentication_required",
        "Sign in to reply to support.",
        401,
      );
    const input = SupportReplySchema.parse(await context.req.json());
    return context.json(
      await workspace.customerReply(
        {
          userId: current.user.id,
          sessionId: current.session.id,
          requestId: context.get("requestId"),
        },
        AdminIdSchema.parse(context.req.param("id")),
        key(context),
        input,
      ),
    );
  });
  app.get("/api/v1/support", async (context) => {
    const current = await auth.getSession(context.req.raw.headers);
    if (!current)
      return adminError(
        "authentication_required",
        "Sign in to view support cases.",
        401,
      );
    const items = await database.db
      .collection(A.cases)
      .find(
        { userId: adminObjectId(current.user.id) },
        {
          projection: {
            subject: 1,
            status: 1,
            category: 1,
            updatedAt: 1,
            revision: 1,
          },
        },
      )
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();
    context.header("Cache-Control", "private, no-store");
    return context.json({ items: adminJson(items) });
  });
  app.post("/api/v1/support", async (context) => {
    assertSupportMutation(context.req.raw);
    const current = await auth.getSession(context.req.raw.headers);
    if (!current)
      return adminError(
        "authentication_required",
        "Sign in to contact support.",
        401,
      );
    const input = AdminCaseSchema.omit({ userId: true })
      .strict()
      .parse(await context.req.json());
    const since = new Date(Date.now() - 3600000);
    const recent = await database.db.collection(A.cases).countDocuments({
      userId: adminObjectId(current.user.id),
      createdAt: { $gte: since },
    });
    if (recent >= 10)
      return adminError(
        "support_rate_limit",
        "Please wait before opening another case.",
        429,
      );
    return context.json(
      await workspace.createCase(
        {
          userId: current.user.id,
          sessionId: current.session.id,
          requestId: context.get("requestId"),
        },
        key(context),
        { ...input, userId: current.user.id },
        true,
      ),
    );
  });
  app.get("/api/v1/notifications", async (context) => {
    const current = await auth.getSession(context.req.raw.headers);
    if (!current)
      return adminError(
        "authentication_required",
        "Sign in to view notifications.",
        401,
      );
    const items = await database.db
      .collection("notifications")
      .find(
        { userId: adminObjectId(current.user.id) },
        {
          projection: {
            type: 1,
            title: 1,
            body: 1,
            caseId: 1,
            readAt: 1,
            createdAt: 1,
          },
        },
      )
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    context.header("Cache-Control", "private, no-store");
    return context.json({ items: adminJson(items) });
  });
  app.get("/api/v1/support/:id", async (context) => {
    const current = await auth.getSession(context.req.raw.headers);
    if (!current)
      return adminError(
        "authentication_required",
        "Sign in to view support cases.",
        401,
      );
    const id = adminObjectId(AdminIdSchema.parse(context.req.param("id")));
    const userId = adminObjectId(current.user.id);
    const record = await database.db
      .collection(A.cases)
      .findOne({ _id: id, userId });
    if (!record) return adminError("support_not_found", "Case not found.", 404);
    const messages = await database.db
      .collection(A.messages)
      .find(
        { caseId: id, userId, visibility: "customer" },
        {
          projection: { message: 1, attachments: 1, delivery: 1, createdAt: 1 },
        },
      )
      .sort({ createdAt: 1 })
      .limit(200)
      .toArray();
    return context.json(adminJson({ record, messages }));
  });
  app.get("/api/v1/communications/status", async (context) => {
    const current = await auth.getSession(context.req.raw.headers);
    const now = new Date();
    const audience = current
      ? ["all", ...(current.user.emailVerified ? ["verified"] : []), "active"]
      : ["all"];
    const rows = await database.db
      .collection(A.content)
      .find(
        {
          kind: { $in: ["announcement", "welcome", "maintenance"] },
          audience: { $in: audience },
          status: "published",
        },
        {
          projection: {
            title: 1,
            body: 1,
            kind: 1,
            revision: 1,
            publishedAt: 1,
          },
        },
      )
      .sort({ publishedAt: -1, _id: -1 })
      .limit(3)
      .toArray();
    const settings = await database.db
      .collection(A.settings)
      .findOne(
        { key: "operations" },
        { projection: { maintenanceMessage: 1, pauseGeneration: 1 } },
      );
    context.header("Cache-Control", "private, no-store");
    return context.json(
      adminJson({
        items: rows,
        maintenanceMessage: settings?.maintenanceMessage ?? { en: "", ar: "" },
        pauseGeneration: settings?.pauseGeneration === true,
        evaluatedAt: now,
      }),
    );
  });
  app.get("/api/v1/communications", async (context) => {
    const current = await auth.getSession(context.req.raw.headers);
    const now = new Date();
    const audience = current
      ? ["all", ...(current.user.emailVerified ? ["verified"] : []), "active"]
      : ["all"];
    const items = await database.db
      .collection(A.content)
      .find(
        {
          kind: {
            $in: ["announcement", "welcome", "maintenance", "notification"],
          },
          audience: { $in: audience },
          status: "published",
        },
        {
          projection: {
            title: 1,
            body: 1,
            kind: 1,
            publishedAt: 1,
            revision: 1,
          },
        },
      )
      .sort({ publishedAt: -1 })
      .limit(20)
      .toArray();
    context.header("Cache-Control", "private, no-store");
    return context.json({
      items: adminJson(items),
      evaluatedAt: now.toISOString(),
    });
  });
}
