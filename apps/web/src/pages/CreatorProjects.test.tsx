import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { draftProjectBucket, renderRunBucket, type ProjectLibraryQuery } from "@movprompt/contracts";

const mocks = vi.hoisted(() => ({
  loadCreatorProjectLibrary: vi.fn(),
  outputDownload: vi.fn(),
  loadCreatorProjects: vi.fn(),
  duplicateCreatorProject: vi.fn(),
  trashCreatorProject: vi.fn(),
  claimGuestResults: vi.fn(),
  retryRenderOutput: vi.fn(),
  locale: { value: "en" },
}));

// The real module injects its stylesheet on import, and jsdom then matches all of
// those rules on every getComputedStyle. A role query over 40 cards makes hundreds
// of those calls, which is slow enough to time out on CI.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/Seo", () => ({ Seo: () => null }));
vi.mock("@/features/create/CreatorShell", () => ({
  CreatorShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "11111111-1111-4111-8111-111111111111" } }),
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ locale: mocks.locale.value }),
}));
vi.mock("@/config/features", () => ({
  isFeatureEnabled: () => true,
}));
vi.mock("@/features/create/templates", () => ({
  getCreatorTemplate: () => ({ name: "Electronics feature demo", nameAr: "عرض ميزات الإلكترونيات" }),
}));
vi.mock("@/features/create/projectStore", () => ({
  duplicateCreatorProject: mocks.duplicateCreatorProject,
  listLocalCreatorProjects: () => [],
  loadCreatorProjectLibrary: mocks.loadCreatorProjectLibrary,
  loadCreatorProjects: mocks.loadCreatorProjects,
  subscribeToCreatorProjects: () => () => undefined,
  trashCreatorProject: mocks.trashCreatorProject,
}));
vi.mock("@/lib/api/portableApiClient", () => ({
  PortableApiError: class PortableApiError extends Error {
    constructor(readonly requestId: string) { super("failed"); }
  },
  portableCreatorApi: {
    claimGuestResults: mocks.claimGuestResults,
    outputDownload: mocks.outputDownload,
    retryRenderOutput: mocks.retryRenderOutput,
  },
}));

import CreatorProjects from "./CreatorProjects";
import { PortableApiError } from "@/lib/api/portableApiClient";

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

type Run = (typeof runs)[number];
type Project = typeof project;

/** Stands in for GET /project-library, including its bucket, search and paging rules. */
function serveLibrary(data: { projects: Project[]; runs: Run[] }) {
  mocks.loadCreatorProjectLibrary.mockImplementation(async (_userId: string, query: ProjectLibraryQuery) => {
    const runProjects = new Set(data.runs.map((run) => run.projectId));
    const drafts = data.projects.filter((item) => !runProjects.has(item.id));
    const counts = { all: data.runs.length + drafts.length, ready: 0, progress: 0, attention: 0, drafts: 0 };
    for (const run of data.runs) counts[renderRunBucket(run as never)] += 1;
    for (const item of drafts) counts[draftProjectBucket(item)] += 1;
    const titled = (id: string) => data.projects.find((item) => item.id === id)?.title ?? "";
    const matches = (title: string) => title.toLowerCase().includes(query.search.toLowerCase());
    const items = [
      ...data.runs
        .filter((run) => (query.filter === "all" || renderRunBucket(run as never) === query.filter) && matches(titled(run.projectId)))
        .map((run) => ({ kind: "run" as const, run })),
      ...drafts
        .filter((item) => (query.filter === "all" || draftProjectBucket(item) === query.filter) && matches(item.title))
        .map((item) => ({ kind: "draft" as const, projectId: item.id })),
    ];
    const start = (query.page - 1) * query.limit;
    const pageItems = items.slice(start, start + query.limit);
    const ids = new Set(pageItems.map((item) => item.kind === "run" ? item.run.projectId : item.projectId));
    return {
      items: pageItems,
      projects: data.projects.filter((item) => ids.has(item.id)),
      total: items.length,
      page: query.page,
      limit: query.limit,
      counts,
      hasActive: data.runs.some((run) => !["completed", "failed", "cancelled"].includes(run.status)),
    };
  });
  return data;
}

function LocationProbe() {
  const { search } = useLocation();
  return <output data-testid="location">{search}</output>;
}

