import type { MongoDatabase } from "@movprompt/db";
import { adminObjectId } from "./security.js";

/** Protected deployment operation, deliberately never callable by registration. */
export async function migrateOwnerPasswordPolicy(
  database: MongoDatabase,
  userId: string,
) {
  return database.transaction(async (session) => {
    const id = adminObjectId(userId);
    const owner = await database.db
      .collection("admin_owners")
      .findOne({ userId: id, role: "owner", active: true }, { session });
    if (!owner) throw new Error("active_designated_owner_required");
    if (owner.authenticationPolicy === "password") return { changed: false };
    const account = await database.db
      .collection("accounts")
      .findOne(
        { userId: id, providerId: "credential", password: { $type: "string" } },
        { session },
      );
    if (!account) throw new Error("owner_password_account_required");
    const user = await database.db
      .collection("users")
      .findOne({ _id: id }, { session });
    await database.db
      .collection("admin_owners")
      .updateOne(
        { _id: owner._id },
        {
          $set: {
            authenticationPolicy: "password",
            passwordPolicyMigration: {
              previousPolicy: owner.authenticationPolicy ?? "mfa",
              previousTwoFactorEnabled: Boolean(user?.twoFactorEnabled),
            },
            updatedAt: new Date(),
          },
        },
        { session },
      );
    await database.db
      .collection("users")
      .updateOne(
        { _id: id },
        { $set: { twoFactorEnabled: false, updatedAt: new Date() } },
        { session },
      );
    await database.db
      .collection("sessions")
      .deleteMany({ userId: id }, { session });
    await database.db
      .collection("admin_session_assurance")
      .deleteMany({ userId: id }, { session });
    await database.db
      .collection("audit_logs")
      .insertOne(
        {
          actorId: id,
          action: "owner.password-policy-migration",
          target: userId,
          outcome: "succeeded",
          requestId: "protected-owner-password-migration",
          changes: { authenticationPolicy: "password", sessionsRevoked: true },
          createdAt: new Date(),
        },
        { session },
      );
    return { changed: true };
  });
}

export async function restoreOwnerAuthenticationPolicy(
  database: MongoDatabase,
  userId: string,
) {
  return database.transaction(async (session) => {
    const id = adminObjectId(userId);
    const owner = await database.db
      .collection("admin_owners")
      .findOne(
        {
          userId: id,
          role: "owner",
          active: true,
          authenticationPolicy: "password",
        },
        { session },
      );
    if (!owner?.passwordPolicyMigration)
      throw new Error("owner_policy_migration_not_found");
    const previous = owner.passwordPolicyMigration;
    await database.db
      .collection("admin_owners")
      .updateOne(
        { _id: owner._id },
        {
          $set: {
            authenticationPolicy: previous.previousPolicy,
            updatedAt: new Date(),
          },
          $unset: { passwordPolicyMigration: "" },
        },
        { session },
      );
    await database.db
      .collection("users")
      .updateOne(
        { _id: id },
        {
          $set: {
            twoFactorEnabled: previous.previousTwoFactorEnabled,
            updatedAt: new Date(),
          },
        },
        { session },
      );
    await database.db
      .collection("sessions")
      .deleteMany({ userId: id }, { session });
    await database.db
      .collection("admin_session_assurance")
      .deleteMany({ userId: id }, { session });
    await database.db
      .collection("audit_logs")
      .insertOne(
        {
          actorId: id,
          action: "owner.authentication-policy-restored",
          target: userId,
          outcome: "succeeded",
          requestId: "protected-owner-policy-rollback",
          changes: { policy: previous.previousPolicy },
          createdAt: new Date(),
        },
        { session },
      );
    return { restored: true };
  });
}
