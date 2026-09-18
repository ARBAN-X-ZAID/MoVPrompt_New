import { describe, expect, it, vi } from "vitest";
import { CATEGORY_PREVIEW_TEMPLATE_IDS, LAUNCH_CREATIVE_TEMPLATE_CATALOG } from "@movprompt/creative-engine";
import { COLLECTIONS, type MongoDatabase } from "../src/mongo-client.js";
import { ensureMongoTemplateCatalog, mongoTemplateCatalogDocuments } from "../src/mongo-template-catalog.js";

describe("MongoDB template catalog", () => {
  it("maps every creative template to one published template and immutable version", () => {
    const now = new Date("2026-09-14T10:00:00.000Z");
    const first = mongoTemplateCatalogDocuments(LAUNCH_CREATIVE_TEMPLATE_CATALOG, now);
    const replay = mongoTemplateCatalogDocuments(LAUNCH_CREATIVE_TEMPLATE_CATALOG, now);

    expect(first.templates).toHaveLength(11);
    expect(first.versions).toHaveLength(11);
    expect(new Set(first.versions.map((version) => version.id)).size).toBe(11);
    expect(replay.versions.map((version) => version.id)).toEqual(first.versions.map((version) => version.id));
    expect(first.templates.every((template) => template.publishingState === "published")).toBe(true);
    expect(first.templates.map((template) => template.slug)).toEqual(expect.arrayContaining([
      "premium-phone-reveal",
      "restaurant-food-hero",
      "fashion-product-showcase",
      "new-york-billboard-takeover",
    ]));
    expect(first.versions.filter((version) => version.previewObjectKey)).toHaveLength(CATEGORY_PREVIEW_TEMPLATE_IDS.length);
    for (const templateId of CATEGORY_PREVIEW_TEMPLATE_IDS) {
      const template = first.templates.find((entry) => entry.slug === templateId)!;
      expect(first.versions.find((version) => version.templateId === template.id)?.previewObjectKey).toBe(`templates/v1/${templateId}.mp4`);
    }
    expect(first.versions.every((version) => version.posterObjectKey === `templates/v1/${LAUNCH_CREATIVE_TEMPLATE_CATALOG.find((template) => first.templates.find((entry) => entry.id === version.templateId)?.slug === template.slug)!.id}.jpg`)).toBe(true);
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
    expect(templateCollection.deleteMany).not.toHaveBeenCalled();
  });
});
