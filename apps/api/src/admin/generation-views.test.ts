import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { createMongoDatabase, COLLECTIONS as C } from "@movprompt/db";
import { AdminGenerationQuerySchema } from "@movprompt/contracts";
import { createGenerationViews, generationSummary } from "./generation-views.js";
import { isRoutineAdminMutation } from "./management-policy.js";
const oid = new ObjectId();
it("never substitutes last edit time for terminal timing", () => {
  const row = { _id: oid, status: "failed", createdAt: new Date("2026-10-01T00:00:00Z"), updatedAt: new Date("2026-10-02T00:00:00Z") };
  expect(generationSummary(row)).toMatchObject({ timing: "unavailable", elapsedSeconds: null, mediaAvailable: false });
  expect(generationSummary({ ...row, finishedAt: new Date("2026-10-01T00:02:18Z") })).toMatchObject({ timing: "finished", elapsedSeconds: 138 });
  expect(generationSummary({ ...row, status: "processing" }, new Date("2026-10-01T00:00:19Z"))).toMatchObject({ timing: "elapsed", elapsedSeconds: 19 });
  expect(generationSummary({ ...row, status: "completed", outputBucket: "private", outputObjectKey: "exact-run.mp4", privacyErasedAt: new Date() }).mediaAvailable).toBe(false);
});
it("rejects arbitrary methods, bodies, archive and unrelated actions", () => {
  const path = `/api/v1/admin/templates/${oid}/state`;
  for (const action of ["archive", "publish", "delete", "__proto__"])
    expect(isRoutineAdminMutation("POST", path, { action, expectedRevision: 1, reason: "Policy test" })).toBe(false);
  expect(isRoutineAdminMutation("DELETE", path, {})).toBe(false);
  expect(isRoutineAdminMutation("POST", `${path}/extra`, {})).toBe(false);
  expect(isRoutineAdminMutation("POST", path, null)).toBe(false);
});
const uri = process.env.ADMIN_TEST_MONGODB_URI;
describe.skipIf(!uri)("generation summaries on MongoDB", () => {
  const database = createMongoDatabase({ uri: uri ?? "mongodb://127.0.0.1:27017/", databaseName: `admin_generation_views_${Date.now()}` });
  beforeAll(async () => { await database.connect(); });
  afterAll(async () => { await database.db.dropDatabase(); await database.close(); });
  it("joins pinned templates and customer names before filtering and pagination", async () => {
    const userId = new ObjectId(), projectId = new ObjectId(), projectVersionId = new ObjectId(), templateVersionId = new ObjectId(), templateId = new ObjectId();
    const db = database.db;
    await db.collection("users").insertOne({ _id: userId, name: "Perfume owner", email: "perfume@example.test" });
    await db.collection(C.creatorProjects).insertOne({ _id: projectId, title: "Friday campaign" });
    await db.collection(C.creatorProjectVersions).insertOne({ _id: projectVersionId, templateVersionId });
    await db.collection(C.videoTemplateVersions).insertMany([
      { _id: templateVersionId, templateId, versionNumber: 1, localizedName: { en: "Original template", ar: "القالب الأصلي" } },
      { _id: new ObjectId(), templateId, versionNumber: 2, localizedName: { en: "Renamed template", ar: "قالب جديد" } },
    ]);
    const runId = new ObjectId();
    await db.collection(C.renderRuns).insertMany([
      { _id: runId, userId, projectId, projectVersionId, status: "completed", createdAt: new Date("2026-10-01T00:00:00Z"), completedAt: new Date("2026-10-01T00:02:18Z"), outputBucket: "private", outputObjectKey: "this-run.mp4" },
      { _id: new ObjectId(), userId, projectId, projectVersionId, status: "failed", createdAt: new Date("2026-10-02"), updatedAt: new Date("2026-10-05") },
      { _id: new ObjectId(), status: "cancelled", createdAt: new Date("2026-10-03") },
    ]);
    const views = createGenerationViews(database);
    const query = AdminGenerationQuerySchema.parse({ search: "PERFUME@", templateId: String(templateId), limit: 1 });
    const page = await views.list(query);
    expect(page.total).toBe(2); expect(page.items).toHaveLength(1);
    expect(page.items[0]?.template.name.en).toBe("Original template");
    expect(page.items[0]?.elapsedSeconds).toBeNull();
    expect((await views.list({ ...query, page: 2 })).items[0]?.id).toBe(String(runId));
    const detail = await views.detail(String(runId));
    expect(detail).toMatchObject({ elapsedSeconds: 138, mediaAvailable: true, customer: { name: "Perfume owner" }, template: { name: { en: "Original template" } } });
    expect(JSON.stringify(detail)).not.toContain("this-run.mp4");
    expect((await views.list(AdminGenerationQuerySchema.parse({ search: "[invalid" }))).total).toBe(0);
    const missing = (await views.list(AdminGenerationQuerySchema.parse({ status: "cancelled" }))).items[0]!;
    expect(missing.customer.id).toBeNull(); expect(missing.template.name.en).toBe("Template unavailable");
  });
});
