import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { getCreativeTemplate } from "@movprompt/creative-engine";
import { createDraftProject } from "./templates";
import { usePinnedTemplate } from "./usePinnedTemplate";
const mocks = vi.hoisted(() => ({
  getTemplate: vi.fn(),
  getTemplateVersion: vi.fn(),
}));
vi.mock("@/lib/api/portableApiClient", () => ({ portableCreatorApi: mocks }));
vi.mock("./templateCatalogMapper", () => ({
  creatorTemplateFromCatalog: vi.fn(),
}));
const id = "a".repeat(24);
describe("immutable template pin hydration", () => {
  it("verifies a cached recipe and restores server directions without changing customer copy", async () => {
    const definition = structuredClone(
      getCreativeTemplate("premium-phone-reveal"),
    );
    definition.versionNumber = 7;
    definition.visualSystem = "Canonical saved studio";
    mocks.getTemplateVersion.mockResolvedValue({
      versionId: id,
      slug: "phone-campaign",
      executableDefinition: definition,
    });
    const draft = {
      ...createDraftProject(definition.id),
      pinnedTemplateVersionId: id,
      templateDefinition: {
        ...definition,
        visualSystem: "Stale client directions",
      },
      cta: " Exact message 20% ",
      displayCopy: {
        version: 1 as const,
        openingMessage: "",
        offer: "خصم ٢٠٪",
        closingMessage: " Exact message 20% ",
      },
    };
    const hook = renderHook(() => {
      const [project, setProject] = useState(draft);
      return { project, pin: usePinnedTemplate(project, setProject, true) };
    });
    expect(hook.result.current.pin.ready).toBe(false);
    await waitFor(() => expect(hook.result.current.pin.ready).toBe(true));
    expect(mocks.getTemplateVersion).toHaveBeenCalledWith(id);
    expect(hook.result.current.project.templateDefinition.visualSystem).toBe(
      "Canonical saved studio",
    );
    expect(hook.result.current.project.displayCopy).toEqual(draft.displayCopy);
    expect(hook.result.current.project.cta).toBe(draft.cta);
  });
  it("preserves a selected unsupported length and ignores a delayed response after changing projects", async () => {
    const definition = {
      ...getCreativeTemplate("premium-phone-reveal"),
      supportedDurations: [8] as const,
    };
    let resolve!: (value: unknown) => void;
    mocks.getTemplate.mockReturnValue(
      new Promise((value) => {
        resolve = value;
      }),
    );
    const draft = { ...createDraftProject(definition.id), durationSeconds: 20 };
    const hook = renderHook(() => {
      const [project, setProject] = useState(draft);
      return {
        project,
        setProject,
        pin: usePinnedTemplate(project, setProject, true, "phone-campaign"),
      };
    });
    await act(async () =>
      resolve({
        versionId: id,
        slug: "phone-campaign",
        executableDefinition: definition,
      }),
    );
    expect(hook.result.current.project.durationSeconds).toBe(20);
    expect(hook.result.current.pin.ready).toBe(true);
    let late!: (value: unknown) => void;
    mocks.getTemplate.mockReturnValue(
      new Promise((value) => {
        late = value;
      }),
    );
    await act(async () =>
      hook.result.current.setProject({ ...draft, id: "another-project" }),
    );
    await act(async () =>
      hook.result.current.setProject({ ...draft, id: "third-project" }),
    );
    await act(async () =>
      late({
        versionId: id,
        slug: "old-campaign",
        executableDefinition: definition,
      }),
    );
    expect(hook.result.current.project.id).toBe("third-project");
  });
});
