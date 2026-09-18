import { createHash, createHmac, randomBytes } from "node:crypto";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ObjectId } from "mongodb";
import type { MongoDatabase } from "@movprompt/db";
import type { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { ApiEnvironment } from "./request-context.js";
import type { AuthGateway, AuthenticatedSession } from "./auth-gateway.js";
import { ApiHttpError } from "./errors.js";
import type { AssetStorageGateway } from "./asset-storage.js";

export const GUEST_RETENTION_MS = 7 * 86400_000;
const activeStatuses = ["submitting", "queued", "processing", "cancelling"];
export function hashGuestToken(token: string): string { return createHash("sha256").update(token).digest("hex"); }
export function guestCookieToken(headers: Headers): string | null {
  const token = /(?:^|;\s*)mp_guest=([a-f0-9]{64})(?:;|$)/.exec(headers.get("cookie") ?? "")?.[1];
  return token ?? null;
}
export function guestRouteAllowed(method: string, path: string): boolean {
  if (!/^(GET|POST|PUT)$/.test(method) || path.endsWith("/output")) return false;
  return /^\/api\/v1\/(projects(?:\/|$)|drafts\/claim(?:\/|$)|assets(?:\/|$)|render-runs(?:\/|$)|generation\/quotes$)/.test(path);
}
function fail(code: string, message: string, status: ContentfulStatusCode = 409): never {
  throw new ApiHttpError({ code, message, status, retryable: status === 409 || status === 503 });
}

export function createGuestAccess(database: MongoDatabase, auth: AuthGateway, environment: NodeJS.ProcessEnv, storage?: AssetStorageGateway) {
  const guests = database.db.collection("guest_sessions");
  const local = environment.APP_ENV === "local";
  const trustedOrigins = (environment.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(",").map(x => x.trim());
  const secret = environment.BETTER_AUTH_SECRET ?? "";
  const ready = guests.createIndex({ tokenHash: 1 }, { unique: true });
  void ready.catch(() => undefined);
  async function guest(headers: Headers) {
    await ready;
    const token = guestCookieToken(headers);
    if (!token) return null;
    return guests.findOne({ tokenHash: hashGuestToken(token), claimedBy: null, cleanupState: { $ne: "deleting" }, expiresAt: { $gt: new Date() } });
  }
  async function guestSession(headers: Headers): Promise<AuthenticatedSession | null> {
    const row = await guest(headers);
    return row ? { user: { id: row._id.toHexString(), email: `${row._id}@guest.invalid`, name: "Guest", emailVerified: false }, session: { id: row._id.toHexString(), guest: true } } : null;
  }
  const scopedAuth: AuthGateway = {
    ...auth,
    async getSession(headers) { return await auth.getSession(headers) ?? await guestSession(headers); },
  };
  return {
    scopedAuth,
    async isGuest(userId: string) { return Boolean(await guests.findOne({ _id: new ObjectId(userId), claimedBy: null, expiresAt: { $gt: new Date() } })); },
    register(app: Hono<ApiEnvironment>) {
      app.use("/api/v1/*", async (c, next) => {
        if (await auth.getSession(c.req.raw.headers)) return next();
        const row = await guest(c.req.raw.headers);
        if (row && !c.req.path.startsWith("/api/v1/guest/") && !guestRouteAllowed(c.req.method, c.req.path)) {
          // Public discovery remains public. Guest cookies must not grant unrelated account access.
          if (!/^\/api\/v1\/(templates|feature-flags|health|version|capabilities)(?:\/|$)/.test(c.req.path)) {
            fail("authentication_required", "Sign in to access your account or download the clean video.", 401);
          }
        }
        if (row && c.req.method !== "GET") {
          const origin = c.req.header("origin");
          if (!origin || !trustedOrigins.includes(origin)) fail("origin_forbidden", "This origin cannot modify a guest project.", 403);
        }
        await next();
      });
      app.post("/api/v1/guest/session", async c => {
        const origin = c.req.header("origin");
        if (!origin || !trustedOrigins.includes(origin)) fail("origin_forbidden", "This origin cannot create a guest session.", 403);
        const signedIn = await auth.getSession(c.req.raw.headers);
        if (signedIn) return c.json({ user: signedIn.user, guest: false });
        let row = await guest(c.req.raw.headers);
        if (!row) {
          const token = randomBytes(32).toString("hex");
          // Production must explicitly trust the hosting reverse proxy; never accept arbitrary client IP headers by default.
          const ip = local ? "local" : environment.GUEST_TRUST_PROXY === "true" ? c.req.header("x-forwarded-for")?.split(",").at(-1)?.trim() : undefined;
          if (!ip || !secret) fail("guest_setup_required", "Guest generation requires trusted proxy and budget configuration.", 503);
          const _id = new ObjectId();
          row = { _id, tokenHash: hashGuestToken(token), ipHash: createHmac("sha256", secret).update(ip).digest("hex"), claimedBy: null, expiresAt: new Date(Date.now() + GUEST_RETENTION_MS), createdAt: new Date() };
          await guests.insertOne(row);
          setCookie(c, "mp_guest", token, { httpOnly: true, secure: !local, sameSite: "Lax", path: "/", maxAge: GUEST_RETENTION_MS / 1000 });
        }
        c.header("cache-control", "no-store");
        return c.json({ user: { id: row._id.toHexString(), name: "Guest", email: `${row._id}@guest.invalid`, emailVerified: false }, guest: true, expiresAt: row.expiresAt });
      });
      app.get("/api/v1/guest/projects/:projectId/render-runs/:runId/preview", async c => {
        const row = await guest(c.req.raw.headers);
        if (!row || !storage) fail("preview_unavailable", "Your preview has expired or storage is not configured.", 404);
        const { projectId, runId } = c.req.param();
        if (!ObjectId.isValid(projectId) || !ObjectId.isValid(runId)) fail("not_found", "Preview not found.", 404);
        const run = await database.db.collection("render_runs").findOne({ _id: new ObjectId(runId), projectId: new ObjectId(projectId), userId: row._id, status: "completed" });
        if (!run?.outputObjectKey || run.outputBucket !== storage.outputsBucket) fail("preview_not_ready", "The video is not ready yet.");
        const key = String(run.outputObjectKey).replace(/\.mp4$/, ".preview.mp4");
        await storage.head(storage.outputsBucket, key);
        const signed = await storage.signDownload({ bucket: storage.outputsBucket, key });
        c.header("cache-control", "private, no-store");
        return c.json({ url: signed.url });
      });
      app.post("/api/v1/guest/claim", async c => {
        const origin = c.req.header("origin");
        if (!origin || !trustedOrigins.includes(origin)) fail("origin_forbidden", "This origin cannot claim projects.", 403);
        const real = await auth.getSession(c.req.raw.headers);
        if (!real) fail("authentication_required", "Sign in to save your generated videos.", 401);
        const token = getCookie(c, "mp_guest");
        if (!token) return c.json({ claimed: true, projectIds: [] });
        const row = await guests.findOne({ tokenHash: hashGuestToken(token) });
        if (!row || (!row.claimedBy && row.expiresAt <= new Date())) {
          deleteCookie(c, "mp_guest", { path: "/" });
          return c.json({ claimed: false, projectIds: [] });
        }
        const target = new ObjectId(real.user.id);
        if (row.claimedBy) {
          deleteCookie(c, "mp_guest", { path: "/" });
          if (!row.claimedBy.equals(target)) return c.json({ claimed: false, projectIds: [] });
          return c.json({ claimed: true, projectIds: row.projectIds ?? [] });
        }
        const projectIds = await database.transaction(async session => {
          const locked = await guests.findOneAndUpdate({ _id: row._id, claimedBy: null, cleanupState: { $ne: "deleting" }, expiresAt: { $gt: new Date() } }, { $inc: { revision: 1 } }, { session, returnDocument: "after" });
          if (!locked) {
            const alreadyClaimed = await guests.findOne({ _id: row._id, claimedBy: target }, { session });
            if (alreadyClaimed) return alreadyClaimed.projectIds ?? [];
            fail("guest_expired", "This guest session has expired.", 410);
          }
          const active = await database.db.collection("render_runs").findOne({ userId: row._id, status: { $in: activeStatuses } }, { session });
          if (active) fail("generation_in_progress", "Your video is still generating. Claim it when it finishes.");
          const projects = await database.db.collection("creator_projects").find({ userId: row._id }, { session }).toArray();
          // Keys remain immutable. Provenance is retained separately from the new authenticated owner.
          for (const name of ["creator_projects", "creator_project_versions", "creator_project_assets", "guest_claim_operations", "guest_claim_assets", "generation_quotes", "render_runs", "render_attempts", "exports"]) {
            await database.db.collection(name).updateMany({ userId: row._id }, { $set: { userId: target, storageOwnerId: row._id.toHexString() } }, { session });
          }
          const ids = projects.map(p => p._id.toHexString());
          await guests.updateOne({ _id: row._id }, { $set: { claimedBy: target, claimedAt: new Date(), projectIds: ids } }, { session });
          return ids;
        });
        deleteCookie(c, "mp_guest", { path: "/" });
        return c.json({ claimed: true, projectIds });
      });
    },
  };
}
export type GuestAccess = ReturnType<typeof createGuestAccess>;
