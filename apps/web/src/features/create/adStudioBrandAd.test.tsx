import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AD_STUDIO_BRAND_AD_LIMITS, TemplateCampaignPayloadSchema, type AdStudioBrandAdSettings } from "@movprompt/contracts";
import { CreativeBriefSchema, compileTemplatePrompt } from "@movprompt/creative-engine";
vi.mock("./useCapabilities", () => ({ useCapabilities: () => ({ templateReady: true, active: { durations: [8, 15, 20] } }) }));
import { createDraftProject, getCreatorTemplate, projectWithDuration } from "./templates";
import { hiddenAdStudioSettingsReset, projectWithBrandAdSettings } from "./adStudioBrandAdProject";
import { withDisplayCopy } from "./displayCopyProject";
import { buildPortableGenerationConfiguration, portableCampaignRecipe, portableConfiguration, portableProductRecipe } from "./projectStore";
import { projectToCreationDraft } from "./contracts";
import { createMemoryGuestDraftStorage, getGuestDraft, saveGuestDraft, setGuestDraftStorageForTests } from "./guestDraftStore";
import { TemplateCreateScreen, type TemplateCreateScreenProps } from "./TemplateCreateScreen";
import type { CreatorProject } from "./types";

const complete: AdStudioBrandAdSettings = {
  formVersion: 1,
  brandName: "Oud Al Layl",
  website: "www.oudallayl.com",
  sellingPoints: "Lasts 12 hours, free delivery in Kuwait",
  aesthetics: "Dark luxury, warm gold light",
  audience: "Women 25 to 40 in Kuwait",
  description: "Handmade oud perfumes made in Kuwait",
  socials: "instagram.com/oudallayl",
  videoIdea: "A woman sprays the perfume on her wrist, smiles and says it lasts all day.",
};

function brandAdProject(settings: Partial<AdStudioBrandAdSettings> = complete, duration = 15): CreatorProject {
  const project = createDraftProject("ad-studio-brand-ad");
  project.product.sourceType = "upload";
  project.product.images = [{ id: "11111111-1111-4111-8111-111111111111", name: "bottle.png", source: "upload", url: "https://example.test/bottle.png", mimeType: "image/png", checksum: "a".repeat(64), storagePath: `creator-assets/owner/${project.id}/bottle.png`, referenceRole: "subject", selected: true }];
  return projectWithDuration(projectWithBrandAdSettings(project, { ...complete, ...settings }), duration);
}

function props(project: CreatorProject): TemplateCreateScreenProps {
  return { project, template: getCreatorTemplate(project.templateId), durationSeconds: project.durationSeconds, linkUrl: "", signedIn: false, hidePricing: true, quote: null, quoteState: "ready", onSettingsChange: vi.fn(), onBrandAdSettingsChange: vi.fn(), onProjectSettingsChange: vi.fn(), onDescriptionChange: vi.fn(), onLanguageChange: vi.fn(), onSecureCampaign: vi.fn(async () => project), onLibraryLogo: vi.fn(), onFiles: vi.fn(), onLinkChange: vi.fn(), onImportLink: vi.fn(), onCancelImport: vi.fn(), onDurationChange: vi.fn(), onAspectRatioChange: vi.fn(), onNameChange: vi.fn(), onMessageChange: vi.fn(), onChangeTemplate: vi.fn(), onGenerate: vi.fn() };
}

