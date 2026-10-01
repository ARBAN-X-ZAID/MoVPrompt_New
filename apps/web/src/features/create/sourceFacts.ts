import {
  CampaignSourceSchema,
  type CampaignFactField,
  type ConfirmedFact,
  type CampaignSource,
} from "@movprompt/contracts";
import type { CreatorProject } from "./types";

/** Parse at every browser boundary so campaign facts cannot acquire display URLs or duplicate fields. */
export function normalizeCampaignSource(source: CampaignSource): CampaignSource {
  return CampaignSourceSchema.parse(source);
}

type ImportedFactInput = Pick<ConfirmedFact, "field" | "value">;

export type CampaignSourceSubject = CampaignSource["subject"];

export type CampaignFactReviewItem = {
  field: CampaignFactField;
  state: "present" | "required_missing" | "not_added";
  fact?: ConfirmedFact;
};

const PRODUCT_FACT_FIELDS: CampaignFactField[] = [
  "name",
  "description",
  "brand",
  "price",
  "offer",
  "logo",
  "brand_color",
  "media",
  "whatsapp",
];

const SERVICE_FACT_FIELDS: CampaignFactField[] = [
  "service_name",
  "brand",
  "description",
  "service_details",
  "location",
  "booking_url",
  "whatsapp",
  "price",
  "offer",
  "logo",
  "brand_color",
  "media",
];

function primaryNameField(subject: CampaignSourceSubject): CampaignFactField {
  return subject === "product" ? "name" : "service_name";
}

/**
 * The subject's name is the only fact a campaign cannot be built without.
 * Contact and offer details are optional and empty values are never invented.
 */
export function requiredFactsForOutcome(subject: CampaignSourceSubject): CampaignFactField[] {
  return [primaryNameField(subject)];
}

/**
 * Scanner facts become imported facts as an immutable replacement by field.
 * Caller-supplied values never inherit an old fact's provenance accidentally.
 */
export function applyImportedFacts(source: CampaignSource, imported: readonly ImportedFactInput[]): CampaignSource {
  const incoming = new Map(imported.map((fact) => [fact.field, {
    field: fact.field,
    value: fact.value,
    provenance: "imported" as const,
  }]));
  const retained = source.facts.filter((fact) => !incoming.has(fact.field));
  return normalizeCampaignSource({ ...source, facts: [...retained, ...incoming.values()] });
}

/** A user edit creates a manual fact; an empty optional edit intentionally removes that fact. */
export function editFact(source: CampaignSource, field: CampaignFactField, value: string): CampaignSource {
  const trimmed = value.trim();
  const retained = source.facts.filter((fact) => fact.field !== field);
  if (!trimmed) return normalizeCampaignSource({ ...source, facts: retained });
  return normalizeCampaignSource({
    ...source,
    facts: [...retained, { field, value: trimmed, provenance: "manual" }],
  });
}

/** Confirm only untouched imported values selected for this campaign; edits remain explicitly manual. */
export function confirmCampaignFacts(
  source: CampaignSource,
  fields: readonly CampaignFactField[] = source.facts.map((fact) => fact.field),
): CampaignSource {
  const selected = new Set(fields);
  return normalizeCampaignSource({
    ...source,
    facts: source.facts.map((fact) => (
      fact.provenance === "imported" && selected.has(fact.field)
        ? { ...fact, provenance: "user_confirmed" as const }
        : fact
    )),
  });
}

/** Review metadata makes absent optional facts visible without adding invented values to campaign truth. */
export function factsForReview(source: CampaignSource): CampaignFactReviewItem[] {
  const present = new Map(source.facts.map((fact) => [fact.field, fact]));
  const required = new Set(requiredFactsForOutcome(source.subject));
  const expected = source.subject === "product" ? PRODUCT_FACT_FIELDS : SERVICE_FACT_FIELDS;
  // Required and supplied facts must remain visible even when a product image
  // is used with a service/booking template.
  return [...new Set([...expected, ...required, ...present.keys()])].map((field) => {
    const fact = present.get(field);
    if (fact) return { field, state: "present", fact };
    return { field, state: required.has(field) ? "required_missing" : "not_added" };
  });
}

function sourceKindForLegacyProject(project: CreatorProject): CampaignSource["kind"] {
  if (project.product.sourceType === "product_link") return "product_url";
  if (project.product.sourceType === "business_link") return "business_url";
  if (project.product.sourceType === "upload") return "product_upload";
  if (project.product.sourceType === "sample") return "service_manual";
  return project.promotionKind === "business" ? "service_manual" : "product_upload";
}

function legacyFacts(project: CreatorProject): ConfirmedFact[] {
  const sourceIsService = project.promotionKind === "business";
  const values: Array<[CampaignFactField, string]> = [
    [sourceIsService ? "service_name" : "name", project.product.name],
    ["description", project.product.description],
    ["brand", project.product.brand],
    ["price", project.product.price],
    ["offer", project.offer],
    ["location", project.location],
    ["booking_url", project.bookingUrl],
    ["whatsapp", project.whatsapp],
    ["brand_color", project.brandColor],
  ];
  return values
    .filter(([, value]) => Boolean(value.trim()))
    .map(([field, value]) => ({ field, value: value.trim(), provenance: "manual" }));
}

/**
 * Compatibility edge for projects created before Phase 3. New source truth
 * always wins; legacy fields are used only to produce one deterministic anchor
 * while old saved projects are progressively rewritten.
 */
export function campaignSourceForProject(project: CreatorProject): CampaignSource {
  if (project.source) return normalizeCampaignSource(project.source);
  return normalizeCampaignSource({
    kind: sourceKindForLegacyProject(project),
    subject: project.promotionKind === "business" ? "service" : "product",
    assetKeys: project.product.images.flatMap((image) => image.storagePath || image.assetKey ? [image.storagePath ?? image.assetKey!] : []),
    facts: legacyFacts(project),
  });
}

export function projectWithCampaignSource(project: CreatorProject): CreatorProject {
  return { ...project, source: campaignSourceForProject(project) };
}

export function campaignFactValue(source: CampaignSource, field: CampaignFactField): string {
  return source.facts.find((fact) => fact.field === field)?.value ?? "";
}

/**
 * Attaching or reordering photos updates only the media list. Name, offer and
 * every other confirmed fact stay as the buyer left them.
 */
export function sourceWithAttachedImages(
  project: CreatorProject,
  images: CreatorProject["product"]["images"],
): CampaignSource {
  const base = campaignSourceForProject(project);
  const footage = images.some((image) => image.mimeType?.startsWith("video/"));
  const label = images.length
    ? `${images.length} ${footage ? "file" : "photo"}${images.length === 1 ? "" : "s"} added`
    : "";
  const withMedia = editFact(base, "media", label);
  return normalizeCampaignSource({
    ...withMedia,
    assetKeys: images.flatMap((image) => {
      const key = image.assetKey || image.storagePath;
      return key ? [key] : [];
    }),
  });
}
