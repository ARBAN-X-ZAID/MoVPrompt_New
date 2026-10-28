import { ObjectId } from "mongodb";
import { z } from "zod";
import type { Hono } from "hono";
import type { MongoDatabase } from "@movprompt/db";
import type { ApiEnvironment } from "../request-context.js";
import { retentionPolicy, RETENTION_CANDIDATES } from "./media-retention.js";
import { erasurePolicyHash } from "./account-erasure.js";
import {
  ADMIN_COLLECTIONS as A,
  adminJson,
  adminObjectId,
  writeAdminAudit,
  type AdminSecurity,
} from "./security.js";
export function registerRetentionRoutes(
  app: Hono<ApiEnvironment>,
  database: MongoDatabase,
  security: AdminSecurity,
  environment: Readonly<Record<string, string | undefined>>,
) {
  app.get("/api/v1/admin/retention", async (context) => {
    await security.requireOwner(
      context.req.raw.headers,
      context.get("requestId"),
    );
    const [counts, last] = await Promise.all([
      database.db
        .collection(RETENTION_CANDIDATES)
        .aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
        .toArray(),
      database.db
        .collection(A.operations)
        .find(
          {
            kind: {
              $in: ["media.inventory", "media.cleanup", "privacy.erase"],
            },
          },
          {
            projection: {
              kind: 1,
              status: 1,
              discovered: 1,
              purged: 1,
              retained: 1,
              scanned: 1,
              failureCode: 1,
              createdAt: 1,
              updatedAt: 1,
            },
          },
        )
        .sort({ createdAt: -1 })
        .limit(15)
        .toArray(),
    ]);
    return context.json(
      adminJson({
        policy: retentionPolicy(environment),
        counts,
        last,
        evaluatedAt: new Date(),
        source:
          "reviewed deployment policy / canonical retention candidates and operation outcomes",
      }),
    );
  });
  app.post("/api/v1/admin/retention/scan", async (context) => {
    const actor = await security.requireOwner(
      context.req.raw.headers,
      context.get("requestId"),
      true,
    );
    const input = z
      .object({ reason: z.string().trim().min(8).max(1000) })
      .strict()
      .parse(await context.req.json());
    const result = await security.command(
      actor,
      z.string().min(8).max(200).parse(context.req.header("idempotency-key")),
      input,
      async (session) => {
        const _id = new ObjectId();
        const now = new Date();
        await database.db.collection(A.operations).insertOne(
          {
            _id,
            kind: "media.inventory",
            actorId: adminObjectId(actor.userId),
            policyHash: erasurePolicyHash(environment),
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
          "retention.inventory-request",
          String(_id),
          { reason: input.reason, policy: retentionPolicy(environment) },
          session,
        );
        return {
          id: String(_id),
          status: "queued",
          cleanupEnabled: retentionPolicy(environment).enabled,
        };
      },
    );
    return context.json(result);
  });
}
