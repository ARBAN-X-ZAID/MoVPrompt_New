import { describe, expect, it, vi } from "vitest";
import { PublicTemplateSchema } from "@movprompt/contracts";
import { LAUNCH_CREATIVE_TEMPLATE_CATALOG } from "@movprompt/creative-engine";
import { COLLECTIONS, mongoTemplateCatalogDocuments, type MongoDatabase } from "@movprompt/db";
import { createMongoCreatorRepository } from "./mongo-creator-repository.js";

describe("published template projection", () => {
  it.each([false, true])("projects the verified jewelry preview without rewriting an immutable poster-only version (%s)", async (previouslyPosterOnly) => {
    const documents = mongoTemplateCatalogDocuments(LAUNCH_CREATIVE_TEMPLATE_CATALOG);
    if (previouslyPosterOnly) {
      const jewelryId = documents.templates.find(template => template.slug === "jewelry-product-showcase")!.id;
      const storedJewelry = documents.versions.find(version => version.templateId === jewelryId)!;
      storedJewelry.previewObjectKey = null;
      delete storedJewelry.previewDurationSeconds;
      delete storedJewelry.previewRecipeVersion;
    }
    const storedBefore = structuredClone(documents.versions);
    const templates = {
      find: vi.fn(() => ({ sort: () => ({ toArray: async () => documents.templates }) })),
    };
    const versions = {
      findOne: vi.fn(async ({ id }: { id: string }) => documents.versions.find(version => version.id === id) ?? null),
    };
    const database = {
      collection: (name: string) => name === COLLECTIONS.videoTemplates ? templates : name === COLLECTIONS.videoTemplateVersions ? versions : {},
    } as unknown as MongoDatabase;
    const published = await createMongoCreatorRepository(database).listPublishedTemplates({});
    expect(documents.versions).toEqual(storedBefore);
    expect(published).toHaveLength(13);
    for (const template of published) expect(PublicTemplateSchema.safeParse(template).success).toBe(true);
    const jewelry = published.find(template => template.slug === "jewelry-product-showcase")!;
    expect(jewelry).toMatchObject({ supportedDurations: [8, 15, 20], photoPolicy: { groups: [{ role: "subject", min: 1, max: 1 }] }, previewAvailable: true, posterAvailable: true });
    expect(jewelry.previewDurationSeconds).toBe(8);
    expect(jewelry.previewRecipeVersion).toBe(3);
    expect(Object.keys(jewelry.durationRecipes!)).toEqual(["8", "15", "20"]);
    for (const template of published.filter(template => template.previewAvailable)) {
      expect(template.previewDurationSeconds).toBe(8);
      expect(template.previewRecipeVersion).toBe(template.slug === "jewelry-product-showcase" ? 3 : 1);
    }
  });
});
