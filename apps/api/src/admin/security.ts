import { claimFactorUse } from "./factor-uses.js";
import { createHash } from "node:crypto";
import { ObjectId, type ClientSession, type Document } from "mongodb";
import type { MongoDatabase } from "@movprompt/db";
import type { AdminIdentity } from "@movprompt/contracts";
import type { AuthGateway } from "../auth-gateway.js";
import { ApiHttpError } from "../errors.js";

export const ADMIN_COLLECTIONS = {
  owners: "admin_owners",
  assurance: "admin_session_assurance",
  commands: "admin_commands",
  financial: "admin_financial_requests",
  allocations: "credit_purchase_allocations",
  refundHolds: "credit_refund_holds",
  cases: "support_cases",
  messages: "support_messages",
  moderation: "admin_moderation",
  content: "admin_content",
  contentVersions: "admin_content_versions",
  settings: "admin_settings",
  operations: "admin_operations",
  pricing: "admin_pricing_versions",
  templateDrafts: "admin_template_drafts",
} as const;
export const adminError = (
  code: string,
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 429 | 503 = 409,
): never => {
  throw new ApiHttpError({ code, message, status, retryable: status === 503 });
};
export function adminObjectId(value: string): ObjectId {
  if (!/^[a-f\d]{24}$/i.test(value))
    return adminError("admin_invalid_id", "Invalid record identifier.", 400);
  return new ObjectId(value);
}
export function adminJson(value: unknown): unknown {
  if (value instanceof ObjectId) return value.toHexString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(adminJson);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key === "_id" ? "id" : key,
        adminJson(item),
      ]),
    );
  return value;
}
export type AdminActor = {
  userId: string;
  sessionId: string;
  requestId: string;
};
export async function writeAdminAudit(
  database: MongoDatabase,
  actor: AdminActor,
  action: string,
  target: string,
  changes: Document,
  session?: ClientSession,
  outcome: "succeeded" | "authorized" = "succeeded",
) {
  await database.db.collection("audit_logs").insertOne(
    {
      actorId: adminObjectId(actor.userId),
      action,
      target,
      requestId: actor.requestId,
      outcome,
      changes,
      createdAt: new Date(),
    },
    session ? { session } : {},
  );
}
export async function ensureAdminIndexes(database: MongoDatabase) {
  const db = database.db;
  await Promise.all([
    db.collection("password_attempts").createIndex({ subject: 1 }, { unique: true }),
    db
      .collection("admin_system_checks")
      .createIndex({ key: 1 }, { unique: true }),
    db
      .collection("admin_system_alerts")
      .createIndex({ active: 1, updatedAt: -1 }),
    db
      .collection("admin_backup_evidence")
      .createIndex({ scope: 1, completedAt: -1 }),
    db
      .collection("admin_factor_uses")
      .createIndex({ userId: 1, fingerprint: 1 }, { unique: true }),
    db
      .collection("admin_factor_uses")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.db
      .collection("admin_pricing_heads")
      .createIndex({ key: 1 }, { unique: true }),
    database.db
      .collection("admin_pricing_drafts")
      .createIndex({ key: 1 }, { unique: true }),
    database.db
      .collection("admin_pricing_versions")
      .createIndex({ number: 1 }, { unique: true }),

    db
      .collection(ADMIN_COLLECTIONS.contentVersions)
      .createIndex({ contentId: 1, revision: 1 }, { unique: true }),
    db
      .collection("admin_owned_media_revisions")
      .createIndex({ mediaId: 1, revision: 1 }, { unique: true }),
    db
      .collection("admin_owned_media")
      .createIndex({ status: 1, updatedAt: -1 }),
    db
      .collection(ADMIN_COLLECTIONS.owners)
      .createIndex({ userId: 1 }, { unique: true }),
    db.collection("admin_bootstrap").createIndex({ key: 1 }, { unique: true }),
    db
      .collection(ADMIN_COLLECTIONS.settings)
      .createIndex({ key: 1 }, { unique: true }),
    db
      .collection(ADMIN_COLLECTIONS.templateDrafts)
      .createIndex({ templateId: 1 }, { unique: true }),
    db
      .collection("admin_template_draft_revisions")
      .createIndex({ templateId: 1, revision: 1 }, { unique: true }),
    db
      .collection(ADMIN_COLLECTIONS.assurance)
      .createIndex({ sessionId: 1 }, { unique: true }),
    db
      .collection(ADMIN_COLLECTIONS.assurance)
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db
      .collection(ADMIN_COLLECTIONS.commands)
      .createIndex({ actorId: 1, key: 1 }, { unique: true }),
    db
      .collection(ADMIN_COLLECTIONS.financial)
      .createIndex({ status: 1, createdAt: -1 }),
    db
      .collection(ADMIN_COLLECTIONS.cases)
      .createIndex({ userId: 1, updatedAt: -1 }),
    db
      .collection(ADMIN_COLLECTIONS.messages)
      .createIndex({ caseId: 1, createdAt: 1 }),
    db
      .collection(ADMIN_COLLECTIONS.allocations)
      .createIndex({ orderId: 1 }, { unique: true }),
    db
      .collection(ADMIN_COLLECTIONS.operations)
      .createIndex({ status: 1, availableAt: 1, leaseExpiresAt: 1 }),
    db
      .collection("authentication_events")
      .createIndex({ userId: 1, createdAt: -1 }),
    db.collection(ADMIN_COLLECTIONS.content).createIndex(
      { kind: 1, emailPurpose: 1 },
      {
        unique: true,
        partialFilterExpression: {
          kind: "transactional-email",
          status: "published",
        },
      },
    ),
    db
      .collection("email_preferences")
      .createIndex({ userId: 1 }, { unique: true }),
    db
      .collection("admin_retention_candidates")
      .createIndex({ status: 1, notBefore: 1 }),
    db
      .collection("admin_business_renders")
      .createIndex({ status: 1, createdAt: -1 }),
    db
      .collection("admin_operations")
      .createIndex(
        { kind: 1, businessRequestId: 1 },
        { unique: true, partialFilterExpression: { kind: "business.monitor" } },
      ),
    db.collection("admin_template_quality_evidence").createIndex(
      { businessRequestId: 1 },
      {
        unique: true,
        partialFilterExpression: { businessRequestId: { $exists: true } },
      },
    ),
    db.collection("admin_email_audiences").createIndex({ expiresAt: 1 }),
    db
      .collection("admin_email_campaigns")
      .createIndex({ audienceId: 1 }, { unique: true }),
    db
      .collection("admin_email_deliveries")
      .createIndex(
        { campaignId: 1, userId: 1 },
        { unique: true, partialFilterExpression: { kind: "promotional" } },
      ),
    db
      .collection("admin_email_deliveries")
      .createIndex({ contentId: 1, status: 1 }),
    db
      .collection("support_attachments")
      .createIndex({ caseId: 1, userId: 1, messageId: 1 }),
    db
      .collection("support_attachments")
      .createIndex({ uploaderId: 1, createdAt: -1 }),
    db.collection("audit_logs").createIndex({ createdAt: -1, _id: -1 }),
    db.collection("audit_logs").createIndex({ actorId: 1, createdAt: -1 }),
    // Owner list pages sort by { createdAt, _id } and filter by status-like fields.
    ...(
      [
        ["render_runs", { createdAt: -1, _id: -1 }],
        ["render_runs", { status: 1, createdAt: -1, _id: -1 }],
        ["render_runs", { projectId: 1, createdAt: -1, _id: -1 }],
        ["render_runs", { projectVersionId: 1, createdAt: -1, _id: -1 }],
        ["creator_project_versions", { templateVersionId: 1, _id: 1 }],
        ["users", { createdAt: -1, _id: -1 }],
        ["users", { suspendedAt: 1, createdAt: -1, _id: -1 }],
        ["creator_projects", { createdAt: -1, _id: -1 }],
        ["credit_ledger", { createdAt: -1, _id: -1 }],
        ["credit_ledger", { kind: 1, createdAt: -1, _id: -1 }],
        ["payment_orders", { createdAt: -1, _id: -1 }],
        ["payment_orders", { status: 1, createdAt: -1, _id: -1 }],
        ["payment_orders", { status: 1, currency: 1, creditedAt: -1 }],
        ["payment_events", { orderId: 1, createdAt: -1 }],
        ["sessions", { userId: 1, updatedAt: -1 }],
        ["sessions", { updatedAt: -1 }],
        ["twoFactor", { userId: 1 }],
        [ADMIN_COLLECTIONS.cases, { createdAt: -1, _id: -1 }],
        [ADMIN_COLLECTIONS.cases, { status: 1, createdAt: -1, _id: -1 }],
        [ADMIN_COLLECTIONS.financial, { userId: 1, createdAt: -1, _id: -1 }],
        [ADMIN_COLLECTIONS.financial, { kind: 1, status: 1, updatedAt: -1 }],
      ] as const
    ).map(([name, key]) => db.collection(name).createIndex(key)),
  ]);
}
export function createAdminSecurity(
  database: MongoDatabase,
  auth: AuthGateway,
  options: { readOnly?: boolean; routineManagement?: boolean; walletManagement?: boolean } = {},
) {
  const db = database.db;
  const unauthenticated = () =>
    adminError("authentication_required", "Sign in to continue.", 401);
  const accountProjection = {
    emailVerified: 1,
    twoFactorEnabled: 1,
    suspendedAt: 1,
    deletionRequestedAt: 1,
  };
  const assuranceRead = (sessionId: string, userId: ObjectId) =>
    db.collection(ADMIN_COLLECTIONS.assurance).findOne(
      { sessionId, userId },
      { projection: { expiresAt: 1, recentUntil: 1 } },
    );
  const factorRead = (userId: ObjectId) =>
    db.collection("twoFactor").findOne(
      { userId, verified: { $ne: false } },
      { projection: { backupCodes: 1 } },
    );
  /**
   * Resolves the session once and reads the owner, account and (when the caller
   * already knows it needs it) assurance rows together. Nothing here is cached:
   * revocation, suspension and step-up expiry are all read on every request.
   */
  async function session(headers: Headers, withAssurance = false) {
    // The real gateway's own users read is folded into the projected read below.
    const accountCheckedHere = Boolean(auth.getSessionWithoutAccountCheck);
    const current = await (accountCheckedHere
      ? auth.getSessionWithoutAccountCheck!(headers)
      : auth.getSession(headers));
    if (!current) return unauthenticated();
    const userId = adminObjectId(current.user.id);
    const [owner, user, assurance] = await Promise.all([
      db.collection(ADMIN_COLLECTIONS.owners).findOne(
        {
          userId,
          role: "owner",
          $or: [{ active: true }, { active: false, pendingVerification: true }],
        },
        { projection: { active: 1, pendingVerification: 1, loginMode: 1, authenticationPolicy: 1 } },
      ),
      db.collection("users").findOne({ _id: userId }, { projection: accountProjection }),
      withAssurance ? assuranceRead(current.session.id, userId) : null,
    ]);
    // Same outcome as AuthGateway.getSession: a suspended, deleting or missing
    // account has no session at all, which outranks any owner membership check.
    if (accountCheckedHere && (!user || user.suspendedAt || user.deletionRequestedAt))
      return unauthenticated();
    if (!owner || !user || user.suspendedAt || user.deletionRequestedAt)
      return adminError("owner_required", "Owner access is required.", 403);
    if (
      (!user.emailVerified &&
        owner.loginMode !== "designated-email-password") ||
      owner.pendingVerification ||
      !owner.active
    )
      return adminError(
        "owner_verification_required",
        "Verify the owner email before accessing admin.",
        403,
      );
    return { current, user, owner, userId, assurance };
  }
  async function identity(headers: Headers): Promise<AdminIdentity> {
    const { current, user, owner, userId, assurance } = await session(headers, true);
    const factor = await factorRead(userId);
    const now = new Date();
    return {
      userId: current.user.id,
      name: current.user.name,
      email: current.user.email,
      role: "owner",
      emailVerified: user.emailVerified === true,
      readOnly: options.readOnly === true,
      capabilities: {
        walletManagement: options.readOnly !== true || options.walletManagement === true,
        customerProfile: options.readOnly !== true || options.routineManagement === true,
        customerStatus: options.readOnly !== true || options.routineManagement === true,
        templateAvailability: options.readOnly !== true || options.routineManagement === true,
      },
      authenticationPolicy: owner.authenticationPolicy === "password" ? "password" : "mfa",
      mfaEnabled: user.twoFactorEnabled === true,
      recoveryReady: Boolean(factor?.backupCodes),
      assuredUntil:
        owner.authenticationPolicy === "password" ? new Date(current.session.expiresAt as string | Date).toISOString() : assurance && assurance.expiresAt > now
          ? assurance.expiresAt.toISOString()
          : null,
      recentUntil:
        assurance && assurance.recentUntil > now
          ? assurance.recentUntil.toISOString()
          : null,
    };
  }
  async function requireOwner(
    headers: Headers,
    requestId: string,
    recent = false,
  ): Promise<AdminActor> {
    const { current, user, owner, userId, assurance } = await session(headers, recent);
    const actor = { userId: current.user.id, sessionId: current.session.id, requestId };
    const stepUpRequired = () =>
      adminError(
        "owner_step_up_required",
        "Confirm your password to continue.",
        403,
      );
    const now = new Date();
    if (owner.authenticationPolicy === "password") {
      // A password-policy session is assured for its lifetime, so only a
      // recent-confirmation route needs the assurance row and none needs factors.
      if (recent && !(assurance && assurance.recentUntil > now)) return stepUpRequired();
      return actor;
    }
    const [factor, confirmed] = await Promise.all([
      factorRead(userId),
      recent ? assurance : assuranceRead(current.session.id, userId),
    ]);
    if (user.twoFactorEnabled !== true || !factor?.backupCodes)
      return adminError(
        "owner_mfa_setup_required",
        "Set up an authenticator and recovery codes first.",
        403,
      );
    if (
      !confirmed ||
      !(confirmed.expiresAt > now) ||
      (recent && !(confirmed.recentUntil > now))
    )
      return stepUpRequired();
    return actor;
  }
  async function assure(
    headers: Headers,
    code: string,
    requestId: string,
    mode: "totp" | "backup" = "totp",
  ) {
    const { current, user } = await session(headers);
    if (!user.twoFactorEnabled || !auth.verifyFactor)
      return adminError(
        "owner_mfa_setup_required",
        "Set up an authenticator first.",
        403,
      );
    const now = new Date();
    const userId = adminObjectId(current.user.id);
    // This limit also applies to verification on an already-authenticated session,
    // where Better Auth's login challenge lockout alone is insufficient.
    const limit = await db
      .collection("admin_factor_limits")
      .findOneAndUpdate(
        { _id: userId },
        { $inc: { attempts: 1 }, $setOnInsert: { windowStart: now } },
        { upsert: true, returnDocument: "after" },
      );
    if (
      limit &&
      now.getTime() - new Date(limit.windowStart).getTime() > 60000
    ) {
      await db
        .collection("admin_factor_limits")
        .updateOne(
          { _id: userId, windowStart: limit.windowStart },
          { $set: { attempts: 1, windowStart: now } },
        );
    } else if (Number(limit?.attempts) > 5)
      return adminError(
        "owner_factor_rate_limit",
        "Wait a minute before trying another code.",
        429,
      );
    let valid = false;
    try {
      valid = await auth.verifyFactor(headers, code, mode);
    } catch {
      valid = false;
    }
    if (!valid)
      return adminError(
        "owner_factor_invalid",
        "The authenticator code was not accepted.",
        403,
      );
    const reused = await claimFactorUse(database, current.user.id, mode, code);
    if (!reused)
      return adminError(
        "owner_factor_reused",
        "Wait for the next authenticator code.",
        403,
      );
    const expiresAt = new Date(now.getTime() + 8 * 3600000);
    const recentUntil = new Date(now.getTime() + 5 * 60000);
    await db
      .collection(ADMIN_COLLECTIONS.assurance)
      .updateOne(
        { sessionId: current.session.id },
        { $set: { userId, expiresAt, recentUntil, verifiedAt: now } },
        { upsert: true },
      );
    await writeAdminAudit(
      database,
      { userId: current.user.id, sessionId: current.session.id, requestId },
      "owner.factor-confirmed",
      current.user.id,
      {},
    );
    return identity(headers);
  }
  async function command<T>(
    actor: AdminActor,
    key: string,
    input: unknown,
    operation: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    if (key.length < 8 || key.length > 200)
      return adminError(
        "idempotency_key_required",
        "Use a valid operation key.",
        400,
      );
    const hash = createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
    const actorId = adminObjectId(actor.userId);
    try {
      return await database.transaction(async (session) => {
        const collection = db.collection(ADMIN_COLLECTIONS.commands);
        const actorId = adminObjectId(actor.userId);
        const previous = await collection.findOne(
          { actorId, key },
          { session },
        );
        if (previous) {
          if (previous.hash !== hash)
            return adminError(
              "admin_operation_conflict",
              "This operation key was used for a different action.",
            );
          return previous.result as T;
        }
        const result = await operation(session);
        await collection.insertOne(
          { actorId, key, hash, result, createdAt: new Date() },
          { session },
        );
        return result;
      });
    } catch (error) {
      if (Number((error as { code?: number }).code) !== 11000) throw error;
      const winner = await db
        .collection(ADMIN_COLLECTIONS.commands)
        .findOne({ actorId, key });
      if (!winner || winner.hash !== hash)
        return adminError(
          "admin_operation_conflict",
          "This operation key was used for a different action.",
        );
      return winner.result as T;
    }
  }
  async function confirmPassword(headers: Headers, password: string, requestId: string) {
    const { current, owner } = await session(headers);
    if (owner.authenticationPolicy !== "password" || !auth.verifyPassword || !(await auth.verifyPassword(headers, password)))
      return adminError("owner_password_invalid", "The password was not accepted.", 403);
    const now = new Date();
    const until = new Date(now.getTime() + 5 * 60000);
    await db.collection(ADMIN_COLLECTIONS.assurance).updateOne({ sessionId: current.session.id }, { $set: { userId: adminObjectId(current.user.id), expiresAt: until, recentUntil: until, verifiedAt: now, method: "password" } }, { upsert: true });
    await writeAdminAudit(database, { userId: current.user.id, sessionId: current.session.id, requestId }, "owner.password-confirmed", current.user.id, {});
    return identity(headers);
  }
  return { identity, requireOwner, assure, confirmPassword, command };
}
export type AdminSecurity = ReturnType<typeof createAdminSecurity>;
