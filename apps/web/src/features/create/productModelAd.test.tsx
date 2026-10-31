import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { PRODUCT_MODEL_AD_FORM, TemplateCampaignPayloadSchema, defaultProductModelAdSettings } from "@movprompt/contracts";
import { CreativeBriefSchema, compileTemplatePrompt } from "@movprompt/creative-engine";
vi.mock("./useCapabilities", () => ({ useCapabilities: () => ({ templateReady: true, active: { durations: [8, 15, 20] } }) }));
vi.mock("./brandKitApi", () => ({ brandKitApi: { list: vi.fn(), save: vi.fn(), logo: vi.fn() } }));
import { brandKitApi } from "./brandKitApi";
import { createDraftProject, CREATOR_TEMPLATES, getCreatorTemplate, projectWithDuration, projectKeepingContentForTemplate } from "./templates";
import { projectWithModelAdSettings } from "./productModelAdProject";
import { portableCampaignRecipe, portableConfiguration, portableProductRecipe, buildPortableGenerationConfiguration } from "./projectStore";
import { projectToCreationDraft } from "./contracts";
import { CreateScreen } from "./CreateScreen";
import { TemplateCreateScreen } from "./TemplateCreateScreen";
import { ProductModelAdScreen, type ProductModelAdScreenProps } from "./ProductModelAdScreen";
import { createTemplateQuoteKey } from "./templateQuoteState";
import { createMemoryGuestDraftStorage, getGuestDraft, saveGuestDraft, setGuestDraftStorageForTests } from "./guestDraftStore";
import { buildGuestClaimSnapshot } from "./guestClaimSnapshot";

