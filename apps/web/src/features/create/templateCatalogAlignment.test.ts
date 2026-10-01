import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCreativeTemplate } from "@movprompt/creative-engine";

const api = vi.hoisted(() => ({ getTemplate: vi.fn(), getProject: vi.fn(), createVersion: vi.fn(), assetDownload: vi.fn() }));
vi.mock("@/lib/api/portableApiClient", async original => ({ ...await original<object>(), portableCreatorApi: api }));
vi.mock("@/config/features", () => ({ isFeatureEnabled: () => true }));
import { portableConfiguration, resolvePortableTemplateVersionId, syncCreatorProject } from "./projectStore";
import { createDraftProject } from "./templates";

describe("browser/catalog recipe alignment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });
  it("rejects a v1 catalog before pairing it with a v2 campaign", async () => {
    api.getTemplate.mockResolvedValue({ versionId: "old", versionNumber: 1 });
    await expect(resolvePortableTemplateVersionId("fashion-product-showcase")).rejects.toMatchObject({ code: "template_catalog_outdated", retryable: true });
  });
  it("requires all three published duration variants, not just a version number", async () => {
    const template = getCreativeTemplate("fashion-product-showcase");
    api.getTemplate.mockResolvedValue({ versionId: "incomplete", versionNumber: 2, durationRecipes: { 8: template.durationRecipes!["8"] } });
    await expect(resolvePortableTemplateVersionId(template.id)).rejects.toMatchObject({ code: "template_catalog_outdated" });
  });
  it("resolves the current immutable version after catalog synchronization", async () => {
    const template = getCreativeTemplate("fashion-product-showcase");
    api.getTemplate.mockResolvedValue({ versionId: "current", versionNumber: template.versionNumber, durationRecipes: template.durationRecipes });
    await expect(resolvePortableTemplateVersionId(template.id)).resolves.toBe("current");
  });
  it.each(["old", "current"])("only reuses an unchanged campaign when its catalog version is current (%s)", async templateVersionId => {
    const project = createDraftProject("fashion-product-showcase");
    project.product = {
      ...project.product,
      sourceType: "upload",
      name: "Striped shirt",
      images: [{ id: "photo-1", name: "shirt.jpg", url: "", storagePath: "creator-assets/user/project/shirt", mimeType: "image/jpeg", source: "upload", selected: true, referenceRole: "subject" }],
    };
    const configuration = portableConfiguration(project);
    const template = getCreativeTemplate(project.templateId);
    api.getTemplate.mockResolvedValue({ versionId: "current", versionNumber: template.versionNumber, durationRecipes: template.durationRecipes });
    api.getProject.mockResolvedValue({
      id: project.id, title: project.title, status: "draft", createdAt: project.createdAt,
      currentWorkingVersionId: "saved-version",
      currentVersion: { id: "saved-version", versionNumber: 1, templateVersionId, configuration },
    });
    api.assetDownload.mockResolvedValue("/shirt.jpg");
    api.createVersion.mockResolvedValue({ id: "recovered-version", versionNumber: 2 });

    const result = await syncCreatorProject(project, "user-one");
    expect(result.product).toEqual(project.product);
    if (templateVersionId === "current") {
      expect(api.createVersion).not.toHaveBeenCalled();
      expect(result.versionId).toBe("saved-version");
    } else {
      expect(api.createVersion).toHaveBeenCalledWith(project.id, expect.objectContaining({
        parentVersionId: "saved-version", templateVersionId: "current", configuration,
      }), `project-save:${project.id}:current:${project.updatedAt.replace(/[^A-Za-z0-9]/g, "")}`);
      expect(result.versionId).toBe("recovered-version");
    }
  });
});
