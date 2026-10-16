import { describe, expect, it } from "vitest";
import { DISCOVERABLE_CREATOR_TEMPLATES, createDraftProject, projectKeepingContentForTemplate } from "./templates";
import { TEMPLATE_PLACEMENT, templateDetailPath, templateLibraryPath, templateSection } from "./templatePlacement";

describe("explicit catalog placement", () => {
  it("assigns the 15 previewed items to Templates and the brand ad form to Ad Studio", () => {
    const templates = Object.keys(TEMPLATE_PLACEMENT).filter(id => TEMPLATE_PLACEMENT[id] === "templates");
    expect(templates.sort()).toEqual(DISCOVERABLE_CREATOR_TEMPLATES.map(t => t.id).sort());
    expect(templates).toHaveLength(15);
    expect(Object.keys(TEMPLATE_PLACEMENT).filter(id => TEMPLATE_PLACEMENT[id] === "ad-studio")).toEqual(["ad-studio-brand-ad"]);
    expect(templateSection("future-custom-form")).toBeUndefined();
    expect(templateSection("toString")).toBeUndefined();
  });

  it("keeps canonical detail and return paths together", () => {
    expect(templateDetailPath("female-product-review")).toBe("/templates/female-product-review");
    expect(templateLibraryPath("product-with-model-ad")).toBe("/templates");
    expect(templateLibraryPath("jewelry-product-showcase")).toBe("/templates");
    expect(templateLibraryPath("ad-studio-brand-ad")).toBe("/ad-studio");
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
