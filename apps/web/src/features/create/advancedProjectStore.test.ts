import { describe, expect, it, vi } from "vitest";

import { PortableApiError } from "@/lib/api/portableApiClient";
import { persistPortableAdvancedProject } from "./advancedProjectStore";

const projectId = "d7776f1f-60e3-4fb2-b0a4-5954145e0379";
const draftId = "2c18a111-b139-4cc7-b237-edb4a863095f";
const versionId = "f95d3184-1707-438f-af1d-0ea0f3676045";
const templateVersionId = "5a8231bc-9eb3-4cf5-9f0f-a970d5ef1494";
const now = "2026-08-14T12:00:00.000Z";

const version = {
  id: versionId,
  projectId,
  parentVersionId: null,
  templateVersionId,
  mode: "advanced" as const,
  versionNumber: 1,
  configuration: { generation: { prompt: "Premium macro", references: [] } },
  productRecipe: {},
  campaignRecipe: {},
  changeReason: null,
  createdAt: now,
};
const project = {
  id: projectId,
  title: "Advanced campaign",
  mode: "advanced" as const,
  status: "ready" as const,
  currentWorkingVersionId: versionId,
  currentAcceptedVersionId: null,
  latestRenderRunId: null,
  latestRenderProjectVersionId: null,
  latestRenderRunStatus: null,
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
  currentVersion: version,
  versionCount: 1,
  outputCount: 0,
};

const input = {
  draftId,
  title: "Advanced campaign",
  sourceTemplateVersionId: "luxury-product-reveal",
  configuration: { generation: { prompt: "Premium macro", references: [] } },
  productRecipe: { name: "Kinza", ignored: undefined },
  campaignRecipe: { aspectRatio: "4:5", resolution: "720p" },
  operationId: "6b7e89cc-2585-44c7-be20-712d50caa6c0",
};

describe("portable Advanced project persistence", () => {
  it("claims a guest draft through the portable API and resolves a template slug", async () => {
    const api = {
      getProject: vi.fn().mockRejectedValue(new PortableApiError("Not found", "project_not_found", false, undefined, 404)),
      getTemplate: vi.fn().mockResolvedValue({ versionId: templateVersionId }),
      claimDraft: vi.fn().mockResolvedValue(project),
      createVersion: vi.fn(),
    };
    const saved = await persistPortableAdvancedProject(input, api as never);
    expect(saved).toEqual({ project, version });
    expect(api.claimDraft).toHaveBeenCalledWith(expect.objectContaining({
      draftId,
      mode: "advanced",
      templateVersionId,
      productRecipe: { name: "Kinza" },
      campaignRecipe: { aspectRatio: "4:5", resolution: "720p" },
    }));
    expect(api.createVersion).not.toHaveBeenCalled();
  });

  it("forks an immutable Advanced version for an existing owned project", async () => {
    const nextVersion = { ...version, id: "7dadf072-0ffd-4273-aeb6-7d59a90b9f1b", parentVersionId: versionId, versionNumber: 2 };
    const api = {
      getProject: vi.fn().mockResolvedValue(project),
      getTemplate: vi.fn(),
      claimDraft: vi.fn(),
      createVersion: vi.fn().mockResolvedValue(nextVersion),
    };
    const saved = await persistPortableAdvancedProject({ ...input, draftId: projectId }, api as never);
    expect(saved).toEqual({ project, version: nextVersion });
    expect(api.createVersion).toHaveBeenCalledWith(
      projectId,
      expect.objectContaining({
        parentVersionId: versionId,
        templateVersionId,
        mode: "advanced",
      }),
      `advanced-version:${input.operationId}`,
    );
    expect(api.claimDraft).not.toHaveBeenCalled();
  });
});
