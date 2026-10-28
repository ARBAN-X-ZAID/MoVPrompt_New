import { ObjectId } from "mongodb";
import type { MongoDatabase } from "@movprompt/db";
import { factorCodeFingerprint } from "./factor-code-fingerprint.js";

/** Both login MFA and sensitive-action MFA consume the same short-lived code
 * fence. Intervening recovery codes cannot make a used TOTP reusable. */
export async function claimFactorUse(
  database: MongoDatabase,
  userId: string,
  mode: string,
  code: string,
) {
  const now = new Date();
  const fingerprint = factorCodeFingerprint(userId, mode, code);
  try {
    await database.db.collection("admin_factor_uses").updateOne(
      { userId: new ObjectId(userId), fingerprint, expiresAt: { $lte: now } },
      {
        $set: { usedAt: now, expiresAt: new Date(now.getTime() + 90000) },
        $setOnInsert: { userId: new ObjectId(userId), fingerprint },
      },
      { upsert: true },
    );
    return true;
  } catch (error) {
    if (Number((error as { code?: number }).code) === 11000) return false;
    throw error;
  }
}
