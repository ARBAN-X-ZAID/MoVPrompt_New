import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defaultNativeUgcSettings, TemplateCampaignPayloadSchema, type NativeUgcSettings } from "@movprompt/contracts";
import { compileCreativeDirection } from "@movprompt/creative-engine";
import { createDraftProject, projectKeepingContentForTemplate } from "./templates";
import { buildPortableGenerationConfiguration, portableCampaignRecipe, portableConfiguration, portableProductRecipe } from "./projectStore";
import { projectToCreationDraft } from "./contracts";
import { NativeUgcForm } from "./NativeUgcForm";
import { projectWithBrandAdSettings } from "./adStudioBrandAdProject";

function project(templateId = "female-product-review") {
  let value = createDraftProject(templateId);
  value.product.name = "Kinza";
  value.product.sourceType = "upload";
  value.product.images = [{ id: "11111111-1111-4111-8111-111111111111", name: "product.jpg", source: "upload", url: "https://example.test/product.jpg", mimeType: "image/jpeg", checksum: "a".repeat(64), storagePath: `creator-assets/owner/${value.id}/product.jpg`, referenceRole: "subject", selected: true }];
  if (templateId === "ad-studio-brand-ad") value = projectWithBrandAdSettings(value, { formVersion: 1, brandName: "Kinza", website: "", sellingPoints: "330 ml", aesthetics: "Natural light", audience: "Adults in Kuwait", description: "A beverage in a 330 ml can", socials: "", videoIdea: "One adult presents the exact can to camera, then a close-up and return to the speaker." });
  value.nativeUgc = { ...defaultNativeUgcSettings(), enabled: true, script: "Meet Kinza. Take a closer look. Shop now.", scriptApproved: true, approvedLanguage: "en" };
  value.audio = true;
  return value;
}
function withCharacter(value: ReturnType<typeof project>) {
  value.nativeUgc = { ...value.nativeUgc!, characterStyle: "reference_adult" };
  value.product.images.push({ id: "22222222-2222-4222-8222-222222222222", name: "presenter.jpg", source: "upload", url: "https://example.test/presenter.jpg", mimeType: "image/jpeg", checksum: "b".repeat(64), storagePath: `creator-assets/owner/${value.id}/presenter.jpg`, referenceRole: "character", selected: true, personRightsConfirmed: true });
  return value;
}
function payload(value: ReturnType<typeof project>) { return { configuration: portableConfiguration(value), productRecipe: portableProductRecipe(value), campaignRecipe: portableCampaignRecipe(value) }; }

