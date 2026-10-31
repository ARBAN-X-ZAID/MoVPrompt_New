import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatorProjectRecord, ProjectLibraryResponse } from "@movprompt/contracts";

import { portableCreatorApi } from "@/lib/api/portableApiClient";
import { createDraftProject } from "./templates";
import {
  buildPortableGenerationConfiguration,
  getLocalCreatorProject,
  imageReferencesForAdvancedHandoff,
  listLocalCreatorProjects,
  loadCreatorProjectLibrary,
  portableProductRecipe,
  saveLocalCreatorProject,
  subscribeToCreatorProjects,
} from "./projectStore";

describe("creator project local cache", () => {
  beforeEach(() => localStorage.clear());

  it("never persists a signed render URL", () => {
    const project = createDraftProject();
    const active = saveLocalCreatorProject({
      ...project,
      status: "review",
      renderRunId: "44444444-4444-4444-8444-444444444444",
      jobId: "44444444-4444-4444-8444-444444444444",
      videoUrl: "http://127.0.0.1:9000/creator-outputs/signed.mp4?expires=soon",
    }, "user-one");

    expect(active.videoUrl).toContain("signed.mp4");
    expect(listLocalCreatorProjects("user-one")[0]).toMatchObject({
      renderRunId: "44444444-4444-4444-8444-444444444444",
      videoUrl: null,
    });
  });

  it("never persists signed private image or logo URLs", () => {
    const project = createDraftProject();
    const privateImageUrl = "https://storage.example.test/private.jpg?X-Amz-Signature=short-lived";
    const privateLogoUrl = "https://storage.example.test/logo.png?token=short-lived";
    saveLocalCreatorProject({
      ...project,
      logoUrl: privateLogoUrl,
      product: {
        ...project.product,
        images: [{
          id: "33333333-3333-4333-8333-333333333333",
          name: "product.jpg",
          url: privateImageUrl,
          storagePath: "users/u/projects/p/assets/product/a/checksum",
          source: "upload",
        }],
      },
    }, "user-one");

    const serialized = localStorage.getItem("movprompt.creator-projects.v2:user-one")!;
    expect(serialized).not.toContain(privateImageUrl);
    expect(serialized).not.toContain(privateLogoUrl);
    expect(serialized).not.toContain("X-Amz-Signature");
    expect(serialized).not.toContain("token=short-lived");
    expect(listLocalCreatorProjects("user-one")[0]).toMatchObject({
      logoUrl: "",
      product: { images: [expect.objectContaining({ storagePath: "users/u/projects/p/assets/product/a/checksum", url: "" })] },
    });
  });

  it("uses the authoritative image MIME and keeps transient URLs out of the product recipe", () => {
    const project = createDraftProject();
    project.product.sourceUrl = "https://shop.example.test/product?token=private";
    project.product.images = [{
      id: "33333333-3333-4333-8333-333333333333",
      name: "product.webp",
      url: "http://127.0.0.1:9000/private?signature=short-lived",
      storagePath: `users/${"11111111-1111-4111-8111-111111111111"}/projects/${project.id}/assets/product/33333333-3333-4333-8333-333333333333/${"a".repeat(64)}`,
      mimeType: "image/webp",
      checksum: "a".repeat(64),
      source: "upload",
    }];

    expect(buildPortableGenerationConfiguration(project).references).toEqual([{
      objectKey: project.product.images[0]!.storagePath,
      mimeType: "image/webp",
    }]);
    const recipe = portableProductRecipe(project);
    expect(JSON.stringify(recipe)).not.toContain("http");
    expect(JSON.stringify(recipe)).not.toContain("signature");
    expect(recipe.images).toEqual([expect.objectContaining({
      objectKey: project.product.images[0]!.storagePath,
      mimeType: "image/webp",
    })]);
  });

  it("does not pass MOV footage into Advanced image references", () => {
    const project = createDraftProject();
    project.product.images = [
      {
        id: "33333333-3333-4333-8333-333333333333",
        name: "product.jpg",
        url: "blob:product",
        storagePath: "users/u/projects/p/assets/product/image/checksum",
        mimeType: "image/jpeg",
        source: "upload",
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        name: "spokesperson.mov",
        url: "blob:footage",
        storagePath: "users/u/projects/p/assets/footage/video/checksum",
        mimeType: "video/quicktime",
        source: "upload",
      },
    ];

    expect(imageReferencesForAdvancedHandoff(project)).toEqual([
      "users/u/projects/p/assets/product/image/checksum",
    ]);
  });

  it("fails closed for MIME-less legacy references in Advanced handoff and portable generation", () => {
    const project = createDraftProject();
    project.product.images = [
      {
        id: "33333333-3333-4333-8333-333333333333",
        name: "legacy-upload.mov",
        url: "blob:legacy-upload",
        storagePath: "users/u/projects/p/assets/footage/legacy/checksum",
        source: "upload",
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        name: "legacy-sample",
        url: "/create/legacy-sample",
        source: "sample",
      },
    ];

    expect(imageReferencesForAdvancedHandoff(project)).toEqual([]);
    expect(buildPortableGenerationConfiguration(project).references).toEqual([]);
  });

});

