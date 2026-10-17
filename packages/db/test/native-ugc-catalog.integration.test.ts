import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AD_STUDIO_BRAND_AD_RECIPE, AD_STUDIO_BRAND_AD_RECIPE_V1, LAUNCH_CREATIVE_TEMPLATE_CATALOG, LEGACY_UGC_RECIPE_V3 } from "@movprompt/creative-engine";
import { createMongoDatabase, COLLECTIONS } from "../src/mongo-client.js";
import { ensureMongoTemplateCatalog } from "../src/mongo-template-catalog.js";

describe.skipIf(process.env.MOVPROMPT_TEST_MONGO !== "true")("native UGC isolated immutable catalog publication", () => {
  const db = createMongoDatabase({ uri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27028/?replicaSet=rs0&directConnection=true", databaseName: `movprompt_native_ugc_test_${Date.now()}` });
  beforeAll(() => db.connect());
  afterAll(async () => { await db.db.dropDatabase(); await db.close(); });
  it("adds exactly two versions, preserves every historical version and republishes idempotently", async () => {
    const before = [...LAUNCH_CREATIVE_TEMPLATE_CATALOG.map(template => template.id === "female-product-review" ? LEGACY_UGC_RECIPE_V3 : template), AD_STUDIO_BRAND_AD_RECIPE_V1];
    await ensureMongoTemplateCatalog(db, before);
    const oldVersions = await db.collection(COLLECTIONS.videoTemplateVersions).find({}).sort({ id: 1 }).toArray();
    const after = [...LAUNCH_CREATIVE_TEMPLATE_CATALOG, AD_STUDIO_BRAND_AD_RECIPE];
    await ensureMongoTemplateCatalog(db, after);
    expect(await db.collection(COLLECTIONS.videoTemplateVersions).countDocuments({})).toBe(oldVersions.length + 2);
    for (const original of oldVersions) expect(await db.collection(COLLECTIONS.videoTemplateVersions).findOne({ id: original.id })).toEqual(original);
    const added = await db.collection(COLLECTIONS.videoTemplateVersions).find({ id: { $nin: oldVersions.map(version => version.id) } }).toArray();
    expect(added.map(version => version.versionNumber).sort()).toEqual([2, 4]);
    await ensureMongoTemplateCatalog(db, after);
    expect(await db.collection(COLLECTIONS.videoTemplateVersions).countDocuments({})).toBe(oldVersions.length + 2);
  });
});
