import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { ObjectId, type Document, type ClientSession } from "mongodb";
import { z } from "zod";
import type { MongoDatabase } from "@movprompt/db";
import type { ApplicationEmailSender } from "../email.js";
import {
  ADMIN_COLLECTIONS as A,
  adminError,
  adminObjectId,
  adminJson,
  writeAdminAudit,
  type AdminActor,
  type AdminSecurity,
} from "./security.js";

export const EMAIL = {
  preferences: "email_preferences",
  audiences: "admin_email_audiences",
  campaigns: "admin_email_campaigns",
  deliveries: "admin_email_deliveries",
} as const;
export const EmailApprovalSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    audienceId: z.string().regex(/^[a-f0-9]{24}$/i),
    reason: z.string().trim().min(8).max(1000),
    scheduledAt: z.iso.datetime().optional(),
  })
  .strict();
const fingerprint = (recipients: Document[]) =>
  createHash("sha256").update(JSON.stringify(recipients)).digest("hex");
export function unsubscribeToken(userId: string, secret: string) {
  return `${userId}.${createHmac("sha256", secret).update(`movprompt-unsubscribe:v1:${userId}`).digest("hex")}`;
}
export function verifyUnsubscribeToken(value: string, secret: string) {
  if (!secret || !/^[a-f0-9]{24}\.[a-f0-9]{64}$/i.test(value)) return null;
  const [id, signature] = value.split(".");
  const expected = unsubscribeToken(id!, secret).split(".")[1]!;
  return timingSafeEqual(
    Buffer.from(signature!, "hex"),
    Buffer.from(expected, "hex"),
  )
    ? id!
    : null;
}
export function assertEmailEnabled(
  environment: Readonly<Record<string, string | undefined>>,
) {
  if (
    environment.ADMIN_EMAIL_ENABLED !== "true" ||
    !environment.SMTP_HOST ||
    !environment.EMAIL_FROM ||
    !environment.BETTER_AUTH_SECRET ||
    !environment.BETTER_AUTH_URL
  )
    return adminError(
      "admin_email_gate_closed",
      "Email delivery is not configured or enabled.",
      503,
    );
}

export async function queueEmail(
  database: MongoDatabase,
  input: Document,
  session: ClientSession,
) {
  const _id = new ObjectId();
  const now = new Date();
  await database.db
    .collection(EMAIL.deliveries)
    .insertOne(
      { _id, ...input, status: "queued", createdAt: now, updatedAt: now },
      { session },
    );
  await database.db.collection(A.operations).insertOne(
    {
      kind: "email.send",
      deliveryId: _id,
      actorId: input.actorId,
      status: "queued",
      attempts: 0,
      availableAt: input.availableAt ?? now,
      createdAt: now,
      updatedAt: now,
    },
    { session },
  );
  return _id;
}

