import { createMongoDatabase, mongoConfigFromEnv } from "@movprompt/db";
import {
  ensureAdminIndexes,
  ADMIN_COLLECTIONS,
  adminObjectId,
} from "./security.js";

const email = process.argv
  .find((value) => value.startsWith("--email="))
  ?.slice(8)
  .trim()
  .toLowerCase();
if (!email || !process.argv.includes("--confirm-owner-bootstrap"))
  throw new Error(
    "Usage: admin:bootstrap --email=verified-owner@example.com --confirm-owner-bootstrap (use protected deployment access)",
  );
const database = createMongoDatabase(mongoConfigFromEnv());
try {
  await database.connect();
  await ensureAdminIndexes(database);
  await database.transaction(async (session) => {
    const user = await database.db
      .collection("users")
      .findOne(
        { email: { $eq: email } },
        { session, collation: { locale: "en", strength: 2 } },
      );
    if (!user?.emailVerified || user.suspendedAt || user.deletionRequestedAt)
      throw new Error(
        "An existing verified, active account with this exact email is required.",
      );
    const owners = database.db.collection(ADMIN_COLLECTIONS.owners);
    // Singleton bootstrap fence: concurrent deployment commands cannot create
    // two initial owners. Staff/owner invitations are deliberately not exposed.
    await database.db
      .collection("admin_bootstrap")
      .updateOne(
        { key: "owner" },
        { $inc: { revision: 1 } },
        { upsert: true, session },
      );
    const existing = await owners.findOne({ active: true }, { session });
    if (existing && !existing.userId.equals(user._id))
      throw new Error(
        "An owner already exists. Bootstrap cannot replace owner membership.",
      );
    await owners.updateOne(
      { userId: user._id },
      {
        $setOnInsert: {
          userId: user._id,
          role: "owner",
          active: true,
          createdAt: new Date(),
          source: "protected-deployment-bootstrap",
        },
      },
      { upsert: true, session },
    );
    await database.db.collection("audit_logs").insertOne(
      {
        actorId: user._id,
        action: "owner.bootstrap",
        target: String(user._id),
        requestId: "deployment-bootstrap",
        outcome: "succeeded",
        changes: { source: "protected-deployment" },
        createdAt: new Date(),
      },
      { session },
    );
    console.info(
      `Owner membership ready for ${String(user._id)}. Verify MFA and recovery codes through /admin before access.`,
    );
  });
} finally {
  await database.close();
}
