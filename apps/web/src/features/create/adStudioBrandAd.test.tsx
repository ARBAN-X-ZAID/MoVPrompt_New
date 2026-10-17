import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AD_STUDIO_BRAND_AD_LIMITS, TemplateCampaignPayloadSchema, type AdStudioBrandAdSettings } from "@movprompt/contracts";
import { CreativeBriefSchema, compileTemplatePrompt } from "@movprompt/creative-engine";
vi.mock("./useCapabilities", () => ({ useCapabilities: () => ({ templateReady: true, active: { durations: [8, 15, 20] } }) }));
import { createDraftProject, getCreatorTemplate, projectWithDuration } from "./templates";
import { projectWithBrandAdSettings } from "./adStudioBrandAdProject";
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

  it("shows every field with a placeholder, a hint and a character counter, and no fonts field", () => {
    render(<TemplateCreateScreen {...props(brandAdProject())} />);
    for (const [label, key] of [["Brand name", "brandName"], ["Selling points", "sellingPoints"], ["Aesthetics", "aesthetics"], ["Audience", "audience"], ["Description", "description"], ["Socials", "socials"], ["What should happen in the video?", "videoIdea"]] as const) {
      const input = screen.getByLabelText(new RegExp(`^${label.replace("?", "\\?")}`));
      expect(input).toHaveAttribute("placeholder");
      expect(input).toHaveAttribute("maxLength", String(AD_STUDIO_BRAND_AD_LIMITS[key]));
      expect(input.getAttribute("aria-describedby")?.split(" ")).toHaveLength(2);
      expect(screen.getByText(`${Array.from(complete[key]).length}/${AD_STUDIO_BRAND_AD_LIMITS[key]}`)).toBeInTheDocument();
    }
    expect(screen.getByLabelText(/^Audience/)).toBeRequired();
    expect(screen.queryByLabelText(/^Website/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Fonts/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(4);
    expect(screen.getByRole("combobox", { name: /^Resolution/ })).toHaveValue("720p");
    expect(screen.getByRole("switch", { name: "Sound" })).toBeChecked();
  });

  it("renders the Arabic copy right to left", () => {
    render(<TemplateCreateScreen {...props(brandAdProject())} arabic />);
    expect(screen.getByRole("heading", { name: "أنشئ هوية علامتك" }).closest("section")).toHaveAttribute("dir", "rtl");
    expect(screen.getByLabelText(/^الجمهور/)).toHaveAttribute("placeholder", "مثال: نساء من 25 إلى 40 في الكويت");
    expect(screen.getByRole("button", { name: "إنشاء" })).toBeInTheDocument();
  });

  it("does not generate until every required field and a product photo are present", () => {
    const project = brandAdProject({ audience: "", videoIdea: "" });
    project.product.images = [];
    const input = props(project);
    render(<TemplateCreateScreen {...input} />);
    expect(screen.getByText("3 required items left")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(input.onGenerate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Add at least one product photo.");
    expect(screen.getByRole("alert")).toHaveTextContent("Fill in audience.");
    expect(screen.getByRole("alert")).toHaveTextContent("Describe what should happen in the video.");
    expect(screen.getByLabelText(/^Audience/)).toHaveAttribute("aria-invalid", "true");
  });

  it("does not ask for a website", () => {
    render(<TemplateCreateScreen {...props(brandAdProject())} />);
    expect(screen.queryByRole("textbox", { name: /^Website/ })).not.toBeInTheDocument();
  });

  it("sends field, shape, resolution and sound changes to the creator", () => {
    const input = props(brandAdProject());
    render(<TemplateCreateScreen {...input} />);
    fireEvent.change(screen.getByLabelText(/^Audience/), { target: { value: "Students" } });
    expect(input.onBrandAdSettingsChange).toHaveBeenCalledWith({ ...complete, audience: "Students", website: "" });
    fireEvent.change(screen.getByRole("combobox", { name: /^Shape/ }), { target: { value: "4:5" } });
    expect(input.onAspectRatioChange).toHaveBeenCalledWith("4:5");
    fireEvent.change(screen.getByRole("combobox", { name: /^Resolution/ }), { target: { value: "480p" } });
    expect(input.onProjectSettingsChange).toHaveBeenCalledWith({ resolution: "480p" });
    fireEvent.click(screen.getByRole("switch", { name: "Sound" }));
    expect(input.onProjectSettingsChange).toHaveBeenCalledWith({ audio: false });
    fireEvent.change(screen.getByRole("combobox", { name: /^Length/ }), { target: { value: "20" } });
    expect(input.onDurationChange).toHaveBeenCalledWith(20);
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
    expect(restored?.campaign.adStudioBrandAd).toEqual({ ...complete, website: "" });
    expect(restored?.campaign.audio).toBe(true);
    expect(restored?.product.images).toEqual(draft.product.images);
  });
});
