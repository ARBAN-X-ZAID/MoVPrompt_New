import { COLLECTIONS, createMongoDatabase, mongoConfigFromEnv, newMongoObjectId } from "../packages/db/src/mongo-client.ts";

const [email, amountText, operationKey] = process.argv.slice(2);
const amount = Number(amountText);

if (!email?.includes("@") || !Number.isSafeInteger(amount) || amount <= 0 || !operationKey?.trim()) {
  console.error("Usage: bun --env-file=.env scripts/grant-credits.ts <email> <positive credits> <unique operation key>");
  process.exit(1);
}

const database = createMongoDatabase(mongoConfigFromEnv());
await database.connect();

try {
  const user = await database.collection(COLLECTIONS.users).findOne({ email: email.trim().toLowerCase() });
  if (!user) throw new Error(`No account found for ${email}. Sign up first, then rerun.`);
  const userId = String(user.id);
  // The operation key makes reruns no-ops instead of granting twice.
  const idempotencyKey = `admin.grant:${operationKey.trim()}`;

  const result = await database.transaction(async (session) => {
    const existing = await database.collection(COLLECTIONS.creditLedger).findOne({ idempotencyKey }, { session });
    if (existing) return { granted: false, balance: Number(existing.balanceAfter) };
    const now = new Date();
    const account = await database.collection(COLLECTIONS.creditAccounts).findOneAndUpdate(
      { userId },
      { $inc: { balance: amount }, $set: { updatedAt: now }, $setOnInsert: { userId, createdAt: now } },
      { upsert: true, returnDocument: "after", session },
    );
    const balanceAfter = Number(account?.balance);
    await database.collection(COLLECTIONS.creditLedger).insertOne({
      id: newMongoObjectId(), userId, kind: "grant", delta: amount, balanceAfter,
      reason: "admin_grant", referenceType: null, referenceId: null, idempotencyKey, createdAt: now,
    }, { session });
    return { granted: true, balance: balanceAfter };
  });

  console.log(result.granted
    ? `Granted ${amount} credits to ${email}. Balance: ${result.balance}.`
    : `Grant "${operationKey}" was already applied to ${email}. Balance after that grant: ${result.balance}.`);
} finally {
  await database.close();
}