describe("Ad Studio brand ad form", () => {
  afterEach(() => { cleanup(); setGuestDraftStorageForTests(); });

  const toAdStep = () => fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  it("starts with only the brand kit", () => {
    render(<TemplateCreateScreen {...props(brandAdProject())} />);
    for (const [label, key] of [["Brand name", "brandName"], ["Selling points", "sellingPoints"], ["Aesthetics", "aesthetics"], ["Audience", "audience"], ["Description", "description"], ["Socials", "socials"]] as const) {
      const input = screen.getByLabelText(new RegExp(`^${label}`));
      expect(input).toHaveAttribute("placeholder");
      expect(input).toHaveAttribute("maxLength", String(AD_STUDIO_BRAND_AD_LIMITS[key]));
    }
    expect(screen.getByLabelText(/^Website/)).toHaveValue(complete.website);
    expect(screen.getByLabelText(/^Description/)).toBeRequired();
    expect(screen.getByLabelText(/^Audience/)).not.toBeRequired();
    expect(screen.queryByLabelText(/Fonts/)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate" })).not.toBeInTheDocument();
  });

  it("asks only for photos, idea, length and language on the ad step", () => {
    render(<TemplateCreateScreen {...props(brandAdProject())} />);
    toAdStep();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(screen.getByRole("combobox", { name: /^Length/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^Language/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/^What should happen/)).not.toBeRequired();
    for (const name of [/^Shape/, /^Resolution/]) expect(screen.queryByRole("combobox", { name })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Sound" })).not.toBeInTheDocument();
    expect(screen.queryByText("Offer or message to display")).not.toBeInTheDocument();
    expect(screen.queryByText("Closing message")).not.toBeInTheDocument();
    expect(screen.queryByText(/Character and speech/i)).not.toBeInTheDocument();
  });

  it("renders the Arabic copy right to left", () => {
    render(<TemplateCreateScreen {...props(brandAdProject())} arabic />);
    expect(screen.getByRole("heading", { name: "أنشئ هوية علامتك" }).closest("section")).toHaveAttribute("dir", "rtl");
    expect(screen.getByLabelText(/^الجمهور/)).toHaveAttribute("placeholder", "لمن هذه الإعلانات");
    expect(screen.getByRole("button", { name: "متابعة" })).toBeInTheDocument();
  });

  it("keeps the owner on the brand kit until brand name and description are filled", () => {
    const input = props(brandAdProject({ brandName: "", description: "", audience: "", sellingPoints: "" }));
    render(<TemplateCreateScreen {...input} />);
    toAdStep();
    expect(screen.getByRole("heading", { name: "Create your brand kit" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Fill in brand name.");
    expect(screen.getByRole("alert")).toHaveTextContent("Fill in description.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("audience");
    expect(screen.getByLabelText(/^Description/)).toHaveAttribute("aria-invalid", "true");
  });

  it("does not generate without a product photo, then generates with only the required fields", () => {
    const project = brandAdProject({ sellingPoints: "", aesthetics: "", audience: "", socials: "", videoIdea: "" });
    const photos = project.product.images;
    project.product.images = [];
    const input = props(project);
    const { rerender } = render(<TemplateCreateScreen {...input} />);
    toAdStep();
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(input.onGenerate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Add at least one product photo.");
    rerender(<TemplateCreateScreen {...input} project={{ ...project, product: { ...project.product, images: photos } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(input.onGenerate).toHaveBeenCalledOnce();
  });

  it("saves a website only once it is valid and blocks Continue until then", () => {
    const input = props(brandAdProject({ website: "" }));
    render(<TemplateCreateScreen {...input} />);
    fireEvent.change(screen.getByLabelText(/^Website/), { target: { value: "www" } });
    expect(input.onBrandAdSettingsChange).not.toHaveBeenCalled();
    toAdStep();
    expect(screen.getByRole("heading", { name: "Create your brand kit" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a website");
    fireEvent.change(screen.getByLabelText(/^Website/), { target: { value: "www.oud.com" } });
    expect(input.onBrandAdSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ website: "www.oud.com" }));
  });

  it("clears settings an older draft can no longer show", () => {
    const base = brandAdProject();
    const old = withDisplayCopy({ ...base, aspectRatio: "1:1", resolution: "480p", audio: false, nativeUgc: { enabled: false } as CreatorProject["nativeUgc"], product: { ...base.product, images: [...base.product.images, { ...base.product.images[0]!, id: "44444444-4444-4444-8444-444444444444", referenceRole: "character" }] } }, { offer: "20% off" });
    const input = props(old);
    render(<TemplateCreateScreen {...input} />);
    expect(input.onProjectSettingsChange).toHaveBeenCalledOnce();
    const changes = vi.mocked(input.onProjectSettingsChange!).mock.calls[0]![0];
    expect(changes).toMatchObject({ aspectRatio: "9:16", resolution: "720p", audio: true, nativeUgc: undefined });
    expect(changes.displayCopy?.offer).toBe("");
    expect(changes.product?.images.find(image => image.referenceRole === "character")?.selected).toBe(false);
    expect(hiddenAdStudioSettingsReset({ ...old, ...changes })).toBeNull();
    expect(hiddenAdStudioSettingsReset(base)).toBeNull();
  });

  it("offers English or Arabic only and moves old bilingual drafts to English", () => {
    const input = props({ ...brandAdProject(), language: "bilingual" });
    render(<TemplateCreateScreen {...input} />);
    toAdStep();
    const options = Array.from((screen.getByRole("combobox", { name: /^Language/ }) as HTMLSelectElement).options).map(option => option.value);
    expect(options).toEqual(["ar", "en"]);
    expect(input.onLanguageChange).toHaveBeenCalledWith("en");
  });

  it("rejects a bilingual Ad Studio campaign", () => {
    const project = { ...brandAdProject(), language: "bilingual" as const };
    const payload = { configuration: portableConfiguration(project), productRecipe: portableProductRecipe(project), campaignRecipe: portableCampaignRecipe(project) };
    const result = TemplateCampaignPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("Ad Studio videos are English or Arabic.");
  });

  it("sends field, length and language changes to the creator", () => {
    const input = props(brandAdProject());
    render(<TemplateCreateScreen {...input} />);
    fireEvent.change(screen.getByLabelText(/^Audience/), { target: { value: "Students" } });
    expect(input.onBrandAdSettingsChange).toHaveBeenCalledWith({ ...complete, audience: "Students" });
    toAdStep();
    fireEvent.change(screen.getByRole("combobox", { name: /^Length/ }), { target: { value: "20" } });
    expect(input.onDurationChange).toHaveBeenCalledWith(20);
    fireEvent.change(screen.getByRole("combobox", { name: /^Language/ }), { target: { value: "ar" } });
    expect(input.onLanguageChange).toHaveBeenCalledWith("ar");
  });

  it("returns to the ad step after sign-in and can go back to the brand kit", () => {
    render(<TemplateCreateScreen {...props(brandAdProject())} resumeNotice />);
    expect(screen.getByRole("button", { name: "Generate" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Create your brand kit" })).toBeInTheDocument();
  });

  it("sends the provider the same request settings a new Ad Studio project always did", () => {
    const project = createDraftProject("ad-studio-brand-ad");
    expect({ ratio: project.aspectRatio, resolution: project.resolution, audio: project.audio, speech: project.nativeUgc }).toEqual({ ratio: "9:16", resolution: "720p", audio: true, speech: undefined });
    const generation = buildPortableGenerationConfiguration(brandAdProject());
    expect({ ratio: generation.aspectRatio, resolution: generation.resolution, audio: generation.audio, speech: generation.creativeBrief?.nativeUgc }).toEqual({ ratio: "9:16", resolution: "720p", audio: true, speech: undefined });
  });

  it("offers only the languages the owner left on", () => {
    const input = props(brandAdProject());
    render(<TemplateCreateScreen {...input} template={{ ...input.template, languages: ["en"] }} />);
    toAdStep();
    const options = Array.from((screen.getByRole("combobox", { name: /^Language/ }) as HTMLSelectElement).options).map(option => option.value);
    expect(options).toEqual(["en"]);
  });

  it("shows the signed-in notice after returning from sign-in", () => {
    render(<TemplateCreateScreen {...props(brandAdProject())} resumeNotice />);
    expect(screen.getByRole("status")).toHaveTextContent("You're signed in. Press Generate to start.");
  });

  it.each([[8, "9:16", true], [15, "4:5", false], [20, "16:9", true]] as const)("persists a valid %is %s campaign with sound %s", (duration, ratio, audio) => {
    const project = { ...brandAdProject(complete, duration), aspectRatio: ratio, audio, resolution: "480p" as const };
    const payload = { configuration: portableConfiguration(project), productRecipe: portableProductRecipe(project), campaignRecipe: portableCampaignRecipe(project) };
    expect(TemplateCampaignPayloadSchema.safeParse(payload).success).toBe(true);
    const generation = buildPortableGenerationConfiguration(project);
    expect(generation.audio).toBe(audio);
    const compiled = compileTemplatePrompt({ brief: CreativeBriefSchema.parse(generation.creativeBrief), photos: generation.references, aspectRatio: ratio, audio });
    expect(compiled.prompt).toContain(complete.videoIdea);
    expect(compiled.prompt).toContain(complete.audience);
    expect(compiled.prompt).not.toContain(complete.website);
  });

  it("keeps the logo for the ending card and out of the video references", () => {
    const logoChecksum = "c".repeat(64);
    const project = brandAdProject({ logoChecksum });
    project.product.images.push({ id: "33333333-3333-4333-8333-333333333333", name: "logo.png", source: "upload", url: "https://example.test/logo.png", mimeType: "image/png", checksum: logoChecksum, storagePath: `creator-assets/owner/${project.id}/logo.png`, referenceRole: "artwork", selected: false });
    const payload = { configuration: portableConfiguration(project), productRecipe: portableProductRecipe(project), campaignRecipe: portableCampaignRecipe(project) };
    expect(TemplateCampaignPayloadSchema.safeParse(payload).success).toBe(true);
    const generation = buildPortableGenerationConfiguration(project);
    expect(generation.references.map(reference => reference.objectKey)).toEqual([`creator-assets/owner/${project.id}/bottle.png`]);
    expect(generation.creativeBrief?.adStudioBrandAd?.logoChecksum).toBe(logoChecksum);
  });

  it("restores the complete form from the guest draft saved before sign-in", async () => {
    setGuestDraftStorageForTests(createMemoryGuestDraftStorage());
    const project = brandAdProject();
    const draft = projectToCreationDraft(project, true);
    await saveGuestDraft(draft);
    const restored = await getGuestDraft(draft.id);
    expect(restored?.campaign.adStudioBrandAd).toEqual(complete);
    expect(restored?.campaign.audio).toBe(true);
    expect(restored?.product.images).toEqual(draft.product.images);
  });
});
