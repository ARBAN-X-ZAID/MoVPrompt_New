import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ObjectId, type CommandStartedEvent, type Document } from "mongodb";
import { createMongoDatabase, ensureMongoIndexes, ensureMongoTemplateCatalog, COLLECTIONS as C } from "@movprompt/db";
import { LAUNCH_CREATIVE_TEMPLATE_CATALOG } from "@movprompt/creative-engine";
import { createApi } from "../app.js";
import { loadApiConfig } from "../config.js";
import type { AssetStorageGateway } from "../asset-storage.js";
import type { AuthGateway } from "../auth-gateway.js";
import { ADMIN_COLLECTIONS as A, ensureAdminIndexes } from "./security.js";
import { ADMIN_LIST_COUNT_CAP } from "./data-service.js";
import { addAdminTemplateView, addAdminTemplateViews } from "./template-view.js";

const uri = process.env.ADMIN_TEST_MONGODB_URI;
describe.skipIf(!uri)("owner admin query shape on real MongoDB", () => {
  const database = createMongoDatabase({
    uri: uri ?? "mongodb://127.0.0.1:27029/",
    databaseName: `movprompt_admin_performance_test_${Date.now()}`,
  });
  const ownerId = new ObjectId();
  const customerId = new ObjectId();
  const outsiderId = new ObjectId();
  const sessionId = new ObjectId().toHexString();
  const env = { FEATURE_OWNER_ADMIN: "true", WEB_ORIGIN: "http://localhost:8080" };
  const auth: AuthGateway = {
    handle: async () => new Response(null, { status: 404 }),
    getSession: async (headers) => {
      const id = headers.get("x-test-user");
      return id ? { user: { id, name: "Owner", email: "owner@example.test", emailVerified: true }, session: { id: sessionId, expiresAt: new Date(Date.now() + 3600000) } } : null;
    },
  };
  const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const storage = {
    assetsBucket: "private-assets",
    outputsBucket: "private-outputs",
    head: async () => ({ contentLength: bytes.length, contentType: "video/mp4" }),
    get: async () => ({ body: bytes }),
  } as unknown as AssetStorageGateway;
  const freshApp = () => createApi({
    config: loadApiConfig({ APP_ENV: "test", FEATURE_AUTHENTICATION: "true" }),
    environment: env,
    authGateway: auth,
    admin: { database, auth, storage },
  });
  let app = freshApp();
  const get = (path: string, id: ObjectId | null = ownerId, headers: Record<string, string> = {}) =>
    app.request(`/api/v1/admin${path}`, { headers: { ...(id ? { "x-test-user": String(id) } : {}), ...headers } });
  const commands: CommandStartedEvent[] = [];
  const sent = (commandName: string, collection: string) =>
    commands.filter(event => event.commandName === commandName && event.command[commandName] === collection);
  const pipelines = (collection: string) =>
    sent("aggregate", collection).map(event => event.command.pipeline as Document[]);
  const stageIndex = (pipeline: Document[], stage: string) => pipeline.findIndex(row => stage in row);
  const keyed = <T extends Document>(row: T) => ({ ...row, idempotencyKey: String(new ObjectId()) });

  beforeAll(async () => {
    database.client.monitorCommands = true;
    database.client.on("commandStarted", event => commands.push(event));
    await database.connect();
    await ensureMongoIndexes(database);
    await ensureAdminIndexes(database);
  });
  beforeEach(async () => {
    const collections = await database.db.listCollections().toArray();
    for (const { name } of collections) if (!name.startsWith("system.")) await database.db.collection(name).deleteMany({});
    await database.db.collection("users").insertMany([
      { _id: ownerId, name: "Owner", email: "owner@example.test", emailVerified: true, createdAt: new Date() },
      { _id: customerId, name: "Perfume Customer", email: "perfume@example.test", password: "must-never-leak", emailVerified: true, createdAt: new Date() },
      { _id: outsiderId, name: "Outsider", email: "outsider@example.test", emailVerified: true, createdAt: new Date() },
    ]);
    await database.db.collection(A.owners).insertOne({ userId: ownerId, role: "owner", active: true, authenticationPolicy: "password" });
    app = freshApp();
    commands.length = 0;
  });
  afterAll(async () => {
    await database.db.dropDatabase();
    await database.close();
  });

  async function campaignFixture(index = 0) {
    const projectId = new ObjectId(), versionId = new ObjectId(), templateVersionId = new ObjectId(), templateId = new ObjectId();
    await database.db.collection(C.videoTemplateVersions).insertOne({ _id: templateVersionId, templateId, versionNumber: 1 + index, localizedName: { en: "Salon reveal", ar: "كشف الصالون" } });
    await database.db.collection(C.creatorProjects).insertOne({ _id: projectId, userId: customerId, title: `Friday campaign ${index}`, status: "completed", currentWorkingVersionId: versionId, currentAcceptedVersionId: versionId, createdAt: new Date(2026, 8, 1 + index), updatedAt: new Date(2026, 8, 2 + index) });
    await database.db.collection(C.creatorProjectVersions).insertOne({ _id: versionId, projectId, userId: customerId, versionNumber: 1, templateVersionId, configuration: { creatorProject: { durationSeconds: 15, language: "ar", title: "CONFIG-TITLE-LEAK" }, generation: { creativeBrief: { prompt: "SECRET-COMPILED-PROMPT" } } }, createdAt: new Date() });
    const accepted = new ObjectId(), latest = new ObjectId();
    await database.db.collection(C.renderRuns).insertMany([
      { _id: accepted, userId: customerId, projectId, projectVersionId: versionId, status: "completed", chargedCredits: 60, refundStatus: "not_required", createdAt: new Date(2026, 8, 3), completedAt: new Date(2026, 8, 3, 0, 2), outputBucket: "private-outputs", outputObjectKey: `outputs/${index}.mp4` },
      { _id: latest, userId: customerId, projectId, projectVersionId: new ObjectId(), status: "failed", chargedCredits: 40, refundStatus: "refunded", createdAt: new Date(2026, 8, 4) },
    ].map(keyed));
    return { projectId, versionId, templateId, accepted, latest };
  }

  it("pages generations before joining, counts separately and reuses template options", async () => {
    await campaignFixture();
    const first = await (await get("/generation-history?limit=1&page=2")).json();
    await get("/generation-history?limit=1&page=2");
    expect(first).toMatchObject({ total: 2, page: 2, items: [{ template: { name: { en: "Salon reveal" } }, customer: { name: "Perfume Customer" } }] });
    const [pipeline] = pipelines(C.renderRuns);
    expect(stageIndex(pipeline!, "$facet")).toBe(-1);
    expect(stageIndex(pipeline!, "$limit")).toBeLessThan(stageIndex(pipeline!, "$project"));
    expect(stageIndex(pipeline!, "$project")).toBeLessThan(stageIndex(pipeline!, "$lookup"));
    expect(pipeline![stageIndex(pipeline!, "$project")]!.$project.configuration).toBeUndefined();
    expect(sent("count", C.renderRuns)).toHaveLength(2);
    expect(pipelines(C.videoTemplateVersions).filter(row => stageIndex(row, "$group") >= 0)).toHaveLength(1);
  });

  it("resolves search and template filters to ids before touching runs", async () => {
    const { templateId } = await campaignFixture();
    const other = await campaignFixture(1);
    await database.db.collection(C.creatorProjects).updateOne({ _id: other.projectId }, { $set: { title: "Unique launch" } });
    const byEmail = await (await get("/generation-history?search=PERFUME@")).json();
    expect(byEmail.total).toBe(4);
    const byTitle = await (await get("/generation-history?search=unique%20launch")).json();
    expect(byTitle.items.map((row: Document) => row.campaign.id)).toEqual([String(other.projectId), String(other.projectId)]);
    expect((await (await get("/generation-history?search=nobody-matches")).json()).items).toEqual([]);
    commands.length = 0;
    const byTemplate = await (await get(`/generation-history?templateId=${templateId}`)).json();
    expect(byTemplate.total).toBe(1);
    const [pipeline] = pipelines(C.renderRuns);
    expect(pipeline![0]!.$match.projectVersionId.$in).toHaveLength(1);
    const templateVersionIds = (await database.db.collection(C.videoTemplateVersions).find({ templateId }).toArray()).map(row => row._id);
    const covered = await database.db.collection(C.creatorProjectVersions).find({ templateVersionId: { $in: templateVersionIds } }, { projection: { _id: 1 } }).explain("executionStats");
    expect(covered.executionStats.totalDocsExamined).toBe(0);
  });

  it("counts unfiltered lists from metadata, caps filtered counts and keeps pagination truthful", async () => {
    const now = new Date();
    await database.db.collection(C.creditLedger).insertMany(Array.from({ length: ADMIN_LIST_COUNT_CAP + 5 }, () => ({ userId: customerId, kind: "charge", delta: -1, purchaseAllocations: [{ orderId: "private", credits: 1 }], createdAt: now })));
    const all = await (await get("/credits?limit=25")).json();
    expect(all).toMatchObject({ total: ADMIN_LIST_COUNT_CAP + 5 });
    expect(all.totalCapped).toBeUndefined();
    expect(sent("count", C.creditLedger)).toHaveLength(1);
    const filtered = await (await get("/credits?limit=25&status=charge")).json();
    expect(filtered).toMatchObject({ total: ADMIN_LIST_COUNT_CAP, totalCapped: true });
    const beyond = await (await get(`/credits?limit=25&status=charge&page=${ADMIN_LIST_COUNT_CAP / 25 + 1}`)).json();
    expect(beyond.items).toHaveLength(5);
    expect(beyond).toMatchObject({ total: ADMIN_LIST_COUNT_CAP + 5, totalCapped: true });
    expect(await (await get("/credits?limit=25&status=refund")).json()).toMatchObject({ total: 0, items: [] });
    expect(JSON.stringify(all.items)).not.toContain("purchaseAllocations");
    const detail = await (await get(`/credits/${all.items[0].id}`)).json();
    expect(detail.record.purchaseAllocations).toHaveLength(1);
  });

  it("skips label reads when a page has nothing to label", async () => {
    await database.db.collection(A.content).insertOne({ kind: "announcement", title: { en: "x", ar: "x" }, createdAt: new Date() });
    await get("/content");
    expect(sent("find", "users").filter(event => JSON.stringify(event.command.filter).includes("$in"))).toHaveLength(0);
    expect(sent("find", C.creatorProjects)).toHaveLength(0);
  });

  it("links campaign rows in fixed batched reads and adds the accepted run only for the customer tab", async () => {
    const fixtures = [await campaignFixture(0), await campaignFixture(1), await campaignFixture(2)];
    const list = await (await get("/campaigns?limit=25")).json();
    expect(list.items).toHaveLength(3);
    for (const row of list.items) {
      const fixture = fixtures.find(item => String(item.projectId) === row.id)!;
      expect(row).toMatchObject({ latestRunId: String(fixture.latest), templateName: { en: "Salon reveal" } });
      expect(row.acceptedRunId).toBeUndefined();
    }
    expect(pipelines(C.renderRuns)).toHaveLength(1);
    expect(sent("find", C.renderRuns)).toHaveLength(0);
    commands.length = 0;
    const tab = await (await get(`/customers/${customerId}/records/campaigns?limit=25`)).json();
    for (const row of tab.items) {
      const fixture = fixtures.find(item => String(item.projectId) === row.id)!;
      expect(row).toMatchObject({ acceptedRunId: String(fixture.accepted), latestRunId: String(fixture.latest), templateName: { en: "Salon reveal" } });
    }
    expect(pipelines(C.renderRuns)).toHaveLength(2);
    expect(sent("find", C.renderRuns)).toHaveLength(0);
  });

  it("returns a curated campaign view that never carries configuration or storage details", async () => {
    const fixture = await campaignFixture();
    await database.db.collection(C.creatorProjectAssets).insertMany([
      { _id: new ObjectId(), projectId: fixture.projectId, userId: customerId, kind: "product", originalFilename: "front.jpg", mimeType: "image/jpeg", bucket: "private-assets", objectKey: "SECRET-OBJECT-KEY", checksumSha256: "SECRET-CHECKSUM", deletedAt: null },
      { _id: new ObjectId(), projectId: fixture.projectId, userId: customerId, kind: "logo", originalFilename: "gone.png", mimeType: "image/png", deletedAt: new Date(), bucket: "private-assets", objectKey: "gone" },
    ]);
    const response = await get(`/campaigns/${fixture.projectId}`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      record: {
        id: String(fixture.projectId),
        title: "Friday campaign 0",
        status: "completed",
        customer: { id: String(customerId), name: "Perfume Customer", email: "perfume@example.test" },
        templateName: { en: "Salon reveal", ar: "كشف الصالون" },
        durationSeconds: 15,
        language: "ar",
        generation: { latestRunId: String(fixture.latest), acceptedRunId: String(fixture.accepted), status: "failed", creditsUsed: 60 },
      },
      related: { media: [{ filename: "front.jpg", kind: "product", mimeType: "image/jpeg" }] },
    });
    expect(body.related.media).toHaveLength(1);
    const text = JSON.stringify(body);
    for (const secret of ["SECRET-COMPILED-PROMPT", "CONFIG-TITLE-LEAK", "SECRET-OBJECT-KEY", "SECRET-CHECKSUM", "configuration", String(fixture.versionId), "must-never-leak"]) expect(text).not.toContain(secret);
    expect(await database.db.collection("audit_logs").countDocuments({ action: "campaign.inspect", target: String(fixture.projectId) })).toBe(1);
    expect((await get(`/campaigns/${new ObjectId()}`)).status).toBe(404);
    expect((await get(`/campaigns/${fixture.projectId}`, outsiderId)).status).toBe(403);
    expect((await get(`/campaigns/${fixture.projectId}`, null)).status).toBe(401);
  });

  it("serves one template page from one projected version read, identical to the per-record view", async () => {
    await ensureMongoTemplateCatalog(database, LAUNCH_CREATIVE_TEMPLATE_CATALOG);
    commands.length = 0;
    const list = await (await get("/templates?limit=25")).json();
    expect(list.items.length).toBeGreaterThan(1);
    const versionReads = sent("find", C.videoTemplateVersions);
    expect(versionReads).toHaveLength(1);
    expect(versionReads[0]!.command.projection.recipe).toBeUndefined();
    expect(Object.keys(versionReads[0]!.command.projection)).toContain("recipe.executableDefinition.localizedName");
    const rows = await database.db.collection(C.videoTemplates).find({}).toArray();
    const batched = rows.map(row => ({ ...row }));
    await addAdminTemplateViews(database.db, batched);
    const single = rows.map(row => ({ ...row }));
    for (const row of single) await addAdminTemplateView(database.db, row);
    expect(batched).toEqual(single);
    expect(batched.every(row => row.name?.en && row.familyId)).toBe(true);
  });

  it("answers the overview from one run aggregate and caches only aggregate metrics", async () => {
    const now = Date.now();
    await database.db.collection(C.paymentOrders).insertMany([
      { userId: customerId, status: "credited", currency: "KWD", amountMinor: 5000, credits: 100, creditedAt: new Date(now - 60000), createdAt: new Date(now - 60000) },
      { userId: customerId, status: "credited", currency: "KWD", amountMinor: 2000, credits: 40, creditedAt: new Date(now - 5 * 86400000), createdAt: new Date(now - 5 * 86400000) },
      { userId: customerId, status: "failed", currency: "KWD", amountMinor: 9000, credits: 180, creditedAt: null, createdAt: new Date(now - 60000) },
    ].map(keyed));
    await database.db.collection(C.renderRuns).insertMany([
      { status: "completed", createdAt: new Date(now - 60000), completedAt: new Date(now - 30000) },
      { status: "completed", createdAt: new Date(now - 90000), completedAt: new Date(now - 30000) },
      { status: "completed", createdAt: new Date(now - 90000), completedAt: null },
      { status: "failed", createdAt: new Date(now - 60000), failureCode: "provider_timeout" },
      { status: "failed", createdAt: new Date(now - 60000), errorCode: "provider_timeout" },
      { status: "failed", createdAt: new Date(now - 60000), errorCode: "content_policy" },
      { status: "queued", createdAt: new Date(now - 60000) },
      { status: "processing", createdAt: new Date(now - 60000) },
      { status: "cancelled", createdAt: new Date(now - 60000) },
      { status: "completed", createdAt: new Date(now - 40 * 86400000), completedAt: new Date(now - 40 * 86400000) },
    ].map(keyed));
    const first = await (await get("/overview?days=30")).json();
    expect(Object.fromEntries(["queued", "processing", "completed", "failed", "cancelled"].map(status => [status, first.metrics[`runs.${status}`].value]))).toEqual({ queued: 1, processing: 1, completed: 3, failed: 3, cancelled: 1 });
    expect(first.metrics["runs.completed"]).toMatchObject({ status: "available", source: C.renderRuns });
    expect(first.duration).toBeUndefined();
    expect(first.daily).toHaveLength(31);
    expect(first.daily.map((row: { day: string }) => row.day)).toEqual([...new Set(first.daily.map((row: { day: string }) => row.day))].sort());
    expect(first.daily.at(-1).day).toBe(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuwait" }).format(new Date()));
    const total = (key: string) => first.daily.reduce((sum: number, row: Record<string, number>) => sum + row[key]!, 0);
    expect(["completed", "failed", "cancelled", "active", "cashMinor"].map(total)).toEqual([3, 3, 1, 2, 7000]);
    expect(first.metrics.cashCollectedMinor.value).toBe(7000);
    expect(first.metrics.cashCollectedMinor).not.toHaveProperty("days");
    expect(first.metrics.cashCollectedMinor).not.toHaveProperty("_id");
    expect(first.failures).toEqual([{ id: "provider_timeout", count: 2 }, { id: "content_policy", count: 1 }]);
    expect(pipelines(C.renderRuns)).toHaveLength(1);
    await database.db.collection("audit_logs").insertOne({ actorId: ownerId, action: "live.action", target: "x", createdAt: new Date() });
    await database.db.collection(C.renderRuns).insertOne(keyed({ status: "queued", createdAt: new Date() }));
    const second = await (await get("/overview?days=30")).json();
    expect(pipelines(C.renderRuns)).toHaveLength(1);
    expect(second.metrics["runs.queued"].value).toBe(1);
    expect(second.recentActions[0].action).toBe("live.action");
    const other = await (await get("/overview?days=7")).json();
    expect(pipelines(C.renderRuns)).toHaveLength(2);
    expect(other.metrics["runs.queued"].value).toBe(2);
  });

  it("joins customer names only onto the visible page of payments, searching or not", async () => {
    const now = new Date();
    await database.db.collection(C.paymentOrders).insertMany([
      { userId: customerId, status: "credited", currency: "KWD", amountMinor: 500, credits: 10, creditedAt: now, createdAt: now },
      { userId: outsiderId, status: "credited", currency: "KWD", amountMinor: 700, credits: 10, creditedAt: now, createdAt: now },
      { userId: outsiderId, status: "failed", currency: "KWD", amountMinor: 900, credits: 10, creditedAt: null, createdAt: now },
    ].map(keyed));
    await database.db.collection(A.financial).insertMany([
      { userId: customerId, kind: "cash-refund", status: "confirmed", amountMinor: 100, execution: { confirmedAt: now }, createdAt: now },
      { userId: outsiderId, kind: "cash-refund", status: "confirmed", amountMinor: 200, execution: { confirmedAt: now }, createdAt: now },
    ]);
    const plain = await (await get("/payment-history?period=today")).json();
    expect(plain).toMatchObject({ total: 3, totals: { collected: 1200, refunded: 300, net: 900 } });
    expect(plain.items).toHaveLength(3);
    expect(plain.items.map((row: Document) => row.customerEmail).sort()).toEqual(["outsider@example.test", "outsider@example.test", "perfume@example.test"]);
    expect(JSON.stringify(plain)).not.toContain("must-never-leak");
    const lookedUp = [...pipelines(C.paymentOrders), ...pipelines(A.financial)].filter(pipeline => stageIndex(pipeline, "$lookup") >= 0);
    expect(lookedUp).toHaveLength(1);
    expect(stageIndex(lookedUp[0]!, "$limit")).toBeLessThan(stageIndex(lookedUp[0]!, "$lookup"));
    expect(lookedUp[0]![stageIndex(lookedUp[0]!, "$lookup")]!.$lookup.pipeline).toEqual([{ $project: { name: 1, email: 1 } }]);
    commands.length = 0;
    const searched = await (await get("/payment-history?period=today&search=perfume")).json();
    expect(searched).toMatchObject({ total: 1, totals: { collected: 500, refunded: 100, net: 400 } });
    expect(searched.items.map((row: Document) => row.customerEmail)).toEqual(["perfume@example.test"]);
    expect([...pipelines(C.paymentOrders), ...pipelines(A.financial)].filter(pipeline => stageIndex(pipeline, "$lookup") >= 0)).toHaveLength(1);
    expect(await (await get(`/payment-history?period=today&search=perfume&userId=${outsiderId}`)).json()).toMatchObject({ total: 0, items: [] });
    expect(await (await get("/payment-history?period=today&search=nobody")).json()).toMatchObject({ total: 0, items: [], totals: { collected: 0, refunded: 0 } });
  });

  it("audits media opens rather than byte ranges and caches only plain immutable views", async () => {
    const fixture = await campaignFixture();
    const assetId = new ObjectId();
    await database.db.collection(C.creatorProjectAssets).insertOne({ _id: assetId, projectId: fixture.projectId, userId: customerId, kind: "product", mimeType: "image/jpeg", bucket: "private-assets", objectKey: "asset.jpg", deletedAt: null });
    const path = `/media/generation/${fixture.accepted}`;
    const previews = () => database.db.collection("audit_logs").countDocuments({ action: "media.preview", target: String(fixture.accepted) });

    expect((await get(path, null)).status).toBe(401);
    expect((await get(path, outsiderId)).status).toBe(403);
    expect(await previews()).toBe(0);

    const opened = await get(path);
    expect(opened.status).toBe(200);
    expect(new Uint8Array(await opened.arrayBuffer())).toEqual(bytes);
    expect(opened.headers.get("cache-control")).toBe("private, max-age=300");
    expect(opened.headers.get("vary")).toContain("Cookie");
    expect(await previews()).toBe(1);

    const follow = await get(path, ownerId, { range: "bytes=4-7" });
    expect(follow.status).toBe(206);
    expect(new Uint8Array(await follow.arrayBuffer())).toEqual(bytes.slice(4, 8));
    expect(follow.headers.get("cache-control")).toBe("private, max-age=300");
    expect(await previews()).toBe(1);
    expect((await get(path, ownerId, { range: "bytes=0-1" })).status).toBe(206);
    expect(await previews()).toBe(2);

    const crafted = await get(`/media/campaign/${assetId}`, ownerId, { range: "bytes=1-" });
    expect(crafted.status).toBe(206);
    expect(await database.db.collection("audit_logs").countDocuments({ action: "media.preview", target: String(assetId) })).toBe(1);

    const download = await get(`${path}?download=true`);
    expect(download.headers.get("cache-control")).toContain("no-store");
    expect(await database.db.collection("audit_logs").countDocuments({ action: "media.download", target: String(fixture.accepted) })).toBe(1);

    await database.db.collection(A.assurance).insertOne({ userId: ownerId, sessionId, expiresAt: new Date(Date.now() + 60000), recentUntil: new Date(Date.now() + 60000) });
    const restricted = await get(`${path}?restricted=true`);
    expect(restricted.status).toBe(200);
    expect(restricted.headers.get("cache-control")).toContain("no-store");

    await database.db.collection(C.renderRuns).updateOne({ _id: fixture.accepted }, { $set: { privacyErasedAt: new Date() } });
    const erased = await get(path);
    expect(erased.status).toBe(404);
    expect(erased.headers.get("cache-control")).toContain("no-store");
  });
});
