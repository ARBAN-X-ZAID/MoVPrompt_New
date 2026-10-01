import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LAUNCH_CREATIVE_TEMPLATE_CATALOG } from "@movprompt/creative-engine";
import { createMongoDatabase, COLLECTIONS } from "../src/mongo-client.js";
import { ensureMongoTemplateCatalog, mongoTemplateCatalogDocuments } from "../src/mongo-template-catalog.js";

describe.skipIf(process.env.MOVPROMPT_TEST_MONGO !== "true")("immutable duration catalog migration", () => {
  const db = createMongoDatabase({ uri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true", databaseName: `movprompt_duration_catalog_test_${Date.now()}` });
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.db.dropDatabase(); await db.close(); });
  it("publishes 36 variants once, leaves v1 and accepted project pointers untouched, and reuses original previews", async () => {
    const legacy = LAUNCH_CREATIVE_TEMPLATE_CATALOG.map(template => ({ ...template, versionNumber: 1 }));
    await ensureMongoTemplateCatalog(db, legacy);
    const ids = mongoTemplateCatalogDocuments(legacy);
    const historical = await db.collection(COLLECTIONS.videoTemplateVersions).findOne({ id: ids.versions[0]!.id });
    const projectId = "111111111111111111111111";
    await db.collection(COLLECTIONS.creatorProjects).insertOne({ id: projectId, currentAcceptedVersionId: "222222222222222222222222", templateVersionId: ids.versions[0]!.id });
    await ensureMongoTemplateCatalog(db, LAUNCH_CREATIVE_TEMPLATE_CATALOG);
    const first = await db.collection(COLLECTIONS.videoTemplateVersions).find({versionNumber:{$gte:2}}).toArray();
    await ensureMongoTemplateCatalog(db, LAUNCH_CREATIVE_TEMPLATE_CATALOG);
    expect(await db.collection(COLLECTIONS.videoTemplateVersions).countDocuments({})).toBe(24);
    expect(await db.collection(COLLECTIONS.videoTemplateVersions).findOne({id:ids.versions[0]!.id})).toEqual(historical);
    expect(await db.collection(COLLECTIONS.videoTemplateVersions).find({versionNumber:{$gte:2}}).toArray()).toEqual(first);
    expect(first.reduce((sum,version)=>sum+Object.keys(version.recipe.durationRecipes).length,0)).toBe(36);
    expect(first.every(version=>version.previewRecipeVersion===1 && version.previewDurationSeconds===8)).toBe(true);
    expect(await db.collection(COLLECTIONS.creatorProjects).findOne({id:projectId})).toMatchObject({currentAcceptedVersionId:"222222222222222222222222",templateVersionId:ids.versions[0]!.id});
  });
});
