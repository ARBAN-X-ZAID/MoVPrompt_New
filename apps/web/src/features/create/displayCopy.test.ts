import { describe, expect, it } from "vitest";
import { emptyDisplayCopy, legacyDisplayCopy, TemplateCampaignPayloadSchema } from "@movprompt/contracts";
import { CREATIVE_TEMPLATE_CATALOG, CUSTOM_FORM_TEMPLATE_CATALOG } from "@movprompt/creative-engine";
import { createDraftProject, projectKeepingContentForTemplate } from "./templates";
import { displayCopyForProject, withDisplayCopy } from "./displayCopyProject";
import { portableConfiguration, portableProductRecipe, portableCampaignRecipe } from "./projectStore";
import { projectWithBrandAdSettings } from "./adStudioBrandAdProject";
import { campaignPurposeChange } from "./templateCampaignOptions";
import { projectToCreationDraft } from "./contracts";

const templates = [...CREATIVE_TEMPLATE_CATALOG, ...CUSTOM_FORM_TEMPLATE_CATALOG];
function draft(id: string) {
  let value = createDraftProject(id);
  value.product = { ...value.product, name: "Northfield", brand: "Northfield", description: "Product facts are not display text", sourceType: "upload", images: [{ id: "11111111-1111-4111-8111-111111111111", name: "product.png", source: "upload", url: "", mimeType: "image/png", checksum: "a".repeat(64), storagePath: `users/u/projects/${value.id}/assets/product.png`, referenceRole: id === "real-estate-property" ? "property" : ["business-service-promotion", "new-york-billboard-takeover"].includes(id) ? "artwork" : "subject", selected: true }] };
  if (id === "ad-studio-brand-ad") value = projectWithBrandAdSettings(value, { formVersion: 1, brandName: "Northfield", website: "", sellingPoints: "Only supplied facts", aesthetics: "Natural", audience: "Adults", description: "Perfume", socials: "@not-display-copy", videoIdea: "Present the exact bottle" });
  return value;
}
function payload(value: ReturnType<typeof draft>) { return TemplateCampaignPayloadSchema.parse({ configuration: portableConfiguration(value), productRecipe: portableProductRecipe(value), campaignRecipe: portableCampaignRecipe(value) }); }

describe("explicit display copy on every template", () => {
  it.each(templates.map(t => t.id))("starts blank and supports exact optional copy on %s", id => {
    let value = draft(id);
    expect(value.cta).toBe(""); expect(value.subtitles).toBe(false);
    expect(displayCopyForProject(value)).toEqual(emptyDisplayCopy());
    for (const copy of [emptyDisplayCopy(), { ...emptyDisplayCopy(), offer: "20% off until Friday" }, { ...emptyDisplayCopy(), closingMessage: "اطلب اليوم — ٢٥٪" }, { ...emptyDisplayCopy(), offer: "20% off", closingMessage: "Visit us Friday!" }, { ...emptyDisplayCopy(), openingMessage: "  My opening!  ", offer: "  خصم ٢٥٪\nFriday!  ", closingMessage: "Visit us  Friday! " }, emptyDisplayCopy()]) {
      value = withDisplayCopy(value, copy);
      const body = payload(value);
      const result = TemplateCampaignPayloadSchema.safeParse(body);
      expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(true);
      expect(body.configuration.generation.creativeBrief.displayCopy).toEqual(copy);
      expect(projectToCreationDraft(value, true).campaign.displayCopy).toEqual(copy);
      expect(body.configuration.generation.creativeBrief.product.callToAction).toBe(copy.closingMessage);
      expect(campaignPurposeChange(value, "launch").displayCopy).toEqual(copy);
      expect(projectKeepingContentForTemplate({ ...value, durationSeconds: 8 }, "premium-phone-reveal").displayCopy).toEqual(copy);
    }
  });
  it("removes legacy stock defaults but preserves custom text and treats re-entered Shop now as explicit", () => {
    expect(legacyDisplayCopy({ cta: "Shop now" }).closingMessage).toBe("");
    expect(legacyDisplayCopy({ cta: "Come this Friday", offer: "خصم ٢٥٪" })).toMatchObject({ closingMessage: "Come this Friday", offer: "خصم ٢٥٪" });
    expect(displayCopyForProject(withDisplayCopy(draft("female-product-review"), { closingMessage: "Shop now" })).closingMessage).toBe("Shop now");
  });
  it("rejects changed copy or automatic subtitles outside the immutable snapshot", () => {
    const value = withDisplayCopy(draft("female-product-review"), { offer: "Exact offer" });
    const altered = structuredClone(payload(value));
    altered.configuration.generation.creativeBrief.displayCopy!.offer = "Invented offer";
    expect(TemplateCampaignPayloadSchema.safeParse(altered).success).toBe(false);
    const captions = structuredClone(payload(value)); captions.configuration.creatorProject.subtitles = true;
    expect(TemplateCampaignPayloadSchema.safeParse(captions).success).toBe(false);
  });
});
