import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { createMongoDatabase, ensureMongoIndexes, type MongoDatabase } from "@movprompt/db";
import { authEnvironmentFromEnv, createMovPromptAuth } from "@movprompt/auth";
import { createBetterAuthGateway, type AuthGateway } from "../auth-gateway.js";
import { ADMIN_COLLECTIONS as A, createAdminSecurity, ensureAdminIndexes } from "./security.js";

const userId = new ObjectId();
const sessionId = new ObjectId().toHexString();
const session = {
  user: { id: String(userId), name: "Owner", email: "owner@example.test", emailVerified: true },
  session: { id: sessionId, expiresAt: new Date(Date.now() + 86400000) },
};
const assured = () => ({ expiresAt: new Date(Date.now() + 3600000), recentUntil: new Date(Date.now() + 60000) });

/** A database that records which collections are read and how reads overlap. */
function recordingDatabase(rows: Record<string, unknown>) {
  const reads: string[] = [];
  let inFlight = 0;
  let stages = 0;
  const database = {
    db: {
      collection: (name: string) => ({
        findOne: async () => {
          if (inFlight === 0) stages += 1;
          inFlight += 1;
          reads.push(name);
          await new Promise((resolve) => setImmediate(resolve));
          inFlight -= 1;
          return rows[name] ?? null;
        },
      }),
    },
  } as unknown as MongoDatabase;
  return { database, reads, stages: () => stages };
}
const gateway = (): AuthGateway => ({
  handle: async () => new Response(null, { status: 404 }),
  getSession: vi.fn(async () => session),
  getSessionWithoutAccountCheck: vi.fn(async () => session),
});
const owner = { userId, role: "owner", active: true };
const verified = { emailVerified: true, twoFactorEnabled: true };
const headers = new Headers();

describe("requireOwner database reads", () => {
  it("resolves a password-policy owner with one session lookup and one read stage", async () => {
    const { database, reads, stages } = recordingDatabase({
      [A.owners]: { ...owner, authenticationPolicy: "password" },
      users: verified,
      [A.assurance]: assured(),
      twoFactor: { backupCodes: "x" },
    });
    const auth = gateway();
    const actor = await createAdminSecurity(database, auth).requireOwner(headers, "request");
    expect(actor).toEqual({ userId: String(userId), sessionId, requestId: "request" });
    expect(auth.getSessionWithoutAccountCheck).toHaveBeenCalledTimes(1);
    expect(auth.getSession).not.toHaveBeenCalled();
    expect(reads.sort()).toEqual([A.owners, "users"].sort());
    expect(stages()).toBe(1);
  });
  it("reads assurance alongside the owner on a recent route and never needs factors", async () => {
    const { database, reads, stages } = recordingDatabase({
      [A.owners]: { ...owner, authenticationPolicy: "password" },
      users: verified,
      [A.assurance]: assured(),
    });
    await createAdminSecurity(database, gateway()).requireOwner(headers, "request", true);
    expect(reads.sort()).toEqual([A.owners, A.assurance, "users"].sort());
    expect(stages()).toBe(1);
  });
  it("still checks factors and assurance for an MFA owner in one more stage", async () => {
    const { database, reads, stages } = recordingDatabase({
      [A.owners]: owner,
      users: verified,
      [A.assurance]: assured(),
      twoFactor: { backupCodes: "x" },
    });
    await createAdminSecurity(database, gateway()).requireOwner(headers, "request");
    expect(reads.sort()).toEqual([A.owners, A.assurance, "twoFactor", "users"].sort());
    expect(stages()).toBe(2);
  });
  it("keeps the sessionId out of the identity payload", async () => {
    const { database } = recordingDatabase({ [A.owners]: owner, users: verified, [A.assurance]: assured(), twoFactor: { backupCodes: "x" } });
    const identity = await createAdminSecurity(database, gateway()).identity(headers);
    expect(JSON.stringify(identity)).not.toContain(sessionId);
  });
  it.each([
    ["no authenticator", { ...verified, twoFactorEnabled: false }, assured(), { backupCodes: "x" }, "owner_mfa_setup_required"],
    ["no recovery codes", verified, assured(), {}, "owner_mfa_setup_required"],
    ["no assurance", verified, null, { backupCodes: "x" }, "owner_step_up_required"],
    ["expired assurance", verified, { expiresAt: new Date(Date.now() - 1000) }, { backupCodes: "x" }, "owner_step_up_required"],
  ])("rejects an MFA owner with %s", async (_label, user, assurance, factor, code) => {
    const { database } = recordingDatabase({ [A.owners]: owner, users: user, [A.assurance]: assurance, twoFactor: factor });
    await expect(createAdminSecurity(database, gateway()).requireOwner(headers, "request")).rejects.toMatchObject({ code, status: 403 });
  });
  it("rejects a password-policy owner on a recent route without a live confirmation", async () => {
    for (const assurance of [null, { expiresAt: new Date(Date.now() + 60000), recentUntil: new Date(Date.now() - 1000) }]) {
      const { database } = recordingDatabase({ [A.owners]: { ...owner, authenticationPolicy: "password" }, users: verified, [A.assurance]: assurance });
      await expect(createAdminSecurity(database, gateway()).requireOwner(headers, "request", true)).rejects.toMatchObject({ code: "owner_step_up_required", status: 403 });
    }
  });
  it("treats a suspended account as signed out when the check moved here, as the gateway does", async () => {
    for (const change of [{ suspendedAt: new Date() }, { deletionRequestedAt: new Date() }]) {
      const { database } = recordingDatabase({ [A.owners]: owner, users: { ...verified, ...change } });
      await expect(createAdminSecurity(database, gateway()).requireOwner(headers, "request")).rejects.toMatchObject({ code: "authentication_required", status: 401 });
    }
    const { database } = recordingDatabase({ [A.owners]: owner });
    await expect(createAdminSecurity(database, gateway()).requireOwner(headers, "request")).rejects.toMatchObject({ code: "authentication_required", status: 401 });
  });
  it("keeps the 403 outcome for gateways that only offer getSession", async () => {
    const { database } = recordingDatabase({ [A.owners]: owner, users: { ...verified, suspendedAt: new Date() } });
    const plain: AuthGateway = { handle: gateway().handle, getSession: async () => session };
    await expect(createAdminSecurity(database, plain).requireOwner(headers, "request")).rejects.toMatchObject({ code: "owner_required", status: 403 });
  });
});

