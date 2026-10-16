import { describe, expect, it } from "vitest";
import {
  AD_STUDIO_BRAND_AD_LIMITS,
  AdStudioBrandAdSettingsSchema,
  defaultAdStudioBrandAdSettings,
  missingAdStudioBrandAdFields,
} from "./ad-studio-brand-ad.js";

const complete = () => ({
  ...defaultAdStudioBrandAdSettings(),
  brandName: "Oud Al Layl",
  website: "www.oudallayl.com",
  sellingPoints: "Free delivery in Kuwait, lasts 12 hours",
  aesthetics: "Dark, luxury, warm gold light",
  audience: "Women 25 to 40 in Kuwait",
  description: "Handmade oud perfumes made in Kuwait",
  videoIdea: "A woman sprays the perfume on her wrist and smiles.",
});

describe("Ad Studio brand ad settings", () => {
  it("keeps the owner's prompt text within the shared provider budget", () => {
    const promptFields = ["brandName", "sellingPoints", "aesthetics", "audience", "description", "videoIdea"] as const;
    expect(promptFields.reduce((sum, key) => sum + AD_STUDIO_BRAND_AD_LIMITS[key], 0)).toBe(3_460);
  });

  it("accepts drafts but reports every missing required field", () => {
    expect(missingAdStudioBrandAdFields(AdStudioBrandAdSettingsSchema.parse(defaultAdStudioBrandAdSettings())))
      .toEqual(["brandName", "sellingPoints", "aesthetics", "audience", "description", "videoIdea"]);
    expect(missingAdStudioBrandAdFields(AdStudioBrandAdSettingsSchema.parse(complete()))).toEqual([]);
  });

  it("rejects text beyond each limit and malformed websites", () => {
    for (const [key, max] of Object.entries(AD_STUDIO_BRAND_AD_LIMITS)) {
      if (key === "website") continue;
      expect(AdStudioBrandAdSettingsSchema.safeParse({ ...complete(), [key]: "a".repeat(max) }).success).toBe(true);
      expect(AdStudioBrandAdSettingsSchema.safeParse({ ...complete(), [key]: "a".repeat(max + 1) }).success).toBe(false);
    }
    expect(AdStudioBrandAdSettingsSchema.safeParse({ ...complete(), website: "https://oudallayl.com/shop" }).success).toBe(true);
    expect(AdStudioBrandAdSettingsSchema.safeParse({ ...complete(), website: "not a site" }).success).toBe(false);
    expect(AdStudioBrandAdSettingsSchema.safeParse({ ...complete(), fonts: "Inter" }).success).toBe(false);
  });
});