function renderPage(entry = "/projects", props: { qaMode?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <CreatorProjects {...props} />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const apiError = (requestId: string) => new (PortableApiError as unknown as new (id: string) => Error)(requestId);
const lastQuery = () => mocks.loadCreatorProjectLibrary.mock.lastCall?.[1] as ProjectLibraryQuery;
const urlSearch = () => screen.getByTestId("location").textContent;
const manyDrafts = (count: number): Project[] => Array.from({ length: count }, (_, index) => ({
  ...project,
  id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, "0")}`,
  title: `Draft ${index + 1}`,
  status: "ready",
}));

beforeEach(() => {
  mocks.claimGuestResults.mockResolvedValue({ claimed: true, projectIds: [] });
  mocks.loadCreatorProjects.mockResolvedValue([]);
  mocks.locale.value = "en";
});

describe("CreatorProjects generation history", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps every completed generation visible and playable, including repeated project versions", async () => {
    serveLibrary({ projects: [project], runs });
    mocks.outputDownload.mockImplementation(async (_projectId: string, runId: string) => `https://media.local/${runId}.mp4`);

    const { container } = renderPage();

    await waitFor(() => expect(container.querySelectorAll("video[controls]")).toHaveLength(3));
    expect(container.querySelectorAll(".creator-generation-card")).toHaveLength(3);
    expect(container.querySelectorAll(".creator-generation-card-copy .creator-generation-badge")).toHaveLength(3);
    expect(container.querySelector(".creator-generation-card-media .creator-generation-badge")).toBeNull();
    expect(screen.getAllByRole("link", { name: "Open project" })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "Download" })).toHaveLength(3);
    expect(mocks.outputDownload).toHaveBeenCalledTimes(3);
    expect(new Set(Array.from(container.querySelectorAll("video")).map((video) => video.getAttribute("src"))).size).toBe(3);
  });

  it("confirms deletion of a failed project and removes its failed history card", async () => {
    const failedProject = { ...project, status: "failed", hasGeneratedVideo: false };
    const failedRun = { ...runs[0], status: "failed", processingStage: "failed", outputAvailable: false, error: { code: "provider_operation_failed", message: "Video creation needs attention." } };
    const data = serveLibrary({ projects: [failedProject], runs: [failedRun] });
    mocks.trashCreatorProject.mockImplementation(async () => { data.projects = []; data.runs = []; });

    const { container } = renderPage();
    const deleteButton = await screen.findByRole("button", { name: `Delete project ${project.title}` });
    fireEvent.click(deleteButton);
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(project.title);
    expect(mocks.trashCreatorProject).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete project" }));
    await waitFor(() => expect(mocks.trashCreatorProject).toHaveBeenCalledExactlyOnceWith(project.id, project.userId));
    await waitFor(() => expect(container.querySelectorAll(".creator-generation-card")).toHaveLength(0));
  });

  it("protects a completed video when a later attempt needs attention", async () => {
    serveLibrary({
      projects: [{ ...project, status: "failed", hasGeneratedVideo: true }],
      runs: [
        { ...runs[0], status: "failed", processingStage: "failed", outputAvailable: false, error: { code: "provider_operation_failed", message: "Video creation needs attention." } } as unknown as Run,
        runs[1],
      ],
    });
    mocks.outputDownload.mockResolvedValue("https://media.local/video.mp4");

    renderPage();
    await waitFor(() => expect(screen.getAllByRole("link", { name: "Open project" })).toHaveLength(2));
    expect(screen.queryByRole("button", { name: `Delete project ${project.title}` })).toBeNull();
  });

  it("offers server-checked deletion for an older failed run without a hydrated project", async () => {
    const failedRun = { ...runs[0], status: "failed", processingStage: "failed", outputAvailable: false, error: { code: "provider_operation_failed", message: "Video creation needs attention." } };
    const data = serveLibrary({ projects: [], runs: [failedRun as unknown as Run] });
    mocks.trashCreatorProject.mockImplementation(async () => { data.runs = []; });

    const { container } = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Delete project Video project" }));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Video project");
    fireEvent.click(screen.getByRole("button", { name: "Delete project" }));
    await waitFor(() => expect(mocks.trashCreatorProject).toHaveBeenCalledExactlyOnceWith(project.id, project.userId));
    await waitFor(() => expect(container.querySelectorAll(".creator-generation-card")).toHaveLength(0));
  });

  it("keeps a failed card if the server refuses deletion", async () => {
    const failedRun = { ...runs[0], status: "failed", processingStage: "failed", outputAvailable: false, error: { code: "provider_operation_failed", message: "Video creation needs attention." } };
    serveLibrary({ projects: [], runs: [failedRun as unknown as Run] });
    mocks.trashCreatorProject.mockRejectedValue(new Error("conflict"));

    const { container } = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Delete project Video project" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete project" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn’t delete");
    expect(container.querySelectorAll(".creator-generation-card")).toHaveLength(1);
  });
});