export function createAdminEmailService(
  database: MongoDatabase,
  security: AdminSecurity,
  environment: Readonly<Record<string, string | undefined>>,
) {
  const db = database.db;
  async function audience(audience: string) {
    const pipeline: Document[] = [
      { $match: { marketingOptIn: true, suppressedAt: null } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "account",
        },
      },
      { $unwind: "$account" },
      {
        $match: {
          "account.emailVerified": true,
          "account.email": { $type: "string" },
          "account.suspendedAt": null,
          "account.deletionRequestedAt": null,
        },
      },
    ];
    if (audience === "active")
      pipeline.push(
        {
          $lookup: {
            from: "sessions",
            let: { id: "$userId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$userId", "$$id"] },
                      { $gt: ["$expiresAt", new Date()] },
                    ],
                  },
                },
              },
              { $limit: 1 },
            ],
            as: "activeSessions",
          },
        },
        { $match: { "activeSessions.0": { $exists: true } } },
      );
    pipeline.push(
      { $sort: { userId: 1 } },
      { $limit: 1001 },
      {
        $project: {
          userId: 1,
          revision: 1,
          "account.email": 1,
          "account.locale": 1,
        },
      },
    );
    const rows = await db
      .collection(EMAIL.preferences)
      .aggregate(pipeline, { maxTimeMS: 10000 })
      .toArray();
    if (rows.length > 1000)
      return adminError(
        "email_audience_too_large",
        "Narrow this audience to at most 1,000 opted-in accounts per reviewed campaign.",
      );
    return rows.map((row) => ({
      userId: row.userId,
      email: row.account.email,
      locale: row.account.locale === "ar" ? "ar" : "en",
      preferenceRevision: row.revision,
    }));
  }
  async function preview(actor: AdminActor, id: string, key: string) {
    const content = await db
      .collection(A.content)
      .findOne({ _id: adminObjectId(id), kind: "promotional-email" });
    if (!content)
      return adminError(
        "email_content_not_found",
        "Save a promotional email draft first.",
        404,
      );
    const recipients = await audience(content.audience);
    return security.command(
      actor,
      key,
      { contentId: id, revision: content.revision },
      async (session) => {
        const _id = new ObjectId();
        const now = new Date();
        await db.collection(EMAIL.audiences).insertOne(
          {
            _id,
            contentId: content._id,
            contentRevision: content.revision,
            recipients,
            fingerprint: fingerprint(recipients),
            createdBy: adminObjectId(actor.userId),
            createdAt: now,
            expiresAt: new Date(now.getTime() + 15 * 60000),
            approvedAt: null,
          },
          { session },
        );
        await writeAdminAudit(
          database,
          actor,
          "email.audience-review",
          id,
          { audienceId: _id, count: recipients.length },
          session,
        );
        return {
          id: String(_id),
          contentRevision: content.revision,
          count: recipients.length,
          source:
            "verified accounts with explicit marketing consent; suppression and account status applied",
          expiresAt: new Date(now.getTime() + 15 * 60000).toISOString(),
          title: content.title,
          body: content.body,
          footer: {
            en: "An unsubscribe link is appended.",
            ar: "يضاف رابط إلغاء الاشتراك.",
          },
        };
      },
    );
  }
  async function approve(
    actor: AdminActor,
    id: string,
    key: string,
    input: z.infer<typeof EmailApprovalSchema>,
  ) {
    assertEmailEnabled(environment);
    const selected = await db.collection(EMAIL.audiences).findOne({
      _id: adminObjectId(input.audienceId),
      contentId: adminObjectId(id),
    });
    const current = await db
      .collection(A.content)
      .findOne({ _id: adminObjectId(id), kind: "promotional-email" });
    if (!selected || !current)
      return adminError("email_audience_changed", "Review the audience again.");
    const fresh = await audience(current.audience);
    if (fingerprint(fresh) !== selected.fingerprint)
      return adminError(
        "email_audience_changed",
        "Consent or audience membership changed. Review the updated audience.",
      );
    return security.command(actor, key, { id, ...input }, async (session) => {
      const content = await db.collection(A.content).findOne(
        {
          _id: adminObjectId(id),
          revision: input.expectedRevision,
          kind: "promotional-email",
          status: { $ne: "archived" },
        },
        { session },
      );
      const snapshot = await db.collection(EMAIL.audiences).findOne(
        {
          _id: selected._id,
          contentId: adminObjectId(id),
          contentRevision: input.expectedRevision,
          createdBy: adminObjectId(actor.userId),
          approvedAt: null,
          expiresAt: { $gt: new Date() },
        },
        { session },
      );
      if (!content || !snapshot)
        return adminError(
          "email_audience_changed",
          "Reload this content and review its audience again.",
        );
      const now = new Date();
      const scheduled = input.scheduledAt ? new Date(input.scheduledAt) : now;
      if (
        scheduled < new Date(now.getTime() - 1000) ||
        scheduled > new Date(now.getTime() + 90 * 86400000)
      )
        return adminError(
          "email_schedule_invalid",
          "Choose a time within the next 90 days.",
          400,
        );
      for (const locale of ["en", "ar"])
        if (
          !String(content.body[locale]).trim() ||
          /[\r\n]/.test(content.title[locale]) ||
          /{{/.test(content.body[locale])
        )
          return adminError(
            "email_content_invalid",
            "Promotional email requires plain text in both languages without template tokens.",
            400,
          );
      const campaignId = new ObjectId();
      const revision = Number(content.revision) + 1;
      const publication = {
        ...content,
        status: "published",
        revision,
        publishedAt: now,
        updatedAt: now,
      };
      await db
        .collection(A.content)
        .replaceOne(
          { _id: content._id, revision: content.revision },
          publication,
          { session },
        );
      await db.collection(A.contentVersions).insertOne(
        {
          contentId: content._id,
          definition: publication,
          revision,
          createdAt: now,
        },
        { session },
      );
      await db
        .collection(EMAIL.audiences)
        .updateOne(
          { _id: snapshot._id },
          { $set: { approvedAt: now } },
          { session },
        );
      await db.collection(EMAIL.campaigns).insertOne(
        {
          _id: campaignId,
          contentId: content._id,
          contentRevision: revision,
          audienceId: snapshot._id,
          recipientCount: snapshot.recipients.length,
          status:
            snapshot.recipients.length === 0
              ? "completed"
              : input.scheduledAt
                ? "scheduled"
                : "queued",
          approvedBy: adminObjectId(actor.userId),
          reason: input.reason,
          createdAt: now,
          availableAt: scheduled,
        },
        { session },
      );
      for (const recipient of snapshot.recipients)
        await queueEmail(
          database,
          {
            ...recipient,
            kind: "promotional",
            campaignId,
            contentId: content._id,
            contentRevision: revision,
            title: content.title,
            body: content.body,
            actorId: adminObjectId(actor.userId),
            availableAt: scheduled,
          },
          session,
        );
      await writeAdminAudit(
        database,
        actor,
        "email.broadcast-approved",
        id,
        {
          campaignId,
          contentRevision: revision,
          count: snapshot.recipients.length,
          audienceId: snapshot._id,
          reason: input.reason,
          availableAt: scheduled,
        },
        session,
      );
      return {
        id: String(campaignId),
        count: snapshot.recipients.length,
        status:
          snapshot.recipients.length === 0
            ? "completed"
            : input.scheduledAt
              ? "scheduled"
              : "queued",
      };
    });
  }
  async function test(
    actor: AdminActor,
    id: string,
    key: string,
    locale: "en" | "ar",
  ) {
    assertEmailEnabled(environment);
    return security.command(
      actor,
      key,
      { id, test: true, locale },
      async (session) => {
        const owner = await db
          .collection("users")
          .findOne(
            { _id: adminObjectId(actor.userId), emailVerified: true },
            { session },
          );
        const content = await db.collection(A.content).findOne(
          {
            _id: adminObjectId(id),
            kind: { $in: ["promotional-email", "transactional-email"] },
          },
          { session },
        );
        if (!owner || !content)
          return adminError(
            "email_test_unavailable",
            "Save an email draft and verify the owner account first.",
          );
        const body = String(content.body[locale])
          .replace(/{{\s*name\s*}}/g, owner.name ?? "Owner")
          .replace(
            /{{\s*actionUrl\s*}}/g,
            `${environment.WEB_ORIGIN ?? ""}/auth`,
          );
        const deliveryId = await queueEmail(
          database,
          {
            userId: owner._id,
            email: owner.email,
            locale,
            kind: "test",
            title: content.title,
            body: { en: body, ar: body },
            contentId: content._id,
            contentRevision: content.revision,
            actorId: owner._id,
          },
          session,
        );
        await writeAdminAudit(
          database,
          actor,
          "email.owner-test",
          id,
          { deliveryId, locale },
          session,
        );
        return {
          id: String(deliveryId),
          status: "queued",
          recipient: "verified owner only",
        };
      },
    );
  }
  return { preview, approve, test };
}

async function refreshCampaign(database: MongoDatabase, row: Document) {
  if (!row.campaignId) return;
  const states = await database.db
    .collection(EMAIL.deliveries)
    .aggregate([
      { $match: { campaignId: row.campaignId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ])
    .toArray();
  const counts = Object.fromEntries(
    states.map((item) => [item._id, item.count]),
  );
  await database.db.collection(EMAIL.campaigns).updateOne(
    { _id: row.campaignId },
    {
      $set: {
        counts,
        status:
          counts.queued || counts.submitting
            ? "running"
            : counts.uncertain
              ? "review-required"
              : "completed",
        updatedAt: new Date(),
      },
    },
  );
}

/** SMTP has no exactly-once send guarantee. Persist submission intent first;
 * an interrupted/unknown send becomes uncertain and is never blindly resent. */
export async function executeEmailDelivery(
  database: MongoDatabase,
  deliveryId: ObjectId,
  environment: Readonly<Record<string, string | undefined>>,
  send?: ApplicationEmailSender,
) {
  const db = database.db;
  const deliveries = db.collection(EMAIL.deliveries);
  let row = await deliveries.findOne({ _id: deliveryId });
  if (!row) throw new Error("admin_email_delivery_missing");
  if (
    ["smtp-accepted", "suppressed", "failed", "uncertain"].includes(row.status)
  ) {
    if (row.messageId)
      await db
        .collection(A.messages)
        .updateOne(
          { _id: row.messageId, userId: row.userId },
          { $set: { emailStatus: row.status } },
        );
    await refreshCampaign(database, row);
    return { delivery: row.status, delivered: null };
  }
  if (row.status === "submitting") {
    await deliveries.updateOne(
      { _id: deliveryId, status: "submitting" },
      { $set: { status: "uncertain", updatedAt: new Date() } },
    );
    if (row.messageId)
      await db
        .collection(A.messages)
        .updateOne(
          { _id: row.messageId, userId: row.userId },
          { $set: { emailStatus: "uncertain" } },
        );
    await refreshCampaign(database, row);
    return { delivery: "uncertain", delivered: null };
  }
  assertEmailEnabled(environment);
  if (!send) throw new Error("admin_email_delivery_unavailable");
  let apiOrigin: string;
  try {
    const url = new URL(environment.BETTER_AUTH_URL!);
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
    )
      throw new Error();
    apiOrigin = url.origin;
  } catch {
    throw new Error("admin_email_gate_closed");
  }
  const user = await db.collection("users").findOne({
    _id: row.userId,
    email: row.email,
    emailVerified: true,
    suspendedAt: null,
    deletionRequestedAt: null,
  });
  let allowed = Boolean(user);
  let reason = "account-changed";
  if (row.kind === "promotional") {
    const preference = await db.collection(EMAIL.preferences).findOne({
      userId: row.userId,
      marketingOptIn: true,
      suppressedAt: null,
      revision: row.preferenceRevision,
    });
    const content = await db.collection(A.content).findOne({
      _id: row.contentId,
      revision: row.contentRevision,
      status: { $in: ["scheduled", "published"] },
    });
    allowed = allowed && Boolean(preference && content);
    reason = "consent-or-publication-changed";
  }
  if (!allowed) {
    await deliveries.updateOne(
      { _id: deliveryId, status: "queued" },
      {
        $set: {
          status: "suppressed",
          suppressionReason: reason,
          updatedAt: new Date(),
        },
      },
    );
    if (row.messageId)
      await db
        .collection(A.messages)
        .updateOne(
          { _id: row.messageId, userId: row.userId },
          { $set: { emailStatus: "suppressed" } },
        );
    await refreshCampaign(database, row);
    return { delivery: "suppressed", delivered: null };
  }
  row = await deliveries.findOneAndUpdate(
    { _id: deliveryId, status: "queued" },
    {
      $set: {
        status: "submitting",
        submissionStartedAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );
  if (!row) return { delivery: "already-claimed", delivered: null };
  const locale = row.locale === "ar" ? "ar" : "en";
  const text = String(row.body[locale]);
  let status = "smtp-accepted";
  const secret = environment.BETTER_AUTH_SECRET;
  if (row.kind === "promotional" && !secret) {
    await deliveries.updateOne(
      { _id: deliveryId, status: "submitting" },
      {
        $set: {
          status: "failed",
          failureCode: "unsubscribe_signing_unavailable",
        },
      },
    );
    throw new Error("admin_email_gate_closed");
  }
  const unsubscribeUrl =
    row.kind === "promotional"
      ? `${apiOrigin}/api/v1/email/unsubscribe?token=${unsubscribeToken(String(row.userId), secret!)}`
      : undefined;
  try {
    await send({
      to: row.email,
      subject: row.title[locale],
      text: unsubscribeUrl
        ? `${text}\n\n${locale === "ar" ? "إلغاء الاشتراك" : "Unsubscribe"}: ${unsubscribeUrl}`
        : text,
      messageId: `<${deliveryId}@movprompt.local>`,
      ...(unsubscribeUrl ? { unsubscribeUrl } : {}),
    });
  } catch {
    status = "uncertain";
  }
  const saved = await deliveries.updateOne(
    { _id: deliveryId, status: "submitting" },
    {
      $set: {
        status,
        updatedAt: new Date(),
        ...(status === "smtp-accepted"
          ? { smtpAcceptedAt: new Date() }
          : { failureCode: "smtp_outcome_uncertain" }),
      },
    },
  );
  if (!saved.matchedCount) status = "uncertain";
  if (row.messageId)
    await db
      .collection(A.messages)
      .updateOne(
        { _id: row.messageId, userId: row.userId },
        { $set: { emailStatus: status } },
      );
  await writeAdminAudit(
    database,
    {
      userId: String(row.actorId),
      sessionId: "worker",
      requestId: `email:${deliveryId}`,
    },
    "email.delivery-outcome",
    String(deliveryId),
    { status, delivered: null, kind: row.kind },
  );
  await refreshCampaign(database, row);
  return { delivery: status, delivered: null };
}
