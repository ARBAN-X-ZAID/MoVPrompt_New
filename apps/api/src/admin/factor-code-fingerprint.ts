import { createHmac, randomBytes } from "node:crypto";

// Production Better Auth requires a deployment secret. The ephemeral fallback
// is only for isolated factories/tests without a configured authentication app.
const ephemeralKey = randomBytes(32);
export function factorCodeFingerprint(
  userId: string,
  mode: string,
  code: string,
) {
  return createHmac(
    "sha256",
    process.env.BETTER_AUTH_SECRET?.trim() || ephemeralKey,
  )
    .update(`${userId}:${mode}:${code}`)
    .digest("hex");
}
