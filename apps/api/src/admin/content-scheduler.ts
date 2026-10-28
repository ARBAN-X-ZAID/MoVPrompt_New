import {
  retirePriorTransactionalEmails,
  validateTransactionalEmail,
} from "./transactional-email.js";
import { type Document } from "mongodb";
import type { MongoDatabase } from "@movprompt/db";
import { ADMIN_COLLECTIONS as A, writeAdminAudit } from "./security.js";

/** A scheduled revision is published only if it is still the owner's approved
 * revision. Editing or archiving it makes older jobs harmless on retry. */
export async function executeScheduledContent(
  database: MongoDatabase,
  row: Document,
  now = new Date(),
  environment: Readonly<Record<string, string | undefined>> = {},
) {
  return database.transaction(async (session) => {
    const collection = database.db.collection(A.content);
    const current = await collection.findOne(
      {
        _id: row.contentId,
        revision: row.contentRevision,
        status: "scheduled",
        kind: {
          $in: [
            "announcement",
            "welcome",
            "maintenance",
            "notification",
            "transactional-email",
          ],
        },
        scheduledAt: { $lte: now.toISOString() },
      },
      { session },
    );
    if (!current) return { publication: "superseded-or-cancelled" };
    if (current.kind === "transactional-email") {
      if (environment.ADMIN_EMAIL_ENABLED !== "true")
        throw new Error("admin_email_gate_closed");
      validateTransactionalEmail(current);
      await retirePriorTransactionalEmails(
        database,
        current._id,
        current.emailPurpose,
        session,
        now,
      );
    }
    const revision = Number(current.revision) + 1;
    const next = {
      ...current,
      status: "published",
      revision,
      publishedAt: now,
      updatedAt: now,
    };
    await collection.replaceOne(
      { _id: current._id, revision: current.revision },
      next,
      { session },
    );
    await database.db
      .collection(A.contentVersions)
      .insertOne(
        { contentId: current._id, definition: next, revision, createdAt: now },
        { session },
      );
    await writeAdminAudit(
      database,
      {
        userId: String(row.actorId),
        sessionId: "worker",
        requestId: row.requestId ?? `content-schedule:${String(row._id)}`,
      },
      "content.scheduled-publication",
      String(current._id),
      { revision, approvedRevision: row.contentRevision, operationId: row._id },
      session,
    );
    return {
      publication: "published",
      contentId: String(current._id),
      revision,
    };
  });
}

export async function contentAudienceCount(
  database: MongoDatabase,
  audience: "all" | "verified" | "active",
) {
  const filter: Document = { suspendedAt: null, deletionRequestedAt: null };
  if (audience === "verified") filter.emailVerified = true;
  if (audience === "active") {
    const result = await database.db
      .collection("sessions")
      .aggregate(
        [
          { $match: { expiresAt: { $gt: new Date() } } },
          { $group: { _id: "$userId" } },
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "_id",
              as: "account",
            },
          },
          { $unwind: "$account" },
          {
            $match: {
              "account.suspendedAt": null,
              "account.deletionRequestedAt": null,
            },
          },
          { $count: "count" },
        ],
        { maxTimeMS: 10000 },
      )
      .toArray();
    return {
      accounts: Number(result[0]?.count ?? 0),
      guestReach: null,
      source: "users / unexpired sessions",
      evaluatedAt: new Date().toISOString(),
    };
  }
  return {
    accounts: await database.db
      .collection("users")
      .countDocuments(filter, { maxTimeMS: 10000 }),
    guestReach: null,
    source: "users",
    evaluatedAt: new Date().toISOString(),
  };
}
