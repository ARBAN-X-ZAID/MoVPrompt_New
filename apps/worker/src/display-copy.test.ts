import { describe, expect, it } from "vitest";
import { emptyDisplayCopy } from "@movprompt/contracts";
import { CREATIVE_TEMPLATE_CATALOG, CUSTOM_FORM_TEMPLATE_CATALOG } from "@movprompt/creative-engine";
import { campaignOutputText } from "./campaign-output-text.js";
import { modelAdLayers } from "./product-model-ad-finishing.js";
import { productModelAdFixture } from "../../api/src/product-model-ad.test-fixture.js";
import { adStudioBrandAdFixture } from "../../api/src/ad-studio-brand-ad.test-fixture.js";

describe("display-copy finishing for all templates", () => {
  it.each([...CREATIVE_TEMPLATE_CATALOG, ...CUSTOM_FORM_TEMPLATE_CATALOG].map(t=>t.id))("only uses explicit optional copy on %s", templateId => {
    for (const copy of [emptyDisplayCopy(), { ...emptyDisplayCopy(), openingMessage: "My opening only" }, { ...emptyDisplayCopy(), offer: "20% off until Friday" }, { ...emptyDisplayCopy(), closingMessage: "خصم ٢٥٪ — اليوم فقط!" }, { ...emptyDisplayCopy(), offer: "First line\nSecond line", closingMessage: "Exactly this." }, emptyDisplayCopy()]) {
      const result = campaignOutputText({ generation: { creativeBrief: { templateId, displayCopy: copy, product: { name: "Do not display", brand: "Do not display", description: "Do not display", whatsapp: "+96550000000", callToAction: "Shop now", offer: "Do not use facts as display copy" } } } });
      expect(result).toEqual(copy.openingMessage || copy.offer || copy.closingMessage ? { ...(copy.openingMessage ? { openingMessage: copy.openingMessage } : {}), ...(copy.offer ? { offer: copy.offer } : {}), ...(copy.closingMessage ? { callToAction: copy.closingMessage } : {}) } : null);
    }
  });
  it.each(["model", "adstudio"])("does not create an empty card or auto branding for %s", async type => {
    const payload = type === "model" ? productModelAdFixture() : adStudioBrandAdFixture();
    const brief = payload.configuration.generation.creativeBrief;
    brief.displayCopy = emptyDisplayCopy();
    expect(await modelAdLayers(payload.configuration, 480, 854)).toBeNull();
    brief.displayCopy.openingMessage = "Only my opening message";
    const opening = await modelAdLayers(payload.configuration, 480, 854);
    expect(opening?.opening?.length).toBeGreaterThan(100); expect(opening?.closing).toBeUndefined();
    brief.displayCopy = { ...emptyDisplayCopy(), offer: "20% off until Friday" };
    expect((await modelAdLayers(payload.configuration, 480, 854))?.closing?.length).toBeGreaterThan(100);
  });
});
