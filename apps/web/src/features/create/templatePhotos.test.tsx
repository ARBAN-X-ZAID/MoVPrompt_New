import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TemplateCampaignPayloadSchema, templatePhotoIssues } from "@movprompt/contracts";
import { LAUNCH_PHOTO_POLICIES } from "@movprompt/creative-engine";
import { TemplatePhotos } from "./TemplatePhotos";
import { createDraftProject, projectKeepingContentForTemplate, projectWithDuration } from "./templates";
import { buildPortableGenerationConfiguration, portableCampaignRecipe, portableConfiguration, portableProductRecipe } from "./projectStore";
import { projectToCreationDraft } from "./contracts";
import { createMemoryGuestDraftStorage, getGuestDraft, saveGuestDraft, setGuestDraftStorageForTests } from "./guestDraftStore";
import { mergeClaimedCreatorProject } from "./creatorProjectAssets";
import type { CreatorAsset } from "./types";

function photo(index: number, changes: Partial<CreatorAsset> = {}): CreatorAsset {
  return { id: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`, name: `Photo ${index}`, url: "blob:test", mimeType: "image/png", source: "upload", checksum: String(index).repeat(64), referenceRole: "subject", selected: true, ...changes };
}

describe("template photo selection", () => {
  afterEach(() => setGuestDraftStorageForTests());
  it("limits single-photo inputs and offers replacement without losing older photos", () => {
    const onFiles = vi.fn();
    render(<TemplatePhotos templateId="perfume-advertisement" images={[photo(1)]} onFiles={onFiles} />);
    expect(screen.getByText("Replace photo")).toBeVisible();
    const input = screen.getByLabelText("Selected photos", {selector:"input"}) as HTMLInputElement;
    expect(input.multiple).toBe(false);
    expect(input.accept).not.toContain("video");
    const file = new File(["photo"], "photo.png", {type:"image/png"});
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFiles).toHaveBeenCalledWith([file], "subject", true);
  });
  it("separates product and adult character groups, with per-photo rights", () => {
    const onPhotoChange = vi.fn();
    render(<TemplatePhotos templateId="female-product-review" images={[photo(1), photo(2, {referenceRole:"character"})]} onFiles={vi.fn()} onPhotoChange={onPhotoChange} />);
    expect(screen.getByRole("group", {name:"Product photos — 1/3"})).toBeVisible();
    expect(screen.getByRole("group", {name:"Character photos (optional) — 1/3"})).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", {name:/This is the same adult/}));
    expect(onPhotoChange).toHaveBeenCalledWith(photo(2).id, {personRightsConfirmed:true});
  });
  it("exposes keyboard-accessible ordering instead of requiring a drag", () => {
    const onMovePhoto = vi.fn();
    render(<TemplatePhotos templateId="real-estate-property" images={[photo(1,{referenceRole:"property"}),photo(2,{referenceRole:"property"})]} onFiles={vi.fn()} onMovePhoto={onMovePhoto} />);
    expect(screen.getByRole("button", {name:"Move photo 1 earlier"})).toBeDisabled();
    fireEvent.click(screen.getByRole("button", {name:"Move photo 2 earlier"}));
    expect(onMovePhoto).toHaveBeenCalledWith(photo(2).id,-1);
  });
  it("preserves excess uploads when changing to a one-photo template", () => {
    const project = createDraftProject("premium-phone-reveal");
    project.product.images = [photo(1),photo(2),photo(3)];
    const switched = projectKeepingContentForTemplate(project,"perfume-advertisement");
    expect(switched.product.images).toHaveLength(3);
    expect(templatePhotoIssues(LAUNCH_PHOTO_POLICIES[switched.templateId]!,switched.product.images)).toContain("subject_photo_limit_1");
  });
  it("restores roles, order, rights, checksums and duration through guest saving and claiming", async () => {
    setGuestDraftStorageForTests(createMemoryGuestDraftStorage());
    const project = projectWithDuration(createDraftProject("female-product-review"),20);
    project.product.images = [photo(2,{referenceRole:"character",personRightsConfirmed:true}),photo(1),photo(3,{selected:false})];
    await saveGuestDraft(projectToCreationDraft(project,true));
    const restored = await getGuestDraft(project.id);
    expect(restored!.product.images.map(({ id, referenceRole, selected, checksum, personRightsConfirmed }) => ({id,referenceRole,selected,checksum,personRightsConfirmed}))).toEqual(project.product.images.map(({ id, referenceRole, selected, checksum, personRightsConfirmed })=>({id,referenceRole,selected,checksum,personRightsConfirmed})));
    expect(restored!.campaign.durationSeconds).toBe(20);
    expect(restored!.durationVariant).toBe("female-product-review-v3-20s");
    expect(restored!.templateRecipeVersion).toBe(3);
    const secured = project.product.images.map(image=>({...image,storagePath:`users/owner/projects/project/assets/product/${image.id}/${image.checksum}`}));
    const claimed = mergeClaimedCreatorProject(project,{...project,versionId:"22222222-2222-4222-8222-222222222222"},secured);
    const config = portableConfiguration(claimed);
    expect(TemplateCampaignPayloadSchema.safeParse({configuration:config,productRecipe:portableProductRecipe(claimed),campaignRecipe:portableCampaignRecipe(claimed)}).success).toBe(true);
    expect(buildPortableGenerationConfiguration(claimed).references.map(image=>image.referenceRole)).toEqual(["character","subject"]);
    expect(buildPortableGenerationConfiguration(claimed).creativeBrief.durationVariant).toBe("female-product-review-v3-20s");
    const tampered = structuredClone(config);
    (tampered.generation as {references:unknown[]}).references.reverse();
    expect(TemplateCampaignPayloadSchema.safeParse({configuration:tampered,productRecipe:portableProductRecipe(claimed),campaignRecipe:portableCampaignRecipe(claimed)}).success).toBe(false);
  });
});
