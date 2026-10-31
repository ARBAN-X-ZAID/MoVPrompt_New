import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
const phone = vi.hoisted(() => ({ value: true }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => phone.value }));
vi.mock("@/components/ThemeProvider", () => ({ useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLanguage: () => ({ locale: "en", setLocale: vi.fn() }) }));
vi.mock("@/components/credits/CreditBadge", () => ({ CreditBadge: () => null }));
vi.mock("./useCapabilities", () => ({ useCapabilities: () => ({ templateReady: true, active: { durations: [8, 15, 20] } }) }));
import { CreatorShell } from "./CreatorShell";
import { CreateScreen } from "./CreateScreen";
import { createDraftProject, getCreatorTemplate } from "./templates";
afterEach(() => { cleanup(); phone.value = true; });

function createScreen() {
  const project = createDraftProject("fashion-product-showcase");
  const props: Record<string, unknown> = {
    project, template: getCreatorTemplate(project.templateId), durationSeconds: 15, linkUrl: "", quote: null, quoteState: "ready",
    onNameChange: vi.fn(), onMessageChange: vi.fn(), onActionChange: vi.fn(), onDurationChange: vi.fn(), onFiles: vi.fn(),
    onLinkChange: vi.fn(), onImportLink: vi.fn(), onChangeTemplate: vi.fn(), onGenerate: vi.fn(), onCancelImport: vi.fn(),
  };
  return render(<MemoryRouter><CreateScreen {...(props as unknown as Parameters<typeof CreateScreen>[0])} /></MemoryRouter>);
}
const follows = (first: Element, second: Element) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

describe("phone create steps", () => {
  it("places Generate after the photos on phones, for reading and keyboard order", () => {
    createScreen();
    const generate = screen.getByRole("button", { name: "Generate video" });
    expect(follows(screen.getByRole("heading", { name: "Photos" }), generate)).toBe(true);
    expect(generate.closest(".creator-create-stage")).toBeNull();
    expect(generate.closest("aside")).toBeNull();
  });
  it("keeps Generate in the side panel on larger screens", () => {
    phone.value = false;
    createScreen();
    expect(screen.getByRole("button", { name: "Generate video" }).closest("aside")).not.toBeNull();
  });
  it("renders one Generate button, so nothing is duplicated between layouts", () => {
    createScreen();
    expect(screen.getAllByRole("button", { name: "Generate video" })).toHaveLength(1);
  });
});

describe("phone bottom navigation", () => {
  const shell = (path: string) => render(<MemoryRouter initialEntries={[path]}><CreatorShell>Workspace</CreatorShell></MemoryRouter>);
  it("uses the existing links and highlights the current page", () => {
    shell("/projects");
    const bar = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(bar).getByRole("link", { name: "Projects" })).toHaveClass("is-active");
    expect(within(bar).getByRole("link", { name: "Templates" })).toHaveAttribute("href", "/templates");
    expect(within(bar).getByRole("link", { name: "Ad Studio" })).toBeInTheDocument();
  });
  it.each(["/create?template=x", "/projects/abc", "/ad-studio/brand"])("steps aside while creating on %s", path => {
    shell(path);
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).toBeNull();
  });
  it("stays out of larger screens", () => {
    phone.value = false;
    shell("/templates");
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).toBeNull();
  });
});
