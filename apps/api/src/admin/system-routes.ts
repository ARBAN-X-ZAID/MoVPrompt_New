import { z } from "zod";
import type { Hono } from "hono";
import type { MongoDatabase } from "@movprompt/db";
import type { ApiEnvironment } from "../request-context.js";
import { backupPolicy, SYSTEM } from "./system-monitor.js";
import {
  adminJson,
  adminObjectId,
  adminError,
  writeAdminAudit,
  type AdminSecurity,
} from "./security.js";

export function registerSystemRoutes(
  app: Hono<ApiEnvironment>,
  database: MongoDatabase,
  security: AdminSecurity,
  env: Readonly<Record<string, string | undefined>>,
) {
  app.get("/api/v1/admin/system/status", async (context) => {
    await security.requireOwner(
      context.req.raw.headers,
      context.get("requestId"),
    );
    const [checks, alerts, lastLocalDrill] = await Promise.all([
      database.db
        .collection(SYSTEM.checks)
        .find({})
        .sort({ key: 1 })
        .limit(20)
        .toArray(),
      database.db
        .collection(SYSTEM.alerts)
        .find({})
        .sort({ active: -1, updatedAt: -1 })
        .limit(30)
        .toArray(),
      database.db.collection(SYSTEM.backups).findOne(
        { scope: "isolated-local-drill" },
        {
          sort: { completedAt: -1 },
          projection: {
            scope: 1,
            completedAt: 1,
            restoreDurationMs: 1,
            databaseVerified: 1,
            mediaVerified: 1,
            economicsVerified: 1,
          },
        },
      ),
    ]);
    const now = new Date();
    const currentChecks = checks.map((check) => ({
      ...check,
      stale:
        !(check.evaluatedAt instanceof Date) ||
        now.getTime() - check.evaluatedAt.getTime() > 120000,
      state:
        check.evaluatedAt instanceof Date &&
        now.getTime() - check.evaluatedAt.getTime() <= 120000
          ? check.state
          : "unavailable",
    }));
    return context.json(
      adminJson({
        checks: currentChecks,
        alerts,
        backupPolicy: backupPolicy(env),
        lastLocalDrill,
        evaluatedAt: new Date(),
        refreshAfterSeconds: 60,
        source:
          "canonical database records / worker monitor / protected backup evidence",
        credentials: "server configuration only",
      }),
    );
  });
  app.post("/api/v1/admin/system/alerts/:id/review", async (context) => {
    const actor = await security.requireOwner(
      context.req.raw.headers,
      context.get("requestId"),
    );
    const _id = adminObjectId(context.req.param("id"));
    const input = z
      .object({
        expectedRevision: z.number().int().positive(),
        reason: z.string().trim().min(8).max(1000),
      })
      .strict()
      .parse(await context.req.json());
    const result = await security.command(
      actor,
      z.string().min(8).max(200).parse(context.req.header("idempotency-key")),
      { id: String(_id), ...input },
      async (session) => {
        const row = await database.db
          .collection(SYSTEM.alerts)
          .findOneAndUpdate(
            { _id, revision: input.expectedRevision, active: true },
            {
              $set: {
                reviewedAt: new Date(),
                reviewedBy: adminObjectId(actor.userId),
                reviewReason: input.reason,
              },
              $inc: { revision: 1 },
            },
            { session, returnDocument: "after" },
          );
        if (!row)
          return adminError(
            "admin_revision_changed",
            "Refresh the alert before reviewing it.",
          );
        await writeAdminAudit(
          database,
          actor,
          "system.alert-review",
          String(_id),
          { reason: input.reason, fingerprint: row.fingerprint },
          session,
        );
        return { id: String(_id), reviewed: true, active: true };
      },
    );
    return context.json(result);
  });
}
