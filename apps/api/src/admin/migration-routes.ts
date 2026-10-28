import { z } from "zod";
import { ObjectId } from "mongodb";
import type { Hono } from "hono";
import type { MongoDatabase } from "@movprompt/db";
import type { ApiEnvironment } from "../request-context.js";
import {
  ADMIN_COLLECTIONS as A,
  adminError,
  adminJson,
  adminObjectId,
  writeAdminAudit,
  type AdminSecurity,
} from "./security.js";

export function registerMigrationRoutes(
  app: Hono<ApiEnvironment>,
  database: MongoDatabase,
  security: AdminSecurity,
) {
  app.get("/api/v1/admin/migration/status", async (context) => {
    await security.requireOwner(
      context.req.raw.headers,
      context.get("requestId"),
    );
    const jobs = await database.db
      .collection(A.operations)
      .find({ kind: { $in: ["migration.scan", "migration.reconcile"] } })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();
    return context.json(
      adminJson({
        jobs,
        legacyCutoverVerified: false,
        legacySource:
          "Legacy deployment disablement requires independent release verification; local code is not deployment proof.",
      }),
    );
  });
  for (const mode of ["scan", "reconcile"] as const)
    app.post(`/api/v1/admin/migration/${mode}`, async (context) => {
      const actor = await security.requireOwner(
        context.req.raw.headers,
        context.get("requestId"),
        mode === "reconcile",
      );
      const schema =
        mode === "scan"
          ? z
              .object({
                afterId: z
                  .string()
                  .regex(/^[a-f\d]{24}$/i)
                  .optional(),
                reason: z.string().trim().min(8).max(1000),
              })
              .strict()
          : z
              .object({
                scanId: z.string().regex(/^[a-f\d]{24}$/i),
                fingerprint: z.string().regex(/^[a-f\d]{64}$/i),
                reason: z.string().trim().min(8).max(1000),
              })
              .strict();
      const body = schema.parse(await context.req.json());
      const result = await security.command(
        actor,
        z.string().min(8).max(200).parse(context.req.header("idempotency-key")),
        { mode, ...body },
        async (session) => {
          if (
            "scanId" in body &&
            !(await database.db.collection(A.operations).findOne(
              {
                _id: adminObjectId(body.scanId),
                kind: "migration.scan",
                status: "completed",
                fingerprint: body.fingerprint,
                expiresAt: { $gt: new Date() },
              },
              { session },
            ))
          )
            return adminError(
              "admin_migration_review_expired",
              "Run and review a fresh inventory before reconciling.",
            );
          const now = new Date(),
            _id = new ObjectId();
          await database.db.collection(A.operations).insertOne(
            {
              _id,
              kind: `migration.${mode}`,
              actorId: adminObjectId(actor.userId),
              ...("scanId" in body
                ? {
                    scanId: adminObjectId(body.scanId),
                    fingerprint: body.fingerprint,
                  }
                : body.afterId
                  ? { afterId: body.afterId }
                  : {}),
              status: "queued",
              attempts: 0,
              availableAt: now,
              createdAt: now,
              updatedAt: now,
            },
            { session },
          );
          await writeAdminAudit(
            database,
            actor,
            `migration.${mode}-request`,
            String(_id),
            body,
            session,
          );
          return { operationId: String(_id), status: "queued" };
        },
      );
      return context.json(result);
    });
}
