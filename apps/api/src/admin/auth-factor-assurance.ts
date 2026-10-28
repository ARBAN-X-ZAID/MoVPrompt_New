import { issuedSessionHeaders } from "../auth-event-history.js";
import { claimFactorUse } from "./factor-uses.js";
import { ObjectId } from "mongodb";
import type { MongoDatabase } from "@movprompt/db";

/** A successful Better Auth factor login is already recent MFA. Grant assurance
 * only to the exact issued server session, never from a browser-supplied flag.
 * This also makes a last unused recovery code sufficient to regain the portal. */
export async function recordOwnerFactorAssurance(
  database: MongoDatabase,
  request: Request,
  response: Response,
  getSession: (
    headers: Headers,
  ) => Promise<{ user: { id: string }; session: { id: string } } | null>,
) {
  const path = new URL(request.url).pathname;
  if (
    response.status !== 200 ||
    !["/two-factor/verify-totp", "/two-factor/verify-backup-code"].some(
      (endpoint) => path.endsWith(endpoint),
    )
  )
    return;
  const issued = await getSession(issuedSessionHeaders(request, response));
  const input = (await request
    .clone()
    .json()
    .catch(() => null)) as { code?: unknown } | null;
  if (
    !issued ||
    !/^[a-f0-9]{24}$/i.test(issued.user.id) ||
    !/^[a-f0-9]{24}$/i.test(issued.session.id) ||
    typeof input?.code !== "string"
  )
    return;
  const userId = new ObjectId(issued.user.id);
  const [user, owner, session] = await Promise.all([
    database.db.collection("users").findOne({
      _id: userId,
      emailVerified: true,
      twoFactorEnabled: true,
      suspendedAt: null,
      deletionRequestedAt: null,
    }),
    database.db
      .collection("admin_owners")
      .findOne({ userId, role: "owner", active: true }),
    database.db.collection("sessions").findOne({
      _id: new ObjectId(issued.session.id),
      userId,
      expiresAt: { $gt: new Date() },
    }),
  ]);
  if (!user || !owner || !session) return;
  const now = new Date();
  const mode = path.endsWith("verify-backup-code") ? "backup" : "totp";
  const used = await claimFactorUse(database, String(userId), mode, input.code);
  if (!used) return;
  await database.db.collection("admin_session_assurance").updateOne(
    { userId, sessionId: String(session._id) },
    {
      $set: {
        expiresAt: new Date(now.getTime() + 8 * 3600000),
        recentUntil: new Date(now.getTime() + 5 * 60000),
        verifiedAt: now,
        factorMethod: mode,
      },
    },
    { upsert: true },
  );
  await database.db.collection("audit_logs").insertOne({
    actorId: userId,
    action: "owner.factor-login",
    target: String(session._id),
    outcome: "succeeded",
    requestId:
      request.headers.get("x-request-id")?.slice(0, 120) ??
      "auth-factor-verification",
    changes: { method: mode },
    createdAt: now,
  });
}
