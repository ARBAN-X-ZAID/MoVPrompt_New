import type { Hono } from "hono";
import { z } from "zod";
import type { MongoDatabase } from "@movprompt/db";
import type { ApiEnvironment } from "../request-context.js";
import { adminJson, adminObjectId, type AdminSecurity } from "./security.js";
import { kuwaitBudgetDay } from "./system-monitor.js";
import {
  createAdminBusinessRenderService,
  BusinessRenderInputSchema,
  BusinessRenderReviewSchema,
} from "./business-renders.js";
export function registerBusinessRenderRoutes(
  app: Hono<ApiEnvironment>,
  database: MongoDatabase,
  security: AdminSecurity,
  environment: Readonly<Record<string, string | undefined>>,
) {
  const service = createAdminBusinessRenderService(
    database,
    security,
    environment,
  );
  app.get("/api/v1/admin/business-renders/status", async (context) => {
    await security.requireOwner(
      context.req.raw.headers,
      context.get("requestId"),
    );
    const attempt = Number(environment.ADMIN_BUSINESS_MAX_ATTEMPT_COST_USD);
    const daily = Number(environment.ADMIN_BUSINESS_DAILY_BUDGET_USD);
    const day = kuwaitBudgetDay();
    const budget = await database.db
      .collection("admin_business_budget_days")
      .findOne({ _id: day as never });
    const reserved = Number(budget?.reservedMicrousd ?? 0);
    return context.json({
      enabled:
        environment.ADMIN_BUSINESS_RENDERS_ENABLED === "true" &&
        environment.ADMIN_BUSINESS_COST_ACCEPTANCE_VERIFIED === "true",
      currency: "USD",
      budgetDay: day,
      timezone: "Asia/Kuwait",
      reservedCeilingMicrousd: reserved,
      remainingCeilingMicrousd:
        Number.isFinite(daily) && daily > 0
          ? Math.max(0, Math.floor(daily * 1e6) - reserved)
          : null,
      source:
        "reviewed cost policy and atomic daily business budget reservations",
      evaluatedAt: new Date().toISOString(),
      perAttemptCeilingMicrousd:
        Number.isFinite(attempt) && attempt > 0
          ? Math.ceil(attempt * 1e6)
          : null,
      dailyCeilingMicrousd:
        Number.isFinite(daily) && daily > 0 ? Math.floor(daily * 1e6) : null,
      actualCostsConfirmed: false,
    });
  });
  app.get("/api/v1/admin/business-renders/sources", async (context) => {
    const actor = await security.requireOwner(
      context.req.raw.headers,
      context.get("requestId"),
    );
    const templateId = z
      .string()
      .regex(/^[a-f0-9]{24}$/i)
      .parse(context.req.query("templateId"));
    const head = await database.db
      .collection("video_templates")
      .findOne({ _id: adminObjectId(templateId) });
    const active = head
      ? await database.db.collection("video_template_versions").findOne({
          _id: adminObjectId(String(head.currentPublishedVersionId)),
        })
      : null;
    if (!active) return context.notFound();
    const family =
      active.recipe?.familyId ??
      active.recipe?.executableDefinition?.id ??
      head!.slug;
    const items = await database.db
      .collection("creator_project_versions")
      .aggregate([
        {
          $match: {
            userId: adminObjectId(actor.userId),
            mode: "template",
            businessRequestId: { $exists: false },
            "configuration.generation.creativeBrief.templateId": family,
          },
        },
        {
          $lookup: {
            from: "creator_projects",
            localField: "projectId",
            foreignField: "_id",
            as: "project",
          },
        },
        { $unwind: "$project" },
        { $match: { "project.deletedAt": null } },
        { $sort: { createdAt: -1 } },
        { $limit: 80 },
        { $project: { versionNumber: 1, "project.title": 1, createdAt: 1 } },
      ])
      .toArray();
    return context.json(
      adminJson({
        items: items.map((item) => ({
          ...item,
          name: `${item.project.title} · v${item.versionNumber}`,
        })),
      }),
    );
  });
  app.post("/api/v1/admin/business-renders", async (context) =>
    context.json(
      await service.request(
        await security.requireOwner(
          context.req.raw.headers,
          context.get("requestId"),
        ),
        z.string().min(8).max(200).parse(context.req.header("idempotency-key")),
        BusinessRenderInputSchema.parse(await context.req.json()),
      ),
    ),
  );
  app.post("/api/v1/admin/business-renders/:id/review", async (context) =>
    context.json(
      await service.review(
        await security.requireOwner(
          context.req.raw.headers,
          context.get("requestId"),
          true,
        ),
        context.req.param("id"),
        z.string().min(8).max(200).parse(context.req.header("idempotency-key")),
        BusinessRenderReviewSchema.parse(await context.req.json()),
      ),
    ),
  );
}
