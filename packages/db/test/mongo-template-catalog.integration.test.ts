import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LAUNCH_CREATIVE_TEMPLATE_CATALOG } from "@movprompt/creative-engine";
import { createMongoDatabase, COLLECTIONS } from "../src/mongo-client.js";
import { ensureMongoTemplateCatalog, mongoTemplateCatalogDocuments } from "../src/mongo-template-catalog.js";

describe.skipIf(process.env.MOVPROMPT_TEST_MONGO !== "true")("immutable duration catalog migration", () => {
  const db = createMongoDatabase({ uri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true", databaseName: `movprompt_duration_catalog_test_${Date.now()}` });
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.db.dropDatabase(); await db.close(); });
  it("publishes 39 variants once, leaves v1 and accepted project pointers untouched, and reuses original previews", async () => {
    const legacy = LAUNCH_CREATIVE_TEMPLATE_CATALOG.filter(template => template.id !== "jewelry-product-showcase").map(template => ({ ...template, versionNumber: 1 }));
    await ensureMongoTemplateCatalog(db, legacy);
    const ids = mongoTemplateCatalogDocuments(legacy);
    const historical = await db.collection(COLLECTIONS.videoTemplateVersions).findOne({ id: ids.versions[0]!.id });
    const projectId = "111111111111111111111111";
    await db.collection(COLLECTIONS.creatorProjects).insertOne({ id: projectId, currentAcceptedVersionId: "222222222222222222222222", templateVersionId: ids.versions[0]!.id });
    await ensureMongoTemplateCatalog(db, LAUNCH_CREATIVE_TEMPLATE_CATALOG);
    const first = await db.collection(COLLECTIONS.videoTemplateVersions).find({versionNumber:{$gte:2}}).toArray();
    await ensureMongoTemplateCatalog(db, LAUNCH_CREATIVE_TEMPLATE_CATALOG);
    expect(await db.collection(COLLECTIONS.videoTemplateVersions).countDocuments({})).toBe(27);
    expect(await db.collection(COLLECTIONS.videoTemplateVersions).findOne({id:ids.versions[0]!.id})).toEqual(historical);
    expect(await db.collection(COLLECTIONS.videoTemplateVersions).find({versionNumber:{$gte:2}}).toArray()).toEqual(first);
    expect(first.reduce((sum,version)=>sum+Object.keys(version.recipe.durationRecipes).length,0)).toBe(42);
    for (const version of first.filter(version => version.previewObjectKey)) {
      expect(version.previewRecipeVersion).toBe(version.previewObjectKey === "templates/v3/jewelry-product-showcase-animation.mp4" ? 3 : 1);
      expect(version.previewDurationSeconds).toBe(8);
    }
    expect(await db.collection(COLLECTIONS.creatorProjects).findOne({id:projectId})).toMatchObject({currentAcceptedVersionId:"222222222222222222222222",templateVersionId:ids.versions[0]!.id});
  });
});

describe.skipIf(process.env.MOVPROMPT_TEST_MONGO !== "true")("owner settings across code releases", () => {
  const db = createMongoDatabase({ uri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true", databaseName: `movprompt_template_settings_test_${Date.now()}` });
  const [first, second, third, fourth] = LAUNCH_CREATIVE_TEMPLATE_CATALOG;
  const release = (bump: number) => LAUNCH_CREATIVE_TEMPLATE_CATALOG.map(template => ({ ...template, versionNumber: template.versionNumber + bump }));
  const heads = () => db.collection(COLLECTIONS.videoTemplates);
  const ids = (bump: number) => mongoTemplateCatalogDocuments(release(bump));
  const headId = (index: number) => ids(0).templates[index]!.id;
  const versionId = (index: number, bump: number) => ids(bump).versions[index]!.id;
  const overrides = {
    displayName: { en: "Owner name", ar: "اسم المالك" },
    displayDescription: { en: "Owner description", ar: "وصف المالك" },
    displayOutcome: { en: "Owner outcome", ar: "نتيجة المالك" },
    displayCategory: "brand-story",
    displayDiscoveryCategory: "brand",
    displayTags: ["owner"],
    displaySortOrder: 7,
    enabledLanguages: ["ar"],
    enabledDurations: [15],
  };
  beforeAll(async () => {
    expect([first, second, third, fourth].every(Boolean)).toBe(true);
    await db.connect();
    await ensureMongoTemplateCatalog(db, release(0));
  });
  afterAll(async () => { await db.db.dropDatabase(); await db.close(); });

  it("recovers a head frozen by an old rename and keeps every override", async () => {
    await heads().updateOne({ id: headId(0) }, { $set: { ...overrides, adminManaged: true, publishingState: "unpublished", category: "owner-kept" } });
    await ensureMongoTemplateCatalog(db, release(1));
    const head = await heads().findOne({ id: headId(0) });
    expect(head).toMatchObject({ ...overrides, currentPublishedVersionId: versionId(0, 1), publishingState: "unpublished", category: "owner-kept", publicationPinned: false });
  });

  it("moves the pointer on new heads that only have metadata overrides", async () => {
    await heads().updateOne({ id: headId(1) }, { $set: overrides });
    await ensureMongoTemplateCatalog(db, release(2));
    const head = await heads().findOne({ id: headId(1) });
    expect(head).toMatchObject({ ...overrides, currentPublishedVersionId: versionId(1, 2), publishingState: "published" });
    expect(head?.adminManaged).toBeUndefined();
  });

  it("leaves a publication the owner pinned where it is", async () => {
    const pinned = versionId(2, 0);
    await heads().updateOne({ id: headId(2) }, { $set: { ...overrides, adminManaged: true, publicationPinned: true, currentPublishedVersionId: pinned } });
    await ensureMongoTemplateCatalog(db, release(3));
    expect(await heads().findOne({ id: headId(2) })).toMatchObject({ ...overrides, currentPublishedVersionId: pinned, publicationPinned: true });
  });

  it("pins a pre-marker rollback from its audit entry and scans only once", async () => {
    const rolledBack = versionId(3, 0);
    await heads().updateOne({ id: headId(3) }, { $set: { adminManaged: true, currentPublishedVersionId: rolledBack } });
    await heads().updateOne({ id: headId(3) }, { $unset: { publicationPinned: "" } });
    await db.db.collection("audit_logs").insertOne({ action: "template.rollback", target: headId(3), outcome: "succeeded", createdAt: new Date() });
    await ensureMongoTemplateCatalog(db, release(4));
    expect(await heads().findOne({ id: headId(3) })).toMatchObject({ currentPublishedVersionId: rolledBack, publicationPinned: true });
    await db.db.collection("audit_logs").deleteMany({});
    await ensureMongoTemplateCatalog(db, release(5));
    expect(await heads().findOne({ id: headId(3) })).toMatchObject({ currentPublishedVersionId: rolledBack, publicationPinned: true });
  });
});
