import { describe, expect, it, vi } from "vitest";
import { CATEGORY_PREVIEW_TEMPLATE_IDS, LAUNCH_CREATIVE_TEMPLATE_CATALOG, getVerifiedTemplatePreview } from "@movprompt/creative-engine";
import { COLLECTIONS, type MongoDatabase } from "../src/mongo-client.js";
import { ensureMongoTemplateCatalog, mongoTemplateCatalogDocuments } from "../src/mongo-template-catalog.js";

describe("MongoDB template catalog", () => {
  it("maps every creative template to one published template and immutable version", () => {
    const now = new Date("2026-09-14T10:00:00.000Z");
    const first = mongoTemplateCatalogDocuments(LAUNCH_CREATIVE_TEMPLATE_CATALOG, now);
    const replay = mongoTemplateCatalogDocuments(LAUNCH_CREATIVE_TEMPLATE_CATALOG, now);

    expect(first.templates).toHaveLength(14);
    expect(first.versions).toHaveLength(14);
    expect(first.versions.map(version => version.versionNumber)).toEqual(LAUNCH_CREATIVE_TEMPLATE_CATALOG.map(template => template.id === "female-product-review" ? 4 : template.id === "jewelry-product-showcase" ? 3 : 2));
    expect(first.versions.reduce((sum, version) => sum + Object.keys(version.recipe.durationRecipes ?? {}).length, 0)).toBe(42);
    expect(new Set(first.versions.map((version) => version.id)).size).toBe(14);
    expect(replay.versions.map((version) => version.id)).toEqual(first.versions.map((version) => version.id));
    expect(first.templates.every((template) => template.publishingState === "published")).toBe(true);
    expect(first.templates.map((template) => template.slug)).toEqual(expect.arrayContaining([
      "premium-phone-reveal",
      "restaurant-food-hero",
      "fashion-product-showcase",
      "new-york-billboard-takeover",
    ]));
    const originalPreviews = CATEGORY_PREVIEW_TEMPLATE_IDS.filter(id => id !== "product-with-model-ad");
    expect(first.versions.filter((version) => version.previewObjectKey)).toHaveLength(originalPreviews.length);
    for (const templateId of originalPreviews) {
      const template = first.templates.find((entry) => entry.slug === templateId)!;
      expect(first.versions.find((version) => version.templateId === template.id)?.previewObjectKey).toBe(getVerifiedTemplatePreview(templateId)!.objectKey);
    }
    for (const template of first.templates) {
      const version = first.versions.find((entry) => entry.templateId === template.id)!;
      expect(version.posterObjectKey).toBe(`templates/v1/${template.slug}.${template.slug === "jewelry-product-showcase" ? "png" : "jpg"}`);
    }
    const jewelry = first.templates.find((template) => template.slug === "jewelry-product-showcase")!;
    const jewelryVersion = first.versions.find((version) => version.templateId === jewelry.id)!;
    expect(jewelryVersion.previewObjectKey).toBe("templates/v3/jewelry-product-showcase-animation.mp4");
    expect(jewelryVersion.previewRecipeVersion).toBe(3);
    expect(jewelryVersion.previewDurationSeconds).toBe(8);
    expect(first.templates.every((template) => first.versions.some((version) => version.id === template.currentPublishedVersionId))).toBe(true);
    const foodTemplate = first.templates.find((template) => template.slug === "restaurant-food-hero")!;
    expect(first.versions.find((version) => version.templateId === foodTemplate.id)).toMatchObject({
      supportedMarkets: ["KW"],
      recipe: {
        goals: expect.arrayContaining(["launch"]),
        qualityStatus: "review",
        requiredInputs: expect.arrayContaining(["primary_reference"]),
      },
    });
  });

  it("archives removed launch entries and never deletes historical recipe versions", async () => {
    const versionCollection = { bulkWrite: vi.fn(async () => ({})), deleteMany: vi.fn(async () => ({})) };
    const templateCollection = { bulkWrite: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({})), deleteMany: vi.fn(async () => ({})) };
    const database = {
      collection(name: string) {
        return name === COLLECTIONS.videoTemplateVersions ? versionCollection : templateCollection;
      },
    } as unknown as MongoDatabase;

    await ensureMongoTemplateCatalog(database, LAUNCH_CREATIVE_TEMPLATE_CATALOG, { prune: true });

    expect(templateCollection.updateMany).toHaveBeenCalledWith(
      { id: { $nin: expect.arrayContaining(LAUNCH_CREATIVE_TEMPLATE_CATALOG.map((template) => expect.any(String))) } },
      { $set: { publishingState: "archived", updatedAt: expect.any(Date) } },
    );
    expect(versionCollection.deleteMany).not.toHaveBeenCalled();
    const operations = vi.mocked(versionCollection.bulkWrite).mock.calls[0] as unknown as [Array<{ updateOne: { update: Record<string, unknown> } }>];
    expect(operations[0].every(operation => Object.keys(operation.updateOne.update).join() === "$setOnInsert")).toBe(true);
    expect(templateCollection.deleteMany).not.toHaveBeenCalled();
  });
});