describe("native Seedance UGC scope and immutable speech", () => {
  afterEach(cleanup);
  it.each(["female-product-review", "ad-studio-brand-ad"])("persists and compiles approved speech for %s", templateId => {
    const value = project(templateId);
    expect(TemplateCampaignPayloadSchema.safeParse(payload(value)).success).toBe(true);
    const generation = buildPortableGenerationConfiguration(value);
    const compiled = compileCreativeDirection({ rawPrompt: generation.prompt, creativeBrief: generation.creativeBrief, references: generation.references, aspectRatio: "9:16", audioEnabled: generation.audio });
    expect(compiled.prompt).toContain(JSON.stringify(value.nativeUgc!.script));
    expect(compiled.prompt).toContain("NATIVE SYNCHRONIZED SPEECH");
    expect(compiled.prompt).not.toContain("mouth stays still");
    expect(projectToCreationDraft(value, true).campaign.nativeUgc).toEqual(value.nativeUgc);
  });
  it.each(["female-product-review", "ad-studio-brand-ad"])("lets an uploaded character speak on %s only with bound consent", templateId => {
    const value = withCharacter(project(templateId));
    const unconsented = TemplateCampaignPayloadSchema.safeParse(payload(value));
    expect(unconsented.success).toBe(false);
    expect(JSON.stringify(unconsented.error?.issues)).toContain("native_ugc_speech_consent_required");
    value.nativeUgc = { ...value.nativeUgc!, speechConsent: { script: value.nativeUgc!.script, characterChecksums: ["b".repeat(64)] } };
    expect(TemplateCampaignPayloadSchema.safeParse(payload(value)).success).toBe(true);
    const generation = buildPortableGenerationConfiguration(value);
    const compiled = compileCreativeDirection({ rawPrompt: generation.prompt, creativeBrief: generation.creativeBrief, references: generation.references, aspectRatio: "9:16", audioEnabled: generation.audio });
    expect(compiled.prompt).toMatch(/ONE PRESENTER: use only the adult in \[Image \d\]/);
    expect(compiled.prompt).toContain("NATIVE SYNCHRONIZED SPEECH");
    expect(compiled.prompt).toContain(JSON.stringify(value.nativeUgc!.script));
  });
  it("rejects changing script, approval or language outside the bound snapshot", () => {
    const original = payload(project());
    const tampered = TemplateCampaignPayloadSchema.parse(JSON.parse(JSON.stringify(original)));
    tampered.configuration.generation.creativeBrief.nativeUgc!.script = "An unapproved medical claim";
    expect(TemplateCampaignPayloadSchema.safeParse(tampered).success).toBe(false);
    for (const patch of [{ scriptApproved: false }, { approvedLanguage: "ar" as const }, { script: "" }, { script: "too long ".repeat(30) }]) {
      const value = project(); value.nativeUgc = { ...value.nativeUgc!, ...patch };
      expect(TemplateCampaignPayloadSchema.safeParse(payload(value)).success).toBe(false);
    }
  });
  it("rejects native UGC settings on every other template and clears them when switching", () => {
    const value = project("premium-phone-reveal");
    expect(TemplateCampaignPayloadSchema.safeParse(payload(value)).success).toBe(false);
    const next = projectKeepingContentForTemplate(project(), "premium-phone-reveal");
    expect(next.nativeUgc).toBeUndefined();
    expect(buildPortableGenerationConfiguration(next).audio).toBe(false);
  });
  it("blocks uploaded portraits before a chargeable speaking render", () => {
    const value = project(); value.nativeUgc!.characterStyle = "reference_adult";
    expect(TemplateCampaignPayloadSchema.safeParse(payload(value)).success).toBe(false);
  });
  it("preserves the silent path without an enabled speech setting", () => {
    const value = project(); delete value.nativeUgc; value.audio = false;
    expect(TemplateCampaignPayloadSchema.safeParse(payload(value)).success).toBe(true);
    const generation = buildPortableGenerationConfiguration(value);
    expect(generation.audio).toBe(false);
    expect(compileCreativeDirection({ rawPrompt: generation.prompt, creativeBrief: generation.creativeBrief, references: generation.references, audioEnabled: false }).prompt).toContain("MUTED OUTPUT");
  });
  it("invalidates script approval when editing text and binds approval to language", () => {
    const value = project(); const onChange = vi.fn<(settings: NativeUgcSettings) => void>();
    render(<NativeUgcForm project={value} onChange={onChange} onFiles={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Exact spoken script"), { target: { value: "A new approved message" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ scriptApproved: false, approvedLanguage: undefined }));
    fireEvent.click(screen.getByLabelText("I approve these exact words and product claims in the selected language."));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ scriptApproved: false }));
  });
  it("keeps speech on when switching to an uploaded character", () => {
    const value = project(); const onChange = vi.fn<(settings: NativeUgcSettings) => void>();
    render(<NativeUgcForm project={value} onChange={onChange} onFiles={vi.fn()} showCharacterUpload />);
    fireEvent.click(screen.getByRole("radio", { name: "My uploaded character" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ characterStyle: "reference_adult", enabled: true, scriptApproved: false }));
  });
  it("lets an uploaded character speak once the owner consents for these exact words and photos", () => {
    const value = withCharacter(project()); const onChange = vi.fn<(settings: NativeUgcSettings) => void>();
    render(<NativeUgcForm project={value} onChange={onChange} onFiles={vi.fn()} showCharacterUpload />);
    const speaks = screen.getByRole("switch", { name: "Character speaks" });
    expect(speaks).toBeEnabled();
    expect(speaks).toHaveAccessibleDescription(/voice is generated/);
    expect(screen.getByRole("button", { name: /Add another angle/ })).toBeInTheDocument();
    const consent = screen.getByRole("checkbox", { name: /permission to show them speaking these exact words/ });
    expect(consent).not.toBeChecked();
    fireEvent.click(consent);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ speechConsent: { script: "Meet Kinza. Take a closer look. Shop now.", characterChecksums: ["b".repeat(64)] } }));
  });
  it("treats consent as withdrawn when the script or character photo changes", () => {
    const consented = withCharacter(project());
    consented.nativeUgc = { ...consented.nativeUgc!, speechConsent: { script: "An older script.", characterChecksums: ["b".repeat(64)] } };
    render(<NativeUgcForm project={consented} onChange={vi.fn()} onFiles={vi.fn()} showCharacterUpload />);
    expect(screen.getByRole("checkbox", { name: /permission to show them speaking/ })).not.toBeChecked();
  });
});
