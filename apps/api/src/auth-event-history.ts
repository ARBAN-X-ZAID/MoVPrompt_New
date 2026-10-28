import { ObjectId } from "mongodb";
import type { MongoDatabase } from "@movprompt/db";

export function issuedSessionHeaders(request: Request, response: Response) {
  const cookies = new Map(
    (request.headers.get("cookie") ?? "")
      .split(";")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => {
        const index = value.indexOf("=");
        return [value.slice(0, index), value.slice(index + 1)] as const;
      }),
  );
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0]!;
    const index = pair.indexOf("=");
    cookies.set(pair.slice(0, index), pair.slice(index + 1));
  }
  const headers = new Headers(request.headers);
  headers.set(
    "cookie",
    [...cookies].map(([key, value]) => `${key}=${value}`).join("; "),
  );
  return headers;
}
type Session = { user: { id: string }; session: { id: string } } | null;
export function authenticationEventKind(path: string) {
  if (path.endsWith("/sign-in/email")) return "password-sign-in";
  if (path.endsWith("/sign-up/email")) return "registration";
  if (path.endsWith("/two-factor/verify-totp"))
    return "authenticator-verification";
  if (path.endsWith("/two-factor/verify-backup-code"))
    return "recovery-code-verification";
  if (path.endsWith("/sign-out")) return "sign-out";
  if (path.endsWith("/change-password") || path.endsWith("/reset-password"))
    return "password-change";
  if (path.endsWith("/two-factor/enable")) return "mfa-enrollment-request";
  if (/\/callback\/(google|apple)$/.test(path)) return "social-sign-in";
  return null;
}
/** Records outcomes without request bodies, passwords, codes, token values,
 * callback URLs or raw auth errors. A failed password attempt targets an
 * account; it does not assert that its owner made the attempt. */
export async function recordAuthenticationEvent(
  database: MongoDatabase,
  request: Request,
  response: Response,
  getSession: (headers: Headers) => Promise<Session>,
  priorSession: Session,
) {
  const kind = authenticationEventKind(new URL(request.url).pathname);
  if (!kind) return;
  const issued = await getSession(issuedSessionHeaders(request, response));
  let userId = issued?.user.id ?? priorSession?.user.id;
  if (
    (!userId || response.status >= 400) &&
    ["password-sign-in", "registration"].includes(kind)
  ) {
    const input = (await request
      .clone()
      .json()
      .catch(() => null)) as { email?: unknown } | null;
    if (typeof input?.email === "string" && input.email.length <= 254) {
      const user = await database.db
        .collection("users")
        .findOne(
          { email: input.email.trim().toLowerCase() },
          { collation: { locale: "en", strength: 2 }, projection: { _id: 1 } },
        );
      if (user) userId = String(user._id);
    }
  }
  if (!userId || !/^[a-f0-9]{24}$/i.test(userId)) return;
  let outcome =
    response.status >= 400 ? "rejected" : issued ? "authenticated" : "accepted";
  if (kind === "password-sign-in" && response.status === 200 && !issued) {
    const result = (await response
      .clone()
      .json()
      .catch(() => null)) as { twoFactorRedirect?: boolean } | null;
    outcome = result?.twoFactorRedirect ? "factor-required" : "accepted";
  }
  if (kind === "sign-out" && response.status < 400) outcome = "signed-out";
  await database.db
    .collection("authentication_events")
    .insertOne({
      userId: new ObjectId(userId),
      kind,
      outcome,
      httpStatus: response.status,
      requestId: request.headers.get("x-request-id")?.slice(0, 120) ?? null,
      createdAt: new Date(),
    });
}
