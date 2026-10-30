import { createHash, randomUUID } from "node:crypto";
import type { MongoDatabase } from "@movprompt/db";

const indexes = new WeakMap<MongoDatabase, Promise<string>>();

/** Serialize password checks across processes. Never persist passwords or raw emails. */
export async function checkPasswordAttempt<T>(
  database: MongoDatabase,
  subject: string,
  check: () => Promise<{ value: T; valid: boolean | null }>,
  now = new Date(),
): Promise<T> {
  const collection = database.db.collection("password_attempts");
  if (!indexes.has(database))
    indexes.set(
      database,
      collection
        .createIndex({ subject: 1 }, { unique: true })
        .catch((error) => {
          indexes.delete(database);
          throw error;
        }),
    );
  await indexes.get(database);
  const id = createHash("sha256")
    .update(subject.trim().toLowerCase())
    .digest("hex");
  const token = randomUUID();
  await collection
    .updateOne(
      { subject: id },
      {
        $setOnInsert: {
          subject: id,
          failures: 0,
          blockedUntil: new Date(0),
          lockUntil: new Date(0),
        },
      },
      { upsert: true },
    )
    .catch((error: { code?: number }) => {
      if (error.code !== 11000) throw error;
    });
  const row = await collection.findOneAndUpdate(
    { subject: id, blockedUntil: { $lte: now }, lockUntil: { $lte: now } },
    { $set: { token, lockUntil: new Date(now.getTime() + 30000) } },
    { returnDocument: "after" },
  );
  if (!row) {
    const current = await collection.findOne({ subject: id });
    const until = Math.max(
      new Date(current?.blockedUntil ?? 0).getTime(),
      new Date(current?.lockUntil ?? 0).getTime(),
    );
    throw new PasswordCooldownError(
      Math.max(1, Math.ceil((until - now.getTime()) / 1000)),
    );
  }
  try {
    const result = await check();
    const prior =
      row.blockedUntil.getTime() > 0 && row.blockedUntil <= now
        ? 0
        : Number(row.failures);
    const failures =
      result.valid === true ? 0 : result.valid === false ? prior + 1 : prior;
    const blockedUntil =
      failures >= 10 ? new Date(Date.now() + 300000) : new Date(0);
    const recorded = await collection.updateOne(
      { subject: id, token, lockUntil: { $gt: new Date() } },
      {
        $set: {
          failures,
          blockedUntil,
          lockUntil: new Date(0),
          updatedAt: new Date(),
        },
        $unset: { token: "" },
      },
    );
    if (!recorded.matchedCount) throw new Error("password_check_lease_lost");
    if (failures >= 10) throw new PasswordCooldownError(300);
    return result.value;
  } finally {
    await collection.updateOne(
      { subject: id, token },
      { $set: { lockUntil: new Date(0) }, $unset: { token: "" } },
    );
  }
}

export class PasswordCooldownError extends Error {
  readonly code = "PASSWORD_COOLDOWN";
  constructor(readonly retryAfter: number) {
    super(`Too many attempts. Try again in ${retryAfter} seconds.`);
  }
}