const draft = { ...project, id: "44444444-4444-4444-8444-444444444444", title: "Unfinished test campaign", status: "ready", videoUrl: null, renderRunId: null, jobId: null };

describe("CreatorProjects filters and empty state", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("summarises work and filters generated videos, drafts and search results", async () => {
    serveLibrary({ projects: [project, draft], runs: [runs[0]] });
    mocks.outputDownload.mockResolvedValue("https://media.local/video.mp4");
    const { container } = renderPage();

    await screen.findByRole("heading", { name: draft.title, level: 3 });
    expect(container.querySelectorAll(".creator-generation-card")).toHaveLength(1);
    expect(screen.getByText("Videos ready").closest("div")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Drafts", pressed: false }));
    await waitFor(() => expect(container.querySelectorAll(".creator-generation-card")).toHaveLength(0));
    expect(screen.getByRole("heading", { name: draft.title, level: 3 })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ready", pressed: false }));
    await waitFor(() => expect(container.querySelectorAll(".creator-generation-card")).toHaveLength(1));
    expect(screen.queryByRole("heading", { name: draft.title })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "All", pressed: false }));
    await screen.findByRole("heading", { name: draft.title, level: 3 });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search projects" }), { target: { value: "no such campaign" } });
    expect(await screen.findByText("Nothing matches this view")).toBeTruthy();
    expect(screen.getByText("Videos ready").closest("div")).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(container.querySelectorAll(".creator-generation-card")).toHaveLength(1));
  });

  it("guides a new user to templates or Ad Studio when there is nothing yet", async () => {
    serveLibrary({ projects: [], runs: [] });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Your first campaign starts here" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse templates" })).toHaveAttribute("href", "/templates");
    expect(screen.getByRole("link", { name: "Open Ad Studio" })).toHaveAttribute("href", "/ad-studio");
  });
});