const uri = process.env.ADMIN_TEST_MONGODB_URI;
describe.skipIf(!uri)("owner access with the actual Better Auth adapter", () => {
  const database = createMongoDatabase({
    uri: uri ?? "mongodb://127.0.0.1:27029/",
    databaseName: `movprompt_owner_access_test_${Date.now()}`,
  });
  const environment = authEnvironmentFromEnv({
    BETTER_AUTH_URL: "http://localhost:8787",
    BETTER_AUTH_SECRET: "synthetic-local-admin-auth-test-secret-2026",
  });
  const auth = createMovPromptAuth({ db: database, environment, sendEmail: async () => undefined });
  const gateway = createBetterAuthGateway(auth, environment.publicCapability, database);
  const security = createAdminSecurity(database, gateway);
  const password = "Synthetic-local-only-2026!";
  const email = "password.owner.access@example.test";
  const cookies = new Map<string, string>();
  const cookieHeaders = () => new Headers({ cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; ") });
  let id: ObjectId;
  async function call(path: string, body: unknown) {
    const response = await gateway.handle(new Request(`http://localhost:8787/api/auth/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:8787" },
      body: JSON.stringify(body),
    }));
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0]!;
      const index = pair.indexOf("=");
      cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return { status: response.status, data: await response.json() };
  }
  beforeAll(async () => {
    await database.connect();
    await ensureMongoIndexes(database);
    await ensureAdminIndexes(database);
    const signup = await call("sign-up/email", { email, name: "Access owner", password });
    expect(signup.status).toBe(200);
    id = new ObjectId(signup.data.user.id);
    await call("sign-in/email", { email, password });
  });
  afterAll(async () => {
    await database.db.dropDatabase();
    await database.close();
  });
  it("rejects a member of no owner list", async () => {
    await expect(security.requireOwner(cookieHeaders(), "request")).rejects.toMatchObject({ code: "owner_required", status: 403 });
  });
  it("enforces every gate on each request with no cached session", async () => {
    await database.db.collection(A.owners).insertOne({ userId: id, role: "owner", active: true, authenticationPolicy: "password", loginMode: "designated-email-password" });
    const headers = cookieHeaders();
    const getSession = vi.spyOn(auth.api, "getSession");
    expect(await security.requireOwner(headers, "request")).toMatchObject({ userId: String(id) });
    expect(getSession).toHaveBeenCalledTimes(1);
    getSession.mockRestore();

    await expect(security.requireOwner(headers, "request", true)).rejects.toMatchObject({ code: "owner_step_up_required" });
    await security.confirmPassword(headers, password, "request");
    expect(await security.requireOwner(headers, "request", true)).toMatchObject({ userId: String(id) });
    await database.db.collection(A.assurance).updateMany({ userId: id }, { $set: { recentUntil: new Date(Date.now() - 1000) } });
    await expect(security.requireOwner(headers, "request", true)).rejects.toMatchObject({ code: "owner_step_up_required" });
    expect(await security.requireOwner(headers, "request")).toMatchObject({ userId: String(id) });

    for (const field of ["suspendedAt", "deletionRequestedAt"]) {
      await database.db.collection("users").updateOne({ _id: id }, { $set: { [field]: new Date() } });
      await expect(security.requireOwner(headers, "request")).rejects.toMatchObject({ code: "authentication_required", status: 401 });
      await expect(security.identity(headers)).rejects.toMatchObject({ code: "authentication_required", status: 401 });
      expect(await gateway.getSession(headers)).toBeNull();
      await database.db.collection("users").updateOne({ _id: id }, { $unset: { [field]: "" } });
      expect(await security.requireOwner(headers, "request")).toMatchObject({ userId: String(id) });
    }

    await database.db.collection("sessions").deleteMany({ userId: id });
    await expect(security.requireOwner(headers, "request")).rejects.toMatchObject({ code: "authentication_required", status: 401 });
  });
});
