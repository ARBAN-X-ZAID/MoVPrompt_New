import { describe, expect, it } from "vitest";
import { DISCOVERABLE_CREATOR_TEMPLATES, createDraftProject, projectKeepingContentForTemplate } from "./templates";
import { TEMPLATE_PLACEMENT, templateDetailPath, templateLibraryPath, templateSection } from "./templatePlacement";

describe("explicit catalog placement", () => {
  it("assigns all 15 current items once, with 13 Templates and two Ad Studio items", () => {
    expect(Object.keys(TEMPLATE_PLACEMENT).sort()).toEqual(DISCOVERABLE_CREATOR_TEMPLATES.map(t => t.id).sort());
    expect(Object.values(TEMPLATE_PLACEMENT).filter(section => section === "templates")).toHaveLength(13);
    expect(Object.entries(TEMPLATE_PLACEMENT).filter(([, section]) => section === "ad-studio").map(([id]) => id)).toEqual(["female-product-review", "product-with-model-ad"]);
    expect(templateSection("future-custom-form")).toBeUndefined();
    expect(templateSection("toString")).toBeUndefined();
  });

  it("keeps canonical detail and return paths together", () => {
    expect(templateDetailPath("female-product-review")).toBe("/ad-studio/female-product-review");
    expect(templateLibraryPath("product-with-model-ad")).toBe("/ad-studio");
    expect(templateLibraryPath("jewelry-product-showcase")).toBe("/templates");
  });

  it("does not change project identity, photos or facts when moving across sections", () => {
    const project = createDraftProject("female-product-review");
    project.durationSeconds = 15;
    project.product.images = [
      { id: "product", name: "item.png", url: "blob:item", source: "upload", referenceRole: "subject", checksum: "unchanged" },
      { id: "presenter", name: "presenter.png", url: "blob:presenter", source: "upload", referenceRole: "character", checksum: "character-unchanged", personRightsConfirmed: true },
    ];
    project.product.name = "Confirmed product";
    project.offer = "Confirmed offer";
    const next = projectKeepingContentForTemplate(project, "jewelry-product-showcase");
    expect(next.id).toBe(project.id);
    expect(next.product).toEqual(project.product);
    expect(next.offer).toBe(project.offer);
    expect(next.durationSeconds).toBe(15);
  });
});