describe("Delete unfinished projects", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  let library: ReturnType<typeof serveLibrary>;
  async function show(items: Project[] = [draft as Project, project], history: Run[] = []) {
    library = serveLibrary({ projects: items, runs: history });
    renderPage();
    await screen.findByRole("heading", { name: draft.title, level: 3 });
  }
  it("offers a named delete button only on unfinished projects", async () => {
    await show();
    expect(screen.getAllByRole("button", { name: /Delete project/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: `Delete project ${draft.title}` })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Move .* to trash/ })).toBeNull();
  });
  it.each(["draft", "review", "generating", "failed", "exporting"])("offers Delete project for non-generated %s work", async status => {
    await show([{ ...draft, status } as Project]);
    fireEvent.click(screen.getByRole("button", { name: `Delete project ${draft.title}` }));
    expect(await screen.findByRole("alertdialog", { name: "Are you sure you want to delete this project?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });
  it("protects historical videos even when the working version is a draft", async () => {
    await show([draft as Project, { ...draft, id: project.id, title: project.title, hasGeneratedVideo: true } as unknown as Project]);
    expect(screen.getAllByRole("button", { name: /Delete project/ })).toHaveLength(1);
  });
  it("offers deletion for active renders and explains cancellation", async () => {
    await show([draft as Project], [{ ...runs[0], projectId: draft.id, status: "processing", outputAvailable: false } as Run]);
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
    library.projects = [project]; finish();
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
    expect(screen.getByRole("heading", { name: draft.title, hidden: true, level: 3 })).toBeTruthy();
  });
});

describe("CreatorProjects pagination", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  /** Each findByRole miss re-scans all 40 cards and prints the DOM, so wait on a plain selector and check the role once. */
  async function expectDraftHeading(title: string) {
    await waitFor(() => expect(document.querySelector(`article[aria-label="${title}"]`)).not.toBeNull());
    expect(screen.getByRole("heading", { name: title, level: 3 })).toBeTruthy();
  }

  it("hides the control when everything fits on one page", async () => {
    serveLibrary({ projects: manyDrafts(40), runs: [] });
    renderPage();
    await expectDraftHeading("Draft 1");
    expect(screen.queryByRole("navigation", { name: "Project pages" })).toBeNull();
    expect(lastQuery()).toEqual({ page: 1, limit: 40, filter: "all", search: "" });
  });

  it("moves through pages in the URL, keeps counts for the whole library and shows only 40 cards", async () => {
    serveLibrary({ projects: manyDrafts(85), runs: [] });
    const { container } = renderPage();
    const nav = await screen.findByRole("navigation", { name: "Project pages" });
    expect(container.querySelectorAll(".creator-project-card-v2")).toHaveLength(40);
    expect(within(nav).getByText("Page 1 of 3")).toBeTruthy();
    expect(screen.getByText("Drafts", { selector: "dt" }).closest("div")).toHaveTextContent("85");
    expect(within(nav).getByRole("button", { name: "Previous" })).toBeDisabled();

    fireEvent.click(within(nav).getByRole("button", { name: "Next" }));
    await expectDraftHeading("Draft 41");
    expect(urlSearch()).toBe("?page=2");
    expect(lastQuery().page).toBe(2);

    fireEvent.click(within(nav).getByRole("button", { name: "Next" }));
    await expectDraftHeading("Draft 81");
    expect(within(nav).getByRole("button", { name: "Next" })).toBeDisabled();
    expect(container.querySelectorAll(".creator-project-card-v2")).toHaveLength(5);

    fireEvent.click(within(nav).getByRole("button", { name: "Previous" }));
    await expectDraftHeading("Draft 41");
    fireEvent.click(within(nav).getByRole("button", { name: "Previous" }));
    await expectDraftHeading("Draft 1");
    expect(urlSearch()).toBe("");
  });

  it("opens the page named in the URL, so Back returns to the same position", async () => {
    serveLibrary({ projects: manyDrafts(85), runs: [] });
    renderPage("/projects?page=2");
    await expectDraftHeading("Draft 41");
    expect(lastQuery().page).toBe(2);
    expect(screen.getByText("Page 2 of 3")).toBeTruthy();
  });

  it("restores a filtered view from the URL too", async () => {
    serveLibrary({ projects: manyDrafts(85), runs: [] });
    renderPage("/projects?page=2&filter=drafts&q=draft");
    await expectDraftHeading("Draft 41");
    expect(lastQuery()).toMatchObject({ page: 2, filter: "drafts", search: "draft" });
    expect(screen.getByRole("searchbox", { name: "Search projects" })).toHaveValue("draft");
    expect(screen.getByRole("button", { name: "Drafts", pressed: true })).toBeTruthy();
  });

  it.each(["abc", "0", "-2", "1.5", "99999999"])("falls back to the first page for ?page=%s", async (value) => {
    serveLibrary({ projects: manyDrafts(3), runs: [] });
    renderPage(`/projects?page=${value}`);
    await expectDraftHeading("Draft 1");
    expect(lastQuery().page).toBe(1);
  });

  it("keeps a hand-edited search within what the API accepts", async () => {
    serveLibrary({ projects: manyDrafts(3), runs: [] });
    renderPage(`/projects?q=${"d".repeat(200)}`);
    await waitFor(() => expect(lastQuery().search).toHaveLength(120));
  });

  it("ignores an unknown filter in the URL", async () => {
    serveLibrary({ projects: manyDrafts(3), runs: [] });
    renderPage("/projects?filter=trashed");
    await expectDraftHeading("Draft 1");
    expect(lastQuery().filter).toBe("all");
  });

  it("goes to the last page when the URL points past the end", async () => {
    serveLibrary({ projects: manyDrafts(45), runs: [] });
    renderPage("/projects?page=9");
    await expectDraftHeading("Draft 41");
    expect(urlSearch()).toBe("?page=2");
  });

  it("returns to the first page when the filter changes", async () => {
    serveLibrary({ projects: manyDrafts(85), runs: [] });
    renderPage("/projects?page=2");
    await expectDraftHeading("Draft 41");

    fireEvent.click(screen.getByRole("button", { name: "Drafts", pressed: false }));
    await expectDraftHeading("Draft 1");
    expect(urlSearch()).toBe("?filter=drafts");
    expect(lastQuery()).toMatchObject({ page: 1, filter: "drafts" });
  });

  it("waits for typing to stop, then searches from the first page", async () => {
    serveLibrary({ projects: manyDrafts(85), runs: [] });
    renderPage("/projects?page=2");
    await expectDraftHeading("Draft 41");
    mocks.loadCreatorProjectLibrary.mockClear();

    const box = screen.getByRole("searchbox", { name: "Search projects" });
    fireEvent.change(box, { target: { value: "D" } });
    fireEvent.change(box, { target: { value: "Dr" } });
    fireEvent.change(box, { target: { value: "Draft 7 " } });
    expect(mocks.loadCreatorProjectLibrary).not.toHaveBeenCalled();

    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 1, search: "Draft 7" }));
    expect(mocks.loadCreatorProjectLibrary).toHaveBeenCalledTimes(1);
    expect(urlSearch()).toBe("?q=Draft+7");
    expect(box).toHaveValue("Draft 7 ");
  });

  it("keeps the current cards on screen while the next page loads, without skeletons", async () => {
    serveLibrary({ projects: manyDrafts(85), runs: [] });
    const { container } = renderPage();
    await expectDraftHeading("Draft 1");
    const respond = mocks.loadCreatorProjectLibrary.getMockImplementation()!;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    mocks.loadCreatorProjectLibrary.mockImplementation(async (...args: unknown[]) => { await gate; return respond(...args); });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(urlSearch()).toBe("?page=2"));
    expect(screen.getByRole("heading", { name: "Draft 1", level: 3 })).toBeTruthy();
    expect(container.querySelector(".creator-template-skeleton")).toBeNull();
    release();
    await expectDraftHeading("Draft 41");
  });

  it("scrolls back to the top of the list on a page change, not on first load", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    serveLibrary({ projects: manyDrafts(85), runs: [] });
    const { container } = renderPage();
    await expectDraftHeading("Draft 1");
    expect(scrollIntoView).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(container.querySelector(".creator-projects-toolbar"));
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it("speaks Arabic", async () => {
    mocks.locale.value = "ar";
    serveLibrary({ projects: manyDrafts(45), runs: [] });
    renderPage();
    const nav = await screen.findByRole("navigation", { name: "صفحات المشاريع" });
    expect(within(nav).getByRole("button", { name: "السابق" })).toBeDisabled();
    expect(within(nav).getByRole("button", { name: "التالي" })).toBeTruthy();
    expect(within(nav).getByText("صفحة 1 من 2")).toBeTruthy();
  });

  it("slices local projects at 40 outside the portable platform", async () => {
    mocks.loadCreatorProjects.mockResolvedValue(manyDrafts(45));
    const { container } = renderPage("/qa/create?view=projects", { qaMode: true });
    await expectDraftHeading("Draft 1");
    expect(mocks.loadCreatorProjectLibrary).not.toHaveBeenCalled();
    expect(container.querySelectorAll(".creator-project-card-v2")).toHaveLength(40);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await expectDraftHeading("Draft 41");
    expect(container.querySelectorAll(".creator-project-card-v2")).toHaveLength(5);
    expect(urlSearch()).toBe("?view=projects&page=2");
  });
});

