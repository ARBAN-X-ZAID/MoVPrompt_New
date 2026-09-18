import type { CampaignGoal } from "@movprompt/contracts";
import { CATEGORY_PREVIEW_TEMPLATE_IDS } from "@movprompt/creative-engine";

export type TemplateMediaTone = "warm" | "cool" | "soft" | "vivid" | "neutral";

export type TemplateMediaSpec = {
  poster: string;
  previewVideo: string | null;
  posterPosition: string;
  mediaCode: string;
  mediaTone: TemplateMediaTone;
};

/**
 * These are existing, local visual-direction assets. They are not represented
 * as generated customer results. Each template gets a semantically relevant
 * setting/product image, then a deterministic crop and factual goal overlay so
 * repeated source photography never masquerades as a unique finished render.
 */
export const mediaBaseUrl = (import.meta.env.VITE_API_ORIGIN?.trim() || "").replace(/\/$/, "");
export const TEMPLATE_POSTERS: Record<string, string> = {};
export const VERIFIED_TEMPLATE_VIDEOS: Partial<Record<string, string>> = {};
for (const id of ["luxury-product-reveal", "whatsapp-sales-ad", "food-beverage", "app-service", "salon-booking-offer"]) {
  const version = ["app-service", "salon-booking-offer"].includes(id) ? "v3" : "v1";
  TEMPLATE_POSTERS[id] = `${mediaBaseUrl}/api/v1/template-previews/${version}/${id}.jpg`;
  VERIFIED_TEMPLATE_VIDEOS[id] = `${mediaBaseUrl}/api/v1/template-previews/${version}/${id}.mp4`;
}
for (const id of [
  "premium-phone-reveal",
  "phone-floating-ad",
  "restaurant-food-hero",
  "food-delivery-ad",
  "fashion-product-showcase",
  "luxury-fashion-reveal",
  "cosmetic-product-commercial",
  "perfume-advertisement",
  "real-estate-property",
  "business-service-promotion",
  "new-york-billboard-takeover",
]) {
  TEMPLATE_POSTERS[id] = `${mediaBaseUrl}/api/v1/template-previews/v1/${id}.jpg`;
}
for (const id of CATEGORY_PREVIEW_TEMPLATE_IDS) {
  VERIFIED_TEMPLATE_VIDEOS[id] = `${mediaBaseUrl}/api/v1/template-previews/v1/${id}.mp4`;
}

const toneByGoal: Record<CampaignGoal, TemplateMediaTone> = {
  whatsapp_orders: "warm",
  bookings: "soft",
  launch: "vivid",
  offer: "warm",
  demonstration: "cool",
  education: "cool",
  announcement: "vivid",
  trust: "neutral",
  brand_story: "soft",
};

const goalLabels: Record<CampaignGoal, { en: string; ar: string }> = {
  whatsapp_orders: { en: "WhatsApp orders", ar: "طلبات واتساب" },
  bookings: { en: "Bookings", ar: "حجوزات" },
  launch: { en: "Launch", ar: "إطلاق" },
  offer: { en: "Offer", ar: "عرض" },
  demonstration: { en: "Demo", ar: "شرح" },
  education: { en: "Education", ar: "معلومة" },
  announcement: { en: "Announcement", ar: "إعلان" },
  trust: { en: "Trust", ar: "ثقة" },
  brand_story: { en: "Brand story", ar: "قصة العلامة" },
};

export function templateGoalLabel(goal: CampaignGoal, locale: "en" | "ar") {
  return goalLabels[goal][locale];
}

export function templateMediaFor(templateId: string, index: number, primaryGoal: CampaignGoal): TemplateMediaSpec {
  const x = 35 + (index % 10) * 3;
  const y = 35 + Math.floor(index / 10) * 7;
  return {
    poster: TEMPLATE_POSTERS[templateId] ?? "",
    previewVideo: VERIFIED_TEMPLATE_VIDEOS[templateId] ?? null,
    posterPosition: `${x}% ${y}%`,
    mediaCode: `T${String(index + 1).padStart(2, "0")}`,
    mediaTone: toneByGoal[primaryGoal],
  };
}
