import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { createMongoDatabase, newMongoObjectId } from "../src/mongo-client.js";
import { createMongoGenerationService } from "../src/mongo-generation-service.js";

describe.skipIf(process.env.MOVPROMPT_TEST_MONGO !== "true")("atomic anonymous render quota", () => {
  const db = createMongoDatabase({ uri: process.env.MONGODB_URI || "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true", databaseName: `movprompt_quota_test_${Date.now()}` });
  const service = createMongoGenerationService(db, { APP_ENV: "production", GUEST_DAILY_BUDGET_USD: "10", GUEST_MAX_RENDER_COST_USD: "2" });
  beforeAll(() => db.connect());
  afterAll(async () => { await db.db.dropDatabase(); await db.close(); });
  async function input(ip: string) {
    const userId = newMongoObjectId(), projectId = newMongoObjectId(), projectVersionId = newMongoObjectId();
    await db.db.collection("guest_sessions").insertOne({ _id: new ObjectId(userId), claimedBy: null, ipHash: ip, expiresAt: new Date(Date.now() + 86400_000) });
    await db.collection("creator_projects").insertOne({ id: projectId, userId, status: "ready", deletedAt: null });
    await db.collection("creator_project_versions").insertOne({ id: projectVersionId, projectId, userId });
    const quote = await service.createQuote({ userId, capabilityAlias: "video.product_fidelity", credits: 0, entitlementEligible: false, breakdown: [], configuration: {}, expiresAt: new Date(Date.now() + 60_000) });
    return { userId, projectId, projectVersionId, quoteId: quote.id, capabilityAlias: "video.product_fidelity" as const, idempotencyKey: `render-${projectId}`, configuration: {} };
  }
  it("allows one submission across two simultaneous sessions on the same IP", async () => {
    const a = await input("same-ip"), b = await input("same-ip");
    const outcomes = await Promise.allSettled([service.startRender(a), service.startRender(b)]);
    expect(outcomes.filter(x => x.status === "fulfilled")).toHaveLength(1);
    expect(await db.db.collection("render_runs").countDocuments({ guestIpHash: "same-ip" })).toBe(1);
  });
  it("releases the guest allowance after terminal failure while retaining budget cost", async () => {
    const a = await input("failure-ip");
    const first = await service.startRender(a);
    await service.releaseRenderReservation({ runId: first.id, userId: a.userId, reason: "test_failure" });
    const next = await service.startRender(await input("failure-ip"));
    expect(next.id).not.toBe(first.id);
    expect(await db.db.collection("render_runs").countDocuments({ guestIpHash: "failure-ip" })).toBe(2);
  });
  it("rejects public requests when the global budget is missing", async () => {
    const failClosed = createMongoGenerationService(db, { APP_ENV: "production" });
    await expect(failClosed.startRender(await input("missing-budget"))).rejects.toThrow();
    expect(await db.db.collection("render_runs").countDocuments({ guestIpHash: "missing-budget" })).toBe(0);
  });
  it("replaying the same operation does not reserve spend or enqueue twice", async () => {
    const a = await input("other-ip");
    const first = await service.startRender(a);
    const second = await service.startRender(a);
    expect(first.id).toBe(second.id);
    expect(await db.db.collection("render_runs").countDocuments({ guestIpHash: "other-ip" })).toBe(1);
  });
});