export function modelAdProject(duration = 8) {
  const project = createDraftProject("product-with-model-ad");
  project.product.name = "Leather bag";
  project.product.sourceType = "upload";
  project.product.images = [{ id: "11111111-1111-4111-8111-111111111111", name: "bag.png", source: "upload", url: "https://example.test/bag.png", mimeType: "image/png", checksum: "a".repeat(64), storagePath: `creator-assets/owner/${project.id}/bag.png`, referenceRole: "subject", selected: true }];
  const settings = defaultProductModelAdSettings(); settings.brandKit.name = "My shop";
  return projectWithDuration(projectWithModelAdSettings(project, settings), duration);
}
function props(project = modelAdProject()): ProductModelAdScreenProps {
  return { project, template: getCreatorTemplate(project.templateId), durationSeconds: project.durationSeconds, linkUrl: "", signedIn: false, hidePricing: true, quote: null, quoteState: "ready", onSettingsChange: vi.fn(), onDescriptionChange: vi.fn(), onLanguageChange: vi.fn(), onSecureCampaign: vi.fn(async () => project), onLibraryLogo: vi.fn(), onFiles: vi.fn(), onLinkChange: vi.fn(), onImportLink: vi.fn(), onCancelImport: vi.fn(), onDurationChange: vi.fn(), onNameChange: vi.fn(), onActionChange: vi.fn(), onMessageChange: vi.fn(), onChangeTemplate: vi.fn(), onGenerate: vi.fn() };
}
describe("new form and existing-form isolation", () => {
  afterEach(() => setGuestDraftStorageForTests());
  it("publishes only the simplified custom form fields without changing the persisted snapshot contract", () => {
    expect(PRODUCT_MODEL_AD_FORM.sections).toEqual(["product", "presenter", "finish", "review"]);
    expect(PRODUCT_MODEL_AD_FORM.fields.map(field => field.key)).toEqual(["productPhotos", "modelChoice", "characterPhotos", "brandKit.logoChecksum", "cta", "language", "durationSeconds"]);
    expect(PRODUCT_MODEL_AD_FORM.fields.find(field => field.key === "brandKit.logoChecksum")?.section).toBe("presenter");
  });
  it("restores 15s product/model roles, permissions, old brand facts and stable claim identity", async () => {
    setGuestDraftStorageForTests(createMemoryGuestDraftStorage());
    const project = modelAdProject(15);
    project.productModelAd!.modelChoice = "reference_adult";
    project.productModelAd!.brandKit.tagline = "Saved earlier";
    project.product.images.push({ ...project.product.images[0], id: "22222222-2222-4222-8222-222222222222", name: "model.png", referenceRole: "character", checksum: "b".repeat(64), personRightsConfirmed: true });
    const draft = projectToCreationDraft(project, true);
    await saveGuestDraft(draft);
    const restored = await getGuestDraft(draft.id);
    expect(restored?.campaign.productModelAd).toEqual(project.productModelAd);
    expect(restored?.campaign.durationSeconds).toBe(15);
    expect(restored?.durationVariant).toBe(buildPortableGenerationConfiguration(project).creativeBrief?.durationVariant);
    expect(restored?.product.images).toEqual(draft.product.images);
    const claim = { draftId: draft.id, pendingGenerationId: "33333333-3333-4333-8333-333333333333", assetManifest: [], title: project.title, mode: "template" as const, configuration: portableConfiguration(project), productRecipe: portableProductRecipe(project), campaignRecipe: portableCampaignRecipe(project) };
    const first = await buildGuestClaimSnapshot(claim);
    expect((await buildGuestClaimSnapshot(JSON.parse(JSON.stringify(claim)))).snapshotDigest).toBe(first.snapshotDigest);
  });
  it("shows only product upload, presenter and final ad controls", () => {
    const input = props(); input.signedIn = true;
    render(<ProductModelAdScreen {...input} />);
    expect(screen.queryByText("Product category")).not.toBeInTheDocument();
    expect(screen.queryByText("Saved brand kit")).not.toBeInTheDocument();
    expect(brandKitApi.list).not.toHaveBeenCalled();
    expect(screen.queryByText("More brand options (optional)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tagline (optional)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Brand style")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save reusable brand kit" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Product" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Presenter" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Character style" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Generated realistic adult/ })).toBeChecked();
    expect(screen.getByLabelText("Product images")).toHaveAttribute("multiple");
    expect(screen.getByText("Drag product images here")).toBeInTheDocument();
    expect(screen.getByText("Choose images")).toBeInTheDocument();
    expect(screen.getByLabelText("Logo (optional)")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Closing action/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Message language" })).toBeInTheDocument();
    expect(screen.getByText("Video length")).toBeInTheDocument();
    expect(screen.queryByLabelText("Product name (optional)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Description (optional)")).not.toBeInTheDocument();
    expect(screen.queryByText("Brand and ad details")).not.toBeInTheDocument();
    expect(screen.queryByText("More video options")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Fonts")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Audience")).not.toBeInTheDocument();
  });
  it("offers English or Arabic messages only and moves old bilingual drafts to English", () => {
    const input = props({ ...modelAdProject(), language: "bilingual" });
    render(<ProductModelAdScreen {...input} />);
    const group = screen.getByRole("group", { name: "Message language" });
    expect(within(group).getAllByRole("radio").map(radio => (radio as HTMLInputElement).value)).toEqual(["en", "ar"]);
    expect(input.onLanguageChange).toHaveBeenCalledWith("en");
  });

  it("offers only the languages the owner left on", () => {
    const input = props({ ...modelAdProject(), language: "bilingual" });
    render(<ProductModelAdScreen {...input} template={{ ...input.template, languages: ["ar"] }} />);
    const group = screen.getByRole("group", { name: "Message language" });
    expect(within(group).getAllByRole("radio").map(radio => (radio as HTMLInputElement).value)).toEqual(["ar"]);
    expect(input.onLanguageChange).toHaveBeenCalledWith("ar");
  });

  it("updates the visible closing action while retaining saved brand facts", () => {
    const input = props(); input.project.productModelAd!.libraryKitId = "22222222-2222-4222-8222-222222222222";
    input.project.productModelAd!.libraryRevision = 2;
    input.project.productModelAd!.brandKit.audience = "Existing audience";
    render(<ProductModelAdScreen {...input} />);
    fireEvent.change(screen.getByRole("textbox", { name: /^Closing action/ }), { target: { value: "Order now" } });
    expect(input.onActionChange).toHaveBeenCalledWith("Order now");
    const next = input.project;
    const parsed = TemplateCampaignPayloadSchema.safeParse({ configuration: portableConfiguration(next), productRecipe: portableProductRecipe(next), campaignRecipe: portableCampaignRecipe(next) }); expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });
  it("keeps legacy presenter action values in saved drafts without exposing an action control", () => {
    const input = props(); input.project.productModelAd!.category = "clothing"; input.project.productModelAd!.action = "wear";
    render(<ProductModelAdScreen {...input} />);
    expect(screen.queryByLabelText("Presenter action")).not.toBeInTheDocument();
    expect(input.project.productModelAd!.action).toBe("wear");
  });
  it("derives the initial brand kit from saved facts without requiring a form edit", () => {
    const project = modelAdProject(); delete project.productModelAd;
    const payload = { configuration: portableConfiguration(project), productRecipe: portableProductRecipe(project), campaignRecipe: portableCampaignRecipe(project) };
    expect(TemplateCampaignPayloadSchema.safeParse(payload).success).toBe(true);
    expect(projectToCreationDraft(project, true).campaign.productModelAd?.brandKit.name).toBe("My shop");
  });
  it("preserves brand details and saved photos when moving from an existing template", () => {
    const project = modelAdProject(); project.templateId = "fashion-product-showcase";
    project.product.brand = "Saved brand"; project.source = undefined; delete project.productModelAd;
    const next = projectKeepingContentForTemplate(project, "product-with-model-ad");
    expect(next.productModelAd?.brandKit.name).toBe("Saved brand"); expect(next.brandColor).toBe(project.brandColor);
    expect(next.product.images.map(image => image.id)).toEqual(project.product.images.map(image => image.id));
    const parsed = TemplateCampaignPayloadSchema.safeParse({ configuration: portableConfiguration(next), productRecipe: portableProductRecipe(next), campaignRecipe: portableCampaignRecipe(next) }); expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });
  it.each(CREATOR_TEMPLATES.map(template => template.id))("keeps the %s form markup unchanged", id => {
    const input = props(createDraftProject(id));
    const normalize = (html: string) => html.replace(/:R[\da-z]+:/gi, ":id:");
    expect(normalize(renderToStaticMarkup(<TemplateCreateScreen {...input} />))).toBe(normalize(renderToStaticMarkup(<CreateScreen {...input} />)));
  });
  it.each([8, 15, 20])("persists and compiles the complete %is custom campaign", duration => {
    const project = modelAdProject(duration);
    project.productModelAd!.aesthetics = "muted colors and natural light";
    project.productModelAd!.sellingPoint = "Easy to carry";
    const payload = { configuration: portableConfiguration(project), productRecipe: portableProductRecipe(project), campaignRecipe: portableCampaignRecipe(project) };
    expect(TemplateCampaignPayloadSchema.safeParse(payload).success).toBe(true);
    const generation = buildPortableGenerationConfiguration(project);
    const compiled = compileTemplatePrompt({ brief: CreativeBriefSchema.parse(generation.creativeBrief), photos: generation.references, aspectRatio: "9:16" });
    expect(compiled.prompt).toContain("My shop");
    expect(compiled.prompt).toContain("muted colors and natural light");
    expect(compiled.prompt).toContain("Easy to carry");
    expect(projectToCreationDraft(project, true).campaign.productModelAd).toEqual(project.productModelAd);
  });
  it("rejects a tampered saved brand snapshot and preserves the original kit", () => {
    const project = modelAdProject(); const payload = { configuration: portableConfiguration(project), productRecipe: portableProductRecipe(project), campaignRecipe: portableCampaignRecipe(project) };
    const tampered = JSON.parse(JSON.stringify(payload)); tampered.configuration.generation.creativeBrief.productModelAd.brandKit.name = "Forged";
    expect(TemplateCampaignPayloadSchema.safeParse(tampered).success).toBe(false);
    const settings = defaultProductModelAdSettings(); settings.brandKit.name = "Updated kit";
    const changed = projectWithModelAdSettings(project, settings); settings.brandKit.name = "Changed again";
    expect(changed.productModelAd?.brandKit.name).toBe("Updated kit");
    expect(project.productModelAd?.brandKit.name).toBe("My shop");
  });
  it("invalidates quote identity for custom action, kit and duration changes", () => {
    const project = modelAdProject(); const key = createTemplateQuoteKey("version", buildPortableGenerationConfiguration(project));
    const changed = projectWithModelAdSettings(project, { ...project.productModelAd!, action: "present" });
    expect(createTemplateQuoteKey("version", buildPortableGenerationConfiguration(changed))).not.toBe(key);
    expect(createTemplateQuoteKey("version", buildPortableGenerationConfiguration(projectWithDuration(project, 15)))).not.toBe(key);
  });
  it("shows custom sections, duration selection and errors below Generate", () => {
    const input = props(); input.generationError = "Test failure";
    render(<ProductModelAdScreen {...input} />);
    expect(screen.getByText("Finish your ad")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("15 seconds")); expect(input.onDurationChange).toHaveBeenCalledWith(15);
    const button = screen.getByRole("button", { name: "Generate video" });
    expect(button.compareDocumentPosition(screen.getByText("Test failure")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText("What shape should it be?")).not.toBeInTheDocument();
  });
});
