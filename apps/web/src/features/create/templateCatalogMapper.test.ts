import { describe, expect, it } from "vitest";
import type { PublicTemplate } from "@movprompt/contracts";
import { CREATOR_TEMPLATES, getCreatorTemplate } from "./templates";
import { creatorTemplateFromCatalog } from "./templateCatalogMapper";

describe("MongoDB catalog template media", () => {
  it("matches each recipe by slug when the public ID is an ObjectId", () => {
    for (const local of CREATOR_TEMPLATES) {
      const published = { id: "66e6d8e7c51fa82b8e426931", slug: local.id, name: { en: local.name, ar: local.nameAr }, description: { en: local.description, ar: local.descriptionAr }, category: local.eyebrow, discoveryCategory: local.discoveryCategory, outcome: local.bestFor, durationSeconds: local.duration, supportedLanguages: local.languages, supportedRatios: local.aspectRatios, tags: local.tags, verticals: local.verticals, goals: local.goals, dialectPolicy: { register: local.dialectRegister }, qualityStatus: local.qualityStatus, scenes: [] } as PublicTemplate;
      const mapped = creatorTemplateFromCatalog(published);
      expect(mapped.id).toBe(published.slug);
      expect(getCreatorTemplate(mapped.id).name).toBe(local.name);
      expect(mapped.previewVideo).toBe(local.previewVideo);
      expect(mapped.poster).toBe(local.poster);
      expect(mapped.scenes).toEqual(local.scenes);
    }
  });
});
