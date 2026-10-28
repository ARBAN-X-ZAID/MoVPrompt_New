import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GOLDEN_PRODUCT_PATH } from "./__fixtures__/goldenPathFixtures";

const mocks = vi.hoisted(() => ({
  quote: vi.fn(), getTemplate: vi.fn(), start: vi.fn(), saveDraft: vi.fn(async () => undefined), project: null as unknown,
  user: null as null | { id: string },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user, loading: false, signOut: vi.fn() }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLanguage: () => ({ locale: "en", t: (key: string) => key }) }));
vi.mock("@/features/create/CreatorShell", () => ({ CreatorShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/Seo", () => ({ Seo: () => null }));
vi.mock("./useCapabilities", () => ({ useCapabilities: () => ({ templateReady: true, active: { durations: [8, 15, 20] } }) }));
vi.mock("./AuthGateDialog", () => ({
  AuthGateDialog: ({ open, purpose, returnPath }: { open: boolean; purpose?: string; returnPath: string }) => <output data-testid="gate">{open ? `${purpose}|${returnPath}` : "closed"}</output>,
}));
vi.mock("@/config/features", () => ({ isFeatureEnabled: (name: string) => !["localDemoGeneration", "managedTemplates"].includes(name) }));
vi.mock("@/lib/api/portableApiClient", async original => ({ ...await original<object>(), portableCreatorApi: {
  claimGuestResults: vi.fn().mockResolvedValue({}), generationQuote: mocks.quote, getTemplate: mocks.getTemplate,
  guestSession: vi.fn().mockResolvedValue({ user: { id: "55555555-5555-4555-8555-555555555555", name: "Guest", email: "" } }),
} }));
vi.mock("@/lib/director/api", () => ({ pollCreatorGeneration: vi.fn(), pollVideoJob: vi.fn(), startCreatorGeneration: mocks.start, cancelCreatorGeneration: vi.fn(), cancelVideoJob: vi.fn() }));
vi.mock("./guestDraftStore", async original => ({ ...await original<object>(), saveGuestDraft: mocks.saveDraft }));
vi.mock("./projectStore", async original => ({ ...await original<object>(), resolvePortableTemplateVersionId: vi.fn(async () => "44444444-4444-4444-8444-444444444444"), getLocalCreatorProject: () => mocks.project, loadCreatorProjects: vi.fn(async () => [mocks.project]), syncCreatorProject: vi.fn(async (project: unknown) => project), saveLocalCreatorProject: vi.fn() }));

import { CreateStudio } from "./CreateStudio";
import { createDraftProject, getCreatorTemplate, projectWithDuration } from "./templates";
import { projectWithBrandAdSettings } from "./adStudioBrandAdProject";

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const settings = {
  formVersion: 1 as const, brandName: "Oud Al Layl", website: "", sellingPoints: "Lasts 12 hours", aesthetics: "Dark luxury",
  audience: "Women 25 to 40 in Kuwait", description: "Handmade oud perfume", socials: "", videoIdea: "A woman sprays the perfume and smiles.",
};

function show(path: string) {
  mocks.getTemplate.mockImplementation(async (id: string) => {
    const template = getCreatorTemplate(id);
    return { goals: template.goals, supportedLanguages: template.languages, supportedRatios: template.aspectRatios };
  });
  mocks.quote.mockResolvedValue({ ...GOLDEN_PRODUCT_PATH.quote, expiresAt: new Date(Date.now() + 60_000).toISOString() });
  const project = createDraftProject("ad-studio-brand-ad");
  project.id = PROJECT_ID;
  project.status = "ready";
  project.product.sourceType = "upload";
  project.product.images = [{ id: "11111111-1111-4111-8111-111111111111", name: "bottle.png", source: "upload", url: "https://example.test/bottle.png", mimeType: "image/png", checksum: "a".repeat(64), storagePath: `creator-assets/owner/${PROJECT_ID}/bottle.png`, referenceRole: "subject", selected: true }];
  mocks.project = projectWithDuration(projectWithBrandAdSettings(project, settings), 15);
  render(<MemoryRouter initialEntries={[path]}><CreateStudio /></MemoryRouter>);
}

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); mocks.user = null; });

describe("Ad Studio sign-in before generating", () => {
  it("saves the guest draft and asks for sign-in instead of generating", async () => {
    show(`/create?project=${PROJECT_ID}`);
    await act(async () => {});
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Sign in to generate" })); });
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ id: PROJECT_ID, campaign: expect.objectContaining({ adStudioBrandAd: settings }) }));
    expect(screen.getByTestId("gate")).toHaveTextContent(`generate|/create?draft=${PROJECT_ID}&resume=ready`);
  });

  it("saves display-only setup before photos and persists clearing it", async()=>{
    vi.useFakeTimers();mocks.user={id:"11111111-1111-4111-8111-111111111111"};mocks.project=null;
    mocks.getTemplate.mockResolvedValue({goals:["sales"],supportedLanguages:["en","ar","bilingual"],supportedRatios:["9:16"]});
    mocks.quote.mockResolvedValue({...GOLDEN_PRODUCT_PATH.quote,expiresAt:new Date(Date.now()+60000).toISOString()});
    render(<MemoryRouter initialEntries={["/create?template=premium-phone-reveal"]}><CreateStudio/></MemoryRouter>);
    await act(async()=>{});
    const field=screen.getByLabelText("Offer or message to display (optional)");
    await act(async()=>{fireEvent.change(field,{target:{value:"خصم ٢٠٪ حتى الجمعة!"}});});
    expect(field).toHaveValue("خصم ٢٠٪ حتى الجمعة!");
    await act(async()=>{await vi.advanceTimersByTimeAsync(400);});
    await act(async()=>{await vi.advanceTimersByTimeAsync(400);});
    expect(mocks.saveDraft).toHaveBeenLastCalledWith(expect.objectContaining({product:expect.objectContaining({images:[],name:""}),campaign:expect.objectContaining({displayCopy:{version:1,openingMessage:"",offer:"خصم ٢٠٪ حتى الجمعة!",closingMessage:""}})}));
    await act(async()=>{fireEvent.change(screen.getByLabelText("Offer or message to display (optional)"),{target:{value:""}});});
    await act(async()=>{await vi.advanceTimersByTimeAsync(400);});
    expect(mocks.saveDraft).toHaveBeenLastCalledWith(expect.objectContaining({campaign:expect.objectContaining({displayCopy:{version:1,openingMessage:"",offer:"",closingMessage:""}})}));
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("returns signed-in owners to the filled form with a notice and does not auto-generate", async () => {
    mocks.user = { id: "11111111-1111-4111-8111-111111111111" };
    show(`/create?project=${PROJECT_ID}&resume=ready`);
    await act(async () => {});
    expect(screen.getByText("You're signed in. Press Generate to start.")).toBeVisible();
    expect(screen.getByLabelText(/^Brand name/)).toHaveValue("Oud Al Layl");
    expect(mocks.start).not.toHaveBeenCalled();
    expect(screen.getByTestId("gate")).toHaveTextContent("closed");
  });
});
