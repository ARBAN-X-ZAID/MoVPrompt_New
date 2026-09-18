import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { createMongoDatabase } from "@movprompt/db";
import { Hono } from "hono";
import { createGuestAccess } from "./guest-access.js";
import type { ApiEnvironment } from "./request-context.js";
import { ApiHttpError } from "./errors.js";
import type { AssetStorageGateway } from "./asset-storage.js";

const enabled = process.env.MOVPROMPT_TEST_MONGO === "true";
describe.skipIf(!enabled)("Mongo guest ownership integration", () => {
  const db = createMongoDatabase({ uri: process.env.MONGODB_URI || "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true", databaseName: `movprompt_guest_test_${Date.now()}` });
  const owner = new ObjectId();
  const app = new Hono<ApiEnvironment>();
  const access = createGuestAccess(db, {
    handle: async () => new Response(),
    getSession: async headers => headers.get("authorization") === "test-account" ? { user: { id: owner.toHexString(), email: "test@example.test", name: "Test", emailVerified: true }, session: { id: "real" } } : null,
  }, { APP_ENV: "local", BETTER_AUTH_SECRET: "integration-secret", BETTER_AUTH_TRUSTED_ORIGINS: "http://localhost:8080" }, { outputsBucket: "private-outputs", head: async () => ({}), signDownload: async ({ key }: { key: string }) => ({ url: `https://private.example.test/${key}` }) } as unknown as AssetStorageGateway);
  app.onError((error, c) => error instanceof ApiHttpError ? c.json({ error: error.code }, error.status) : c.json({ error: "unexpected" }, 500));
  access.register(app);
  app.get("/api/v1/projects/a/render-runs/b/output", c => c.text("clean master"));
  beforeAll(() => db.connect());
  afterAll(async () => { await db.db.dropDatabase(); await db.close(); });
  let cookie = ""; let guestId: ObjectId;
  it("issues an opaque session, rejects cross-origin creation and denies the clean master", async () => {
    expect((await app.request("/api/v1/guest/session", { method: "POST" })).status).toBe(403);
    const result = await app.request("/api/v1/guest/session", { method: "POST", headers: { origin: "http://localhost:8080" } });
    expect(result.status).toBe(200);
    cookie = result.headers.get("set-cookie")!.split(";")[0]!;
    expect(result.headers.get("set-cookie")).toContain("HttpOnly");
    guestId = new ObjectId((await result.json()).user.id);
    const stored = await db.db.collection("guest_sessions").findOne({ _id: guestId });
    expect(stored?.tokenHash).not.toBe(cookie.split("=")[1]);
    expect((await app.request("/api/v1/projects/a/render-runs/b/output", { headers: { cookie } })).status).toBe(401);
  });
  it("serves only a watermarked preview and denies another guest's run", async () => {
    const projectId = new ObjectId(), runId = new ObjectId();
    await db.db.collection("render_runs").insertOne({ _id: runId, projectId, userId: guestId, status: "completed", outputBucket: "private-outputs", outputObjectKey: `users/${guestId}/projects/${projectId}/result.mp4` });
    const url = `/api/v1/guest/projects/${projectId}/render-runs/${runId}/preview`;
    const response = await app.request(url, { headers: { cookie } });
    expect(response.status).toBe(200);
    expect((await response.json()).url).toMatch(/result\.preview\.mp4$/);
    const stranger = await app.request("/api/v1/guest/session", { method: "POST", headers: { origin: "http://localhost:8080" } });
    const foreignCookie = stranger.headers.get("set-cookie")!.split(";")[0]!;
    expect((await app.request(url, { headers: { cookie: foreignCookie } })).status).toBe(409);
  });
  it("an expired guest does not block the account's own project library", async () => {
    const fresh = await app.request("/api/v1/guest/session", { method: "POST", headers: { origin: "http://localhost:8080" } });
    const expiredCookie = fresh.headers.get("set-cookie")!.split(";")[0]!;
    const id = new ObjectId((await fresh.json()).user.id);
    await db.db.collection("guest_sessions").updateOne({ _id: id }, { $set: { expiresAt: new Date(0) } });
    const response = await app.request("/api/v1/guest/claim", { method: "POST", headers: { cookie: expiredCookie, origin: "http://localhost:8080", authorization: "test-account" } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ claimed: false, projectIds: [] });
    expect(await access.scopedAuth.getSession(new Headers({ cookie: expiredCookie }))).toBeNull();
  });
  it("atomically transfers completed projects once and retains object provenance", async () => {
    const projectId = new ObjectId();
    await db.db.collection("creator_projects").insertOne({ _id: projectId, userId: guestId, status: "completed" });
    await db.db.collection("creator_project_assets").insertOne({ userId: guestId, projectId, objectKey: `users/${guestId}/projects/${projectId}/asset` });
    const headers = { cookie, origin: "http://localhost:8080", authorization: "test-account" };
    const [response, concurrent] = await Promise.all([app.request("/api/v1/guest/claim", { method: "POST", headers }), app.request("/api/v1/guest/claim", { method: "POST", headers })]);
    expect(concurrent.status).toBe(200);
    expect(response.status).toBe(200);
    const first = await response.json();
    expect(first.projectIds).toEqual([projectId.toHexString()]);
    const repeated = await app.request("/api/v1/guest/claim", { method: "POST", headers });
    expect(await repeated.json()).toEqual(first);
    expect(await access.scopedAuth.getSession(new Headers({ cookie }))).toBeNull();
    const asset = await db.db.collection("creator_project_assets").findOne({ projectId });
    expect(asset?.userId.equals(owner)).toBe(true);
    expect(asset?.storageOwnerId).toBe(guestId.toHexString());
  });
});
