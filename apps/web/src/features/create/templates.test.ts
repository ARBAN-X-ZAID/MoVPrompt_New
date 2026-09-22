import { describe, expect, it } from "vitest";
import { CATEGORY_PREVIEW_TEMPLATE_IDS } from "@movprompt/creative-engine";
import { CREATOR_TEMPLATES, DISCOVERABLE_CREATOR_TEMPLATES, PREVIEWED_CREATOR_TEMPLATES, createDraftProject, getCreatorTemplate, hasCreatorImageReference } from "./templates";
import { getCampaignGoalOption, normalizeCreatorResolution } from "./types";
import { buildTemplatePrompt } from "./templateGenerationPrompt";

describe("beginner creator templates", () => {
  it("ships twelve templates in eight launch categories with editable scenes and required client references", () => {
    expect(CREATOR_TEMPLATES).toHaveLength(12);
    expect(new Set(CREATOR_TEMPLATES.map((template) => template.eyebrow))).toHaveLength(8);
    for (const template of CREATOR_TEMPLATES) {
      expect(template.scenes.length).toBeGreaterThanOrEqual(3);
      expect(template.aspectRatios).toContain("9:16");
      expect(template.languages).toContain("ar");
      expect(template.languages).toContain("en");
      expect(template.qualityStatus).toBe("review");
      expect(template.requiredInputs).toContain("primary_reference");
    }
  });

  it("tracks templates with verified video previews", () => {
    expect(PREVIEWED_CREATOR_TEMPLATES).toHaveLength(CATEGORY_PREVIEW_TEMPLATE_IDS.length);
    expect(PREVIEWED_CREATOR_TEMPLATES.every((template) => Boolean(template.previewVideo))).toBe(true);
    expect(PREVIEWED_CREATOR_TEMPLATES.map((template) => template.id)).toEqual(CATEGORY_PREVIEW_TEMPLATE_IDS);
  });

  it("makes every verified motion preview discoverable", () => {
    expect(DISCOVERABLE_CREATOR_TEMPLATES).toHaveLength(CATEGORY_PREVIEW_TEMPLATE_IDS.length);
    expect(DISCOVERABLE_CREATOR_TEMPLATES.map((template) => template.id)).toEqual([...CATEGORY_PREVIEW_TEMPLATE_IDS]);
  });

  it("locks every discoverable template campaign to eight seconds", () => {
    expect(DISCOVERABLE_CREATOR_TEMPLATES).toHaveLength(CATEGORY_PREVIEW_TEMPLATE_IDS.length);
    for (const template of DISCOVERABLE_CREATOR_TEMPLATES) {
      expect(template.duration).toBe(8);
      expect(createDraftProject(template.id).durationSeconds).toBe(8);
    }
  });

  it("creates isolated draft scene data", () => {
    const first = createDraftProject("business-service-promotion");
    const second = createDraftProject("business-service-promotion");
    first.scenes[0].headline = "Changed";

    expect(first.id).not.toBe(second.id);
    expect(second.scenes[0].headline).not.toBe("Changed");
    expect(first.language).toBe("en");
    expect(first.arabicDialect).toBe("kuwaiti");
  });

  it("falls back to the primary template", () => {
    expect(getCreatorTemplate("missing").id).toBe(CREATOR_TEMPLATES[0].id);
  });

  it("uses each template's first campaign goal and matching call to action", () => {
    for (const template of CREATOR_TEMPLATES) {
      const project = createDraftProject(template.id);
      expect(project.goal).toBe(template.goals[0]);
      expect(project.cta).toBe(getCampaignGoalOption(project.goal).defaultCta);
    }
  });

  it("binds every launch prompt to the client image and the selected template recipe", () => {
    for (const template of CREATOR_TEMPLATES) {
      const project = createDraftProject(template.id);
      project.product = {
        ...project.product,
        name: "Client subject",
        images: [{ id: "client-image", name: "client.webp", url: "blob:client", source: "upload", mimeType: "image/webp" }],
      };
      const prompt = buildTemplatePrompt(project);
      expect(prompt).toContain(`using ${template.name}`);
      expect(prompt).toContain("Use @Image1 as the authoritative client reference in every scene");
      expect(prompt).toContain("the uploaded client image controls the subject identity");
      expect(prompt).toContain("Scene recipe:");
    }
  });

  it("starts real-estate and business-service templates with a business source", () => {
    for (const templateId of ["real-estate-property", "business-service-promotion"]) {
      expect(createDraftProject(templateId).promotionKind).toBe("business");
    }
  });

  it("migrates legacy 1080p creator drafts to the supported 720p setting", () => {
    expect(normalizeCreatorResolution("1080p")).toBe("720p");
    expect(normalizeCreatorResolution("720p")).toBe("720p");
    expect(normalizeCreatorResolution("480p")).toBe("480p");
  });

  it("does not treat MIME-less uploaded or sample assets as image references", () => {
    expect(hasCreatorImageReference([
      { id: "legacy-upload", name: "unknown.mov", url: "blob:legacy", source: "upload" },
      { id: "legacy-sample", name: "unknown", url: "/create/legacy", source: "sample" },
    ])).toBe(false);
    expect(hasCreatorImageReference([
      { id: "known-image", name: "product.webp", url: "blob:image", source: "upload", mimeType: "image/webp" },
    ])).toBe(true);
  });
});
