import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreatorTemplates from "./CreatorTemplates";

const state = vi.hoisted(() => ({ portable: false, getTemplate: vi.fn() }));
vi.mock("@/config/features", () => ({ isFeatureEnabled: () => state.portable }));
vi.mock("@/lib/api/portableApiClient", () => ({ portableCreatorApi: { getTemplate: state.getTemplate } }));
vi.mock("@/components/Seo", () => ({ Seo: () => null }));
vi.mock("@/features/create/CreatorShell", () => ({ CreatorShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/i18n/LanguageContext", () => ({ useLanguage: () => ({ locale: "en" }) }));
vi.mock("@/features/create/TemplateGrid", () => ({ TemplateGrid: ({ section, onSelect }: { section: string; onSelect: (id: string) => void }) => <button onClick={() => onSelect("product-with-model-ad")}>{section}</button> }));
function Location() { const location = useLocation(); return <output data-testid="location">{location.pathname + location.search + location.hash}</output>; }
function open(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Location /><Routes>
    <Route path="/templates/:slug" element={<CreatorTemplates />} />
    <Route path="/ad-studio/:slug" element={<CreatorTemplates section="ad-studio" />} />
    <Route path="/ad-studio" element={<CreatorTemplates section="ad-studio" />} />
    <Route path="/create" element={<div>Create form</div>} />
  </Routes></MemoryRouter>);
}
describe("catalog section routes", () => {
  beforeEach(() => { state.portable = false; state.getTemplate.mockReset(); });
  it.each(["female-product-review", "product-with-model-ad"])("redirects old Ad Studio %s detail links without losing context", async (id) => {
    open(`/ad-studio/${id}?draft=draft-1&project=project-1#preview`);
    expect(await screen.findByTestId("location")).toHaveTextContent(`/templates/${id}?draft=draft-1&project=project-1#preview`);
    expect(screen.getByRole("link", { name: "Use this template" })).toHaveAttribute("href", `/create?draft=draft-1&project=project-1&template=${id}`);
    expect(screen.getByRole("link", { name: "Browse another template" })).toHaveAttribute("href", "/templates?draft=draft-1&project=project-1");
  });
  it("selects through the existing create route with draft and project intact", () => {
    open("/ad-studio?draft=draft-1&project=project-1");
    fireEvent.click(screen.getByRole("button", { name: "ad-studio" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/create?draft=draft-1&project=project-1&template=product-with-model-ad");
  });
  it("does not unlock an unpublished item through a local detail fallback", async () => {
    state.portable = true;
    state.getTemplate.mockRejectedValue(new Error("not published"));
    open("/templates/female-product-review");
    expect(await screen.findByText("Template unavailable")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Use this template" })).toBeNull();
  });
  it("describes the lengths and languages the owner left on", async () => {
    state.portable = true;
    state.getTemplate.mockResolvedValue({
      slug: "jewelry-product-showcase", familyId: "jewelry-product-showcase", versionId: "66e6d8e7c51fa82b8e426931",
      name: { en: "Owner jewelry", ar: "مجوهرات" }, description: { en: "Owner copy", ar: "وصف" }, outcome: "Owner outcome",
      category: "jewellery", discoveryCategory: "other", durationSeconds: 8, supportedDurations: [15, 20], supportedLanguages: ["ar"],
      supportedRatios: ["9:16"], tags: [], verticals: ["retail"], goals: ["launch"], dialectPolicy: { register: "polished" }, qualityStatus: "approved", scenes: [],
    });
    open("/templates/jewelry-product-showcase");
    expect(await screen.findByText("Kuwaiti Arabic")).toBeVisible();
    expect(screen.queryByText("Kuwaiti Arabic or English")).toBeNull();
    expect(screen.getByText("15 · 20s")).toBeVisible();
    expect(screen.getByText("Owner outcome")).toBeVisible();
  });
  it("does not substitute the first template for an unknown slug", () => {
    open("/ad-studio/unknown");
    expect(screen.getByText("Template unavailable")).toBeVisible();
  });
});