describe("creator project library page", () => {
  const userId = "user-one";

  function record(id: string, title: string, updatedAt: string, fields: Partial<CreatorProjectRecord> = {}): CreatorProjectRecord {
    return {
      id, title, mode: "template", status: "ready",
      currentWorkingVersionId: "507f1f77bcf86cd799439099", currentAcceptedVersionId: null,
      latestRenderRunId: null, latestRenderProjectVersionId: null, latestRenderRunStatus: null,
      deletedAt: null, createdAt: updatedAt, updatedAt, versionCount: 1, outputCount: 0,
      currentVersion: {
        id: "507f1f77bcf86cd799439099", projectId: id, parentVersionId: null, templateVersionId: null, mode: "template", versionNumber: 1,
        configuration: { creatorProject: createDraftProject() } as never,
        productRecipe: {}, campaignRecipe: {}, changeReason: null, createdAt: updatedAt,
      },
      ...fields,
    };
  }
  const respond = (projects: CreatorProjectRecord[]) => vi.spyOn(portableCreatorApi, "projectLibrary").mockResolvedValue({
    items: projects.map((project) => ({ kind: "draft", projectId: project.id })),
    projects, total: projects.length, page: 1, limit: 40,
    counts: { all: projects.length, ready: 0, progress: 0, attention: 0, drafts: projects.length },
    hasActive: false, requestId: "req_1234567890",
  } as ProjectLibraryResponse);
  const first = "507f1f77bcf86cd799439011";
  const second = "507f1f77bcf86cd799439012";

  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("hydrates the page and strips the transport fields", async () => {
    respond([record(first, "Oud launch", "2026-10-31T10:00:00.000Z")]);
    const page = await loadCreatorProjectLibrary(userId, { page: 1 });
    expect(page.projects.map((project) => project.title)).toEqual(["Oud launch"]);
    expect(page).toMatchObject({ total: 1, hasActive: false });
    expect(page).not.toHaveProperty("requestId");
  });

  it("drops records the client cannot open", async () => {
    respond([record(first, "Advanced", "2026-10-31T10:00:00.000Z", { currentVersion: null })]);
    expect((await loadCreatorProjectLibrary(userId, {})).projects).toEqual([]);
  });

  it("keeps projects from other pages in the cache so they can still be reopened", async () => {
    const older = saveLocalCreatorProject({ ...createDraftProject(), id: second, title: "From another page" }, userId);
    respond([record(first, "On this page", "2026-10-31T10:00:00.000Z")]);
    await loadCreatorProjectLibrary(userId, { page: 2 });
    expect(getLocalCreatorProject(older.id, userId)?.title).toBe("From another page");
    expect(getLocalCreatorProject(first, userId)?.title).toBe("On this page");
  });

  it("refreshes a cached project in place", async () => {
    saveLocalCreatorProject({ ...createDraftProject(), id: first, title: "Old title" }, userId);
    respond([record(first, "New title", "2026-10-31T10:00:00.000Z")]);
    await loadCreatorProjectLibrary(userId, {});
    expect(listLocalCreatorProjects(userId).map((project) => project.title)).toEqual(["New title"]);
  });

  it("does not rewrite the cache when a poll returns the same page", async () => {
    respond([record(first, "Polled", "2026-10-31T10:00:00.000Z")]);
    await loadCreatorProjectLibrary(userId, {});
    const changed = vi.fn();
    const unsubscribe = subscribeToCreatorProjects(changed);
    await loadCreatorProjectLibrary(userId, {});
    unsubscribe();
    expect(changed).not.toHaveBeenCalled();
  });

  it("still returns the page when local storage is full", async () => {
    respond([record(first, "Quota", "2026-10-31T10:00:00.000Z")]);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    await expect(loadCreatorProjectLibrary(userId, {})).resolves.toMatchObject({ total: 1 });
  });
});