describe("CreatorProjects video URLs", () => {
  const observers: { callback: IntersectionObserverCallback; elements: Element[]; disconnect: () => void }[] = [];

  const realObserver = window.IntersectionObserver;

  beforeEach(() => {
    observers.length = 0;
    window.IntersectionObserver = class {
      elements: Element[] = [];
      constructor(readonly callback: IntersectionObserverCallback) { observers.push(this as never); }
      observe(element: Element) { this.elements.push(element); }
      unobserve() { /* unused */ }
      disconnect() { /* unused */ }
    } as unknown as typeof IntersectionObserver;
  });
  afterEach(() => { cleanup(); window.IntersectionObserver = realObserver; vi.useRealTimers(); vi.clearAllMocks(); });

  const scrollNear = (index: number, isIntersecting = true) => act(() => {
    const observer = observers[index]!;
    observer.callback([{ isIntersecting } as IntersectionObserverEntry], observer as never);
  });

  it("asks for nothing up front, then only for the card coming into view", async () => {
    serveLibrary({ projects: [project], runs });
    mocks.outputDownload.mockImplementation(async (_projectId: string, runId: string) => `https://media.local/${runId}.mp4`);
    const { container } = renderPage();
    await waitFor(() => expect(container.querySelectorAll(".creator-generation-card")).toHaveLength(3));
    expect(observers).toHaveLength(3);
    expect(mocks.outputDownload).not.toHaveBeenCalled();
    expect(container.querySelector("video")).toBeNull();

    scrollNear(1);
    await waitFor(() => expect(container.querySelectorAll("video[controls]")).toHaveLength(1));
    expect(mocks.outputDownload).toHaveBeenCalledExactlyOnceWith(project.id, runs[1].id);

    scrollNear(1, false);
    scrollNear(1);
    expect(mocks.outputDownload).toHaveBeenCalledTimes(1);
  });

  it("still loads videos in a browser without IntersectionObserver", async () => {
    window.IntersectionObserver = undefined as unknown as typeof IntersectionObserver;
    serveLibrary({ projects: [project], runs: runs.slice(0, 2) });
    mocks.outputDownload.mockResolvedValue("https://media.local/video.mp4");
    const { container } = renderPage();
    await waitFor(() => expect(container.querySelectorAll("video[controls]")).toHaveLength(2));
  });

  it("does not observe runs without an output", async () => {
    serveLibrary({ projects: [project], runs: [{ ...runs[0], status: "failed", outputAvailable: false } as Run] });
    const { container } = renderPage();
    await waitFor(() => expect(container.querySelectorAll(".creator-generation-card")).toHaveLength(1));
    expect(observers).toHaveLength(0);
  });

  it("keeps the poster when the URL cannot be fetched, and tries again on the way back", async () => {
    serveLibrary({ projects: [project], runs: [runs[0]] });
    mocks.outputDownload.mockRejectedValueOnce(new Error("expired")).mockResolvedValue("https://media.local/video.mp4");
    const { container } = renderPage();
    await waitFor(() => expect(observers).toHaveLength(1));

    scrollNear(0);
    await waitFor(() => expect(mocks.outputDownload).toHaveBeenCalledTimes(1));
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector(".creator-generation-card-media img")).toHaveAttribute("src", project.product.images[0]!.url);
    expect(screen.getByRole("button", { name: "Download" })).toBeTruthy();

    scrollNear(0, false);
    scrollNear(0);
    await waitFor(() => expect(container.querySelector("video")).toHaveAttribute("src", "https://media.local/video.mp4"));
  });

  it("renews the URL of cards in view every 10 minutes, and leaves the rest until they return", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serveLibrary({ projects: [project], runs: runs.slice(0, 2) });
    mocks.outputDownload.mockImplementation(async (_projectId: string, runId: string) => `https://media.local/${runId}.mp4?v=${mocks.outputDownload.mock.calls.length}`);
    const { container } = renderPage();
    await vi.waitFor(() => expect(observers).toHaveLength(2));
    scrollNear(0);
    await vi.waitFor(() => expect(container.querySelector("video")).toHaveAttribute("src", expect.stringContaining("v=1")));

    await act(() => vi.advanceTimersByTimeAsync(10 * 60_000));
    expect(mocks.outputDownload).toHaveBeenCalledTimes(2);
    expect(mocks.outputDownload).toHaveBeenLastCalledWith(project.id, runs[0].id);
    expect(container.querySelector("video")).toHaveAttribute("src", expect.stringContaining("v=2"));
    expect(mocks.loadCreatorProjectLibrary).toHaveBeenCalledTimes(1);
  });

  it("Refresh reloads the library and signs visible videos again", async () => {
    serveLibrary({ projects: [project], runs: [runs[0]] });
    mocks.outputDownload.mockResolvedValue("https://media.local/video.mp4");
    const { container } = renderPage();
    await waitFor(() => expect(observers).toHaveLength(1));
    scrollNear(0);
    await waitFor(() => expect(container.querySelector("video")).toBeTruthy());
    mocks.loadCreatorProjectLibrary.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(mocks.loadCreatorProjectLibrary).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.outputDownload).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh" })).not.toBeDisabled());
  });
});

