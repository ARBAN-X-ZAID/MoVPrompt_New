import type { CampaignSource } from "@movprompt/contracts";

import type { TemplateQuote } from "../templateQuoteState";
import { createDraftProject } from "../templates";
import type { CreatorProject } from "../types";
import { projectWithCampaignSource } from "../sourceFacts";

export type GoldenPathFixture = {
  entry: "source_first" | "template_first";
  templateId: string;
  pendingGenerationId: string;
  source: CampaignSource;
  quote: TemplateQuote;
  project: Pick<CreatorProject, "promotionKind" | "vertical" | "goal" | "presenterMode" | "language" | "market" | "offer" | "cta" | "brandColor" | "aspectRatio" | "resolution" | "subtitles" | "audio" | "location" | "bookingUrl" | "whatsapp"> & {
    product: CreatorProject["product"];
  };
};

const FUTURE_QUOTE_EXPIRY = "2030-01-01T00:15:00.000Z";
const QUOTE_HASH = "d".repeat(64);

const productSource: CampaignSource = {
  kind: "product_url",
  subject: "product",
  assetKeys: ["guest-assets/golden-product/sadu-oud.webp"],
  facts: [
    { field: "name", value: "Sadu Reserve Oud", provenance: "user_confirmed" },
    { field: "description", value: "A concentrated oud fragrance for evening gifting.", provenance: "user_confirmed" },
    { field: "brand", value: "Sadu Reserve", provenance: "imported" },
    { field: "price", value: "19.900", provenance: "user_confirmed" },
    { field: "offer", value: "Complimentary Kuwait delivery", provenance: "manual" },
    { field: "whatsapp", value: "+96550001234", provenance: "manual" },
    { field: "media", value: "1 confirmed product photo", provenance: "user_confirmed" },
    { field: "brand_color", value: "#9d6b2f", provenance: "manual" },
  ],
};

const serviceSource: CampaignSource = {
  kind: "service_manual",
  subject: "service",
  assetKeys: ["guest-assets/golden-service/noura-salon.webp"],
  facts: [
    { field: "service_name", value: "Noura Salon", provenance: "manual" },
    { field: "description", value: "Private hair and beauty appointments in Salmiya.", provenance: "manual" },
    { field: "service_details", value: "Cut, colour and styling appointments.", provenance: "manual" },
    { field: "location", value: "Salmiya, Kuwait", provenance: "manual" },
    { field: "booking_url", value: "https://noura.example.test/book", provenance: "manual" },
    { field: "whatsapp", value: "+96551112222", provenance: "manual" },
    { field: "price", value: "15.000", provenance: "manual" },
    { field: "media", value: "1 consented salon photo", provenance: "manual" },
    { field: "brand_color", value: "#7b4f57", provenance: "manual" },
  ],
};

export const GOLDEN_PRODUCT_PATH: GoldenPathFixture = {
  entry: "source_first",
  templateId: "luxury-product-reveal",
  pendingGenerationId: "00000000-0000-4000-8000-000000000301",
  source: productSource,
  quote: {
    quoteId: "00000000-0000-4000-8000-000000000401",
    capability: "video.product_fidelity",
    credits: 80,
    entitlementEligible: false,
    configurationHash: QUOTE_HASH,
    pricingVersion: "golden-test-v1",
    expiresAt: FUTURE_QUOTE_EXPIRY,
    breakdown: [{ label: "8 second product campaign", credits: 80 }],
    estimateOnly: false,
  },
  project: {
    promotionKind: "product",
    vertical: "ecommerce",
    goal: "whatsapp_orders",
    presenterMode: "none",
    language: "bilingual",
    market: "KW",
    offer: "Complimentary Kuwait delivery",
    cta: "Order on WhatsApp",
    brandColor: "#9d6b2f",
    aspectRatio: "4:5",
    resolution: "480p",
    subtitles: true,
    audio: false,
    location: "",
    bookingUrl: "",
    whatsapp: "+96550001234",
    product: {
      sourceType: "product_link",
      sourceUrl: "https://sadu.example.test/products/reserve-oud",
      name: "Sadu Reserve Oud",
      description: "A concentrated oud fragrance for evening gifting.",
      price: "19.900",
      brand: "Sadu Reserve",
      images: [{ id: "golden-sadu-image", name: "Sadu Reserve Oud", url: "blob:golden-sadu", assetKey: productSource.assetKeys[0]!, mimeType: "image/webp", source: "url" }],
    },
  },
};

export const GOLDEN_SERVICE_PATH: GoldenPathFixture = {
  entry: "source_first",
  templateId: "salon-booking-offer",
  pendingGenerationId: "00000000-0000-4000-8000-000000000302",
  source: serviceSource,
  quote: {
    quoteId: "00000000-0000-4000-8000-000000000402",
    capability: "video.cinematic",
    credits: 100,
    entitlementEligible: false,
    configurationHash: "e".repeat(64),
    pricingVersion: "golden-test-v1",
    expiresAt: FUTURE_QUOTE_EXPIRY,
    breakdown: [{ label: "12 second salon campaign", credits: 100 }],
    estimateOnly: false,
  },
  project: {
    promotionKind: "business",
    vertical: "salon",
    goal: "bookings",
    presenterMode: "none",
    language: "ar",
    market: "KW",
    offer: "",
    cta: "Book now",
    brandColor: "#7b4f57",
    aspectRatio: "9:16",
    resolution: "720p",
    subtitles: true,
    audio: true,
    location: "Salmiya, Kuwait",
    bookingUrl: "https://noura.example.test/book",
    whatsapp: "+96551112222",
    product: {
      sourceType: "upload",
      sourceUrl: "",
      name: "Noura Salon",
      description: "Private hair and beauty appointments in Salmiya.",
      price: "15.000",
      brand: "Noura Salon",
      images: [{ id: "golden-noura-image", name: "Noura Salon", url: "blob:golden-noura", assetKey: serviceSource.assetKeys[0]!, mimeType: "image/webp", source: "upload" }],
    },
  },
};

/** Fixed fixture IDs make the pending handoff comparable without leaking a live draft or asset key. */
export function createGoldenPathProject(fixture: GoldenPathFixture): CreatorProject {
  const project = createDraftProject(fixture.templateId);
  return projectWithCampaignSource({
    ...project,
    id: fixture.pendingGenerationId,
    versionId: fixture.pendingGenerationId,
    title: `${fixture.project.product.name} — golden path`,
    pendingGenerationId: fixture.pendingGenerationId,
    ...fixture.project,
    product: {
      ...fixture.project.product,
      images: fixture.project.product.images.map((image) => ({ ...image })),
    },
    source: fixture.source,
  });
}

/** Only fields that cross the review → auth → claim → quote boundary are compared. */
export function canonicalGoldenPathIntent(project: CreatorProject, rightsConfirmed: boolean) {
  return {
    templateId: project.templateId,
    source: project.source,
    goal: project.goal,
    presenter: project.presenter ?? { mode: project.presenterMode },
    campaign: {
      market: project.market,
      language: project.language,
      price: project.product.price,
      offer: project.offer,
      cta: project.cta,
      location: project.location,
      bookingUrl: project.bookingUrl,
      whatsapp: project.whatsapp,
      brandColor: project.brandColor,
    },
    delivery: {
      aspectRatio: project.aspectRatio,
      resolution: project.resolution,
      subtitles: project.subtitles,
      audio: project.audio,
    },
    rightsConfirmed,
    pendingGenerationId: project.pendingGenerationId,
  };
}
