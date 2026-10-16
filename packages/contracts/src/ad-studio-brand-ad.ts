import { z } from "zod";

export const AD_STUDIO_BRAND_AD_ID = "ad-studio-brand-ad";

/**
 * Every typed field shares one Seedance prompt (8,000 characters). These limits
 * keep the owner's text within 3,460 characters so the compiled prompt, with
 * its fixed rules and a bounded quality retry, can never exceed the provider.
 */
export const AD_STUDIO_BRAND_AD_LIMITS = Object.freeze({
  brandName: 60,
  website: 200,
  sellingPoints: 300,
  aesthetics: 300,
  audience: 200,
  description: 600,
  socials: 200,
  videoIdea: 2_000,
});

export const AD_STUDIO_BRAND_AD_REQUIRED = ["brandName", "sellingPoints", "aesthetics", "audience", "description", "videoIdea"] as const;
export type AdStudioBrandAdRequiredField = (typeof AD_STUDIO_BRAND_AD_REQUIRED)[number];

const text = (max: number) => z.string().trim().max(max);
const website = z.union([
  z.literal(""),
  z.string().trim().max(AD_STUDIO_BRAND_AD_LIMITS.website).regex(/^(?:https?:\/\/)?[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+(?:[/?#]\S*)?$/iu, "Enter a website such as www.yourbrand.com."),
]);

/** Drafts may be incomplete; generation requires every field in AD_STUDIO_BRAND_AD_REQUIRED. */
export const AdStudioBrandAdSettingsSchema = z.object({
  formVersion: z.literal(1),
  brandName: text(AD_STUDIO_BRAND_AD_LIMITS.brandName),
  website,
  sellingPoints: text(AD_STUDIO_BRAND_AD_LIMITS.sellingPoints),
  aesthetics: text(AD_STUDIO_BRAND_AD_LIMITS.aesthetics),
  audience: text(AD_STUDIO_BRAND_AD_LIMITS.audience),
  description: text(AD_STUDIO_BRAND_AD_LIMITS.description),
  socials: text(AD_STUDIO_BRAND_AD_LIMITS.socials),
  videoIdea: text(AD_STUDIO_BRAND_AD_LIMITS.videoIdea),
  // A checksum survives guest asset claiming and canonical ID replacement.
  logoChecksum: z.string().regex(/^[0-9a-f]{64}$/).optional(),
}).strict();
export type AdStudioBrandAdSettings = z.infer<typeof AdStudioBrandAdSettingsSchema>;

export function defaultAdStudioBrandAdSettings(): AdStudioBrandAdSettings {
  return { formVersion: 1, brandName: "", website: "", sellingPoints: "", aesthetics: "", audience: "", description: "", socials: "", videoIdea: "" };
}

export function missingAdStudioBrandAdFields(settings: AdStudioBrandAdSettings): AdStudioBrandAdRequiredField[] {
  return AD_STUDIO_BRAND_AD_REQUIRED.filter(field => !settings[field].trim());
}

export const AD_STUDIO_BRAND_AD_DURATIONS = [8, 15, 20] as const;
export const AD_STUDIO_BRAND_AD_RATIOS = ["9:16", "1:1", "4:5", "16:9"] as const;
export const AD_STUDIO_BRAND_AD_UPLOADS = Object.freeze({ subject: { min: 1, max: 3 }, logo: { min: 0, max: 1, providerReference: false } });
