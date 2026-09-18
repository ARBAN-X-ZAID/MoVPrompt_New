import { describe, expect, it } from "vitest";

import { CampaignSettingsSchema, CampaignSourceSchema } from "./creator.js";

describe("creator contracts", () => {
  it("accepts durable campaign source identifiers but rejects browser and signed URLs", () => {
    expect(CampaignSourceSchema.parse({
      kind: "service_manual",
      subject: "product",
      assetKeys: ["creator-assets/user/project/product-image"],
      facts: [{ field: "name", value: "Northfield No. 07", provenance: "manual" }],
    })).toMatchObject({ subject: "product" });

    expect(() => CampaignSourceSchema.parse({
      kind: "product_upload",
      subject: "product",
      assetKeys: ["blob:https://movprompt.test/preview"],
      facts: [],
    })).toThrow();
  });

  it("rejects unsupported or hidden Kuwait campaign settings instead of dropping them", () => {
    const campaign = {
      promotionKind: "product" as const,
      vertical: "ecommerce" as const,
      goal: "whatsapp_orders" as const,
      presenterMode: "none" as const,
      presenter: { mode: "none" as const },
      market: "KW" as const,
      language: "bilingual" as const,
      arabicDialect: "kuwaiti" as const,
      dialectRegister: "conversational" as const,
      location: "Kuwait City",
      bookingUrl: "",
      whatsapp: "+96550000000",
      price: "12.500",
      offer: "Free delivery",
      cta: "Order on WhatsApp",
      brand: "Northfield",
      brandColor: "#d49737",
      aspectRatio: "9:16" as const,
      resolution: "720p" as const,
      subtitles: true,
      audio: true,
    };
    expect(CampaignSettingsSchema.safeParse(campaign).success).toBe(true);
    expect(CampaignSettingsSchema.safeParse({ ...campaign, market: "SA" }).success).toBe(false);
    expect(CampaignSettingsSchema.safeParse({ ...campaign, price: "12.5" }).success).toBe(false);
    expect(CampaignSettingsSchema.safeParse({ ...campaign, hiddenProviderModel: "anything" }).success).toBe(false);
  });
});
