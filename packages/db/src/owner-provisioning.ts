import { ObjectId, type ClientSession } from "mongodb";
import type { MongoDatabase } from "./mongo-client.js";

/** Only protected deployment code creates this intent. Public auth can activate
 * an existing intent after verified email, but cannot nominate an owner. */
export async function designateOwnerAccount(
  database: MongoDatabase,
  userId: string,
) {
  return database.transaction(async (session) => {
    const id = new ObjectId(userId);
    await database.db
      .collection("admin_bootstrap")
      .updateOne(
        { key: "owner" },
        { $inc: { revision: 1 } },
        { session, upsert: true },
      );
    const user = await database.db
      .collection("users")
      .findOne({ _id: id }, { session });
    if (!user || user.suspendedAt || user.deletionRequestedAt)
      throw new Error("owner_account_unavailable");
    const existing = await database.db
      .collection("admin_owners")
      .findOne({ role: "owner" }, { session });
    if (existing && !existing.userId.equals(id))
      throw new Error("another_owner_is_already_designated");
    const active = user.emailVerified === true;
    await database.db.collection("admin_owners").updateOne(
      { userId: id },
      {
        $setOnInsert: {
          userId: id,
          role: "owner",
          source: "protected-deployment",
          createdAt: new Date(),
        },
        $set: { active, pendingVerification: !active, updatedAt: new Date() },
      },
      { upsert: true, session },
    );
    await database.db.collection("audit_logs").insertOne(
      {
        actorId: id,
        action: "owner.designated",
        target: userId,
        outcome: active ? "pending-mfa" : "pending-email-verification",
        requestId: "protected-owner-provisioning",
        changes: { source: "protected-deployment" },
        createdAt: new Date(),
      },
      { session },
    );
    return {
      userId,
      state: active ? "pending-mfa" : "pending-email-verification",
    };
  });
}

export async function activateVerifiedOwnerIntent(
  database: MongoDatabase,
  userId: string,
) {
  const id = new ObjectId(userId);
  if (
    !(await database.db.collection("admin_owners").findOne({
      userId: id,
      role: "owner",
      pendingVerification: true,
      active: false,
    }))
  )
    return;
  await database.transaction(async (session: ClientSession) => {
    await database.db
      .collection("admin_bootstrap")
      .updateOne(
        { key: "owner" },
        { $inc: { revision: 1 } },
        { upsert: true, session },
      );
    const user = await database.db.collection("users").findOne(
      {
        _id: id,
        emailVerified: true,
        suspendedAt: null,
        deletionRequestedAt: null,
      },
      { session },
    );
    if (!user) return;
    const other = await database.db
      .collection("admin_owners")
      .findOne(
        { userId: { $ne: id }, role: "owner", active: true },
        { session },
      );
    if (other) throw new Error("owner_activation_conflict");
    const result = await database.db.collection("admin_owners").updateOne(
      { userId: id, role: "owner", pendingVerification: true, active: false },
      {
        $set: {
          active: true,
          pendingVerification: false,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { session },
    );
    if (result.modifiedCount)
      await database.db.collection("audit_logs").insertOne(
        {
          actorId: id,
          action: "owner.email-verified",
          target: userId,
          outcome: "pending-mfa",
          requestId: "auth-owner-activation",
          changes: {},
          createdAt: new Date(),
        },
        { session },
      );
  });
}
