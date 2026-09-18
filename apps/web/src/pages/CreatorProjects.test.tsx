import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  listRenders: vi.fn(),
  outputDownload: vi.fn(),
  loadCreatorProjects: vi.fn(),
  trashCreatorProject: vi.fn(),
}));

vi.mock("@/components/Seo", () => ({ Seo: () => null }));
vi.mock("@/features/create/CreatorShell", () => ({
  CreatorShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "11111111-1111-4111-8111-111111111111" } }),
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ locale: "en" }),
}));
vi.mock("@/config/features", () => ({
  isFeatureEnabled: () => true,
}));
vi.mock("@/features/create/templates", () => ({
  getCreatorTemplate: () => ({ name: "Electronics feature demo", nameAr: "عرض ميزات الإلكترونيات" }),
}));
vi.mock("@/features/create/projectStore", () => ({
  duplicateCreatorProject: vi.fn(),
  listLocalCreatorProjects: () => [],
  loadCreatorProjects: mocks.loadCreatorProjects,
  subscribeToCreatorProjects: () => () => undefined,
  trashCreatorProject: mocks.trashCreatorProject,
}));
vi.mock("@/lib/api/portableApiClient", () => ({
  PortableApiError: class PortableApiError extends Error {},
  portableCreatorApi: {
    claimGuestResults: vi.fn().mockResolvedValue({ claimed: true, projectIds: [] }),
    listRenders: mocks.listRenders,
    outputDownload: mocks.outputDownload,
    retryRenderOutput: vi.fn(),
  },
}));

import CreatorProjects from "./CreatorProjects";

const project = {
  id: "22222222-2222-4222-8222-222222222222",
  userId: "11111111-1111-4111-8111-111111111111",
  title: "AirPods Max — Electronics feature demo",
  status: "completed",
  hasGeneratedVideo: false,
  templateId: "electronics-feature-demo",
  aspectRatio: "9:16",
  updatedAt: "2026-08-15T14:00:00.000Z",
  product: { images: [{ url: "/create/sample-airpods.jpg" }] },
};

const runs = [
  "2b9fad16-4bb7-4b68-8905-c8f5ef088d92",
  "bb3078ad-36fe-49c2-bea9-07dc833feae7",
  "04028413-aba6-42e3-9870-2efca33271c5",
].map((id, index) => ({
  id,
  projectId: project.id,
  projectVersionId: "33333333-3333-4333-8333-333333333333",
  status: "completed",
  processingStage: "ready",
  outputAvailable: true,
  createdAt: `2026-08-15T14:0${index}:00.000Z`,
  updatedAt: `2026-08-15T14:0${index}:30.000Z`,
  error: null,
}));

describe("CreatorProjects generation history", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps every completed generation visible and playable, including repeated project versions", async () => {
    mocks.loadCreatorProjects.mockResolvedValue([project]);
    mocks.listRenders.mockResolvedValue(runs);
    mocks.outputDownload.mockImplementation(async (_projectId: string, runId: string) => `https://media.local/${runId}.mp4`);

    const { container } = render(
      <MemoryRouter initialEntries={["/projects"]}>
        <CreatorProjects />
      </MemoryRouter>,
    );

    await waitFor(() => expect(container.querySelectorAll(".creator-generation-card")).toHaveLength(3));
    expect(container.querySelectorAll("video[controls]")).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "Download" })).toHaveLength(3);
    expect(mocks.outputDownload).toHaveBeenCalledTimes(3);
    expect(new Set(Array.from(container.querySelectorAll("video")).map((video) => video.getAttribute("src"))).size).toBe(3);
  });
});

const draft = { ...project, id: "44444444-4444-4444-8444-444444444444", title: "Unfinished test campaign", status: "ready", videoUrl: null, renderRunId: null, jobId: null };

describe.skip("Delete unfinished projects (removed with bento grid)", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  async function show(items = [draft, project], history: typeof runs = []) {
    mocks.loadCreatorProjects.mockResolvedValue(items);
    mocks.listRenders.mockResolvedValue(history);
    render(<MemoryRouter><CreatorProjects /></MemoryRouter>);
    await screen.findByRole("heading", { name: draft.title, level: 2 });
  }
  it("offers a named delete button only on unfinished projects", async () => {
    await show();
    expect(screen.getAllByRole("button", { name: /Delete project/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: `Delete project ${draft.title}` })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Move .* to trash/ })).toBeNull();
  });
  it.each(["draft", "review", "generating", "failed", "exporting"])("offers Delete project for non-generated %s work", async status => {
    await show([{ ...draft, status }]);
    fireEvent.click(screen.getByRole("button", { name: `Delete project ${draft.title}` }));
    expect(await screen.findByRole("alertdialog", { name: "Are you sure you want to delete this project?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });
  it("protects historical videos even when the working version is a draft", async () => {
    await show([draft, { ...draft, id: project.id, title: project.title, hasGeneratedVideo: true }]);
    expect(screen.getAllByRole("button", { name: /Delete project/ })).toHaveLength(1);
  });
  it("offers deletion for active renders and explains cancellation", async () => {
    await show([draft], [{ ...runs[0], projectId: draft.id, status: "processing", outputAvailable: false } as typeof runs[number]]);
    await waitFor(() => expect(screen.getByRole("button", { name: /Delete project/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Delete project/ }));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("cancelled before deletion");
  });
  it("does not delete when confirmation is cancelled", async () => {
    await show();
    fireEvent.click(screen.getByRole("button", { name: `Delete project ${draft.title}` }));
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.trashCreatorProject).not.toHaveBeenCalled();
  });
  it("waits for deletion and prevents duplicate clicks", async () => {
    let finish!: () => void;
    mocks.trashCreatorProject.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    await show();
    fireEvent.click(screen.getByRole("button", { name: `Delete project ${draft.title}` }));
    const confirm = await screen.findByRole("button", { name: "Delete project" });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(mocks.trashCreatorProject).toHaveBeenCalledExactlyOnceWith(draft.id, project.userId);
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    mocks.loadCreatorProjects.mockResolvedValue([project]); finish();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.queryByRole("heading", { name: draft.title })).toBeNull();
  });
  it("preserves the draft and shows a retryable error when deletion fails", async () => {
    mocks.trashCreatorProject.mockRejectedValue(new Error("offline"));
    await show();
    fireEvent.click(screen.getByRole("button", { name: `Delete project ${draft.title}` }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete project" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn’t delete");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByRole("heading", { name: draft.title, hidden: true, level: 2 })).toBeTruthy();
  });
});