describe("CreatorProjects polling and guest claim", () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });
  const active = { ...runs[0], status: "processing", processingStage: "rendering", outputAvailable: false } as Run;
  const settle = () => vi.waitFor(() => expect(mocks.loadCreatorProjectLibrary).toHaveBeenCalled());

  it("does not poll when nothing is running", async () => {
    serveLibrary({ projects: [project], runs: [runs[0]] });
    renderPage();
    await settle();
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(mocks.loadCreatorProjectLibrary).toHaveBeenCalledTimes(1);
  });

  it("polls only the library every 4 seconds while a render is active, and stops when it settles", async () => {
    const data = serveLibrary({ projects: [project], runs: [active] });
    renderPage();
    await settle();
    await act(() => vi.advanceTimersByTimeAsync(8_000));
    expect(mocks.loadCreatorProjectLibrary).toHaveBeenCalledTimes(3);
    expect(mocks.claimGuestResults).toHaveBeenCalledTimes(1);

    data.runs = [{ ...active, status: "completed", outputAvailable: true }];
    await act(() => vi.advanceTimersByTimeAsync(4_000));
    expect(mocks.loadCreatorProjectLibrary).toHaveBeenCalledTimes(4);
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(mocks.loadCreatorProjectLibrary).toHaveBeenCalledTimes(4);
    expect(mocks.claimGuestResults).toHaveBeenCalledTimes(1);
  });

  it("does not poll while the tab is hidden", async () => {
    serveLibrary({ projects: [project], runs: [active] });
    renderPage();
    await settle();
    await act(() => vi.advanceTimersByTimeAsync(1));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    window.dispatchEvent(new Event("visibilitychange"));
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(mocks.loadCreatorProjectLibrary).toHaveBeenCalledTimes(1);
  });

  it("reloads once when the guest claim brings results over", async () => {
    let finishClaim!: (value: unknown) => void;
    mocks.claimGuestResults.mockImplementation(() => new Promise((resolve) => { finishClaim = resolve; }));
    serveLibrary({ projects: [project], runs: [runs[0]] });
    renderPage();
    await settle();
    await act(async () => { finishClaim({ claimed: true, projectIds: [project.id] }); });
    await vi.waitFor(() => expect(mocks.loadCreatorProjectLibrary).toHaveBeenCalledTimes(2));
  });

  it("does not block the library on the claim, and offers Refresh when the claim fails", async () => {
    mocks.claimGuestResults.mockRejectedValueOnce(apiError("req_claim"));
    serveLibrary({ projects: [project], runs: [runs[0]] });
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Support ID: req_claim");
    await screen.findByRole("heading", { name: project.title, level: 3 });

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await vi.waitFor(() => expect(mocks.claimGuestResults).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});

describe("CreatorProjects errors and actions", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("shows the load error with its support ID", async () => {
    mocks.loadCreatorProjectLibrary.mockRejectedValue(apiError("req_library"));
    const { container } = renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Support ID: req_library");
    expect(container.querySelector(".creator-template-skeleton")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Your first campaign starts here" })).toBeNull();
  });

  it("refreshes the library after duplicating a project", async () => {
    const data = serveLibrary({ projects: [draft as Project], runs: [] });
    mocks.duplicateCreatorProject.mockImplementation(async () => { data.projects = [{ ...draft, id: project.id, title: "Unfinished test campaign copy" } as Project, ...data.projects]; });
    renderPage();
    await screen.findByRole("heading", { name: draft.title, level: 3 });
    fireEvent.click(screen.getByRole("button", { name: /Duplicate/ }));
    await screen.findByRole("heading", { name: "Unfinished test campaign copy", level: 3 });
    expect(mocks.loadCreatorProjects).not.toHaveBeenCalled();
  });

  it("resumes a failed save and reloads the library", async () => {
    const failed = { ...runs[0], status: "failed", processingStage: "failed", outputAvailable: false, error: { code: "provider_output_unavailable", message: "Saving stopped." } };
    serveLibrary({ projects: [project], runs: [failed as unknown as Run] });
    mocks.retryRenderOutput.mockResolvedValue(failed);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Retry saving" }));
    await waitFor(() => expect(mocks.retryRenderOutput).toHaveBeenCalledExactlyOnceWith(runs[0].id, `render-output-recovery:${runs[0].id}`));
    await waitFor(() => expect(mocks.loadCreatorProjectLibrary).toHaveBeenCalledTimes(2));
  });
});
