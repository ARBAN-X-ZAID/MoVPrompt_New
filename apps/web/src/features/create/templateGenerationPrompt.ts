import { getCreatorTemplate } from "./templates";
import { MARKET_META, type CreatorProject } from "./types";

/** Builds a deterministic template prompt whose subject identity comes only from the client reference. */
export function buildTemplatePrompt(project: CreatorProject): string {
  const template = getCreatorTemplate(project.templateId);
  const refs = project.product.images.map((_, index) => `@Image${index + 1}`).join(", ");
  const language = project.language === "ar"
    ? "native Kuwaiti Arabic (ar-KW)"
    : project.language === "bilingual"
      ? "native Kuwaiti Arabic (ar-KW) and English"
      : "English";
  const confirmedFacts = [
    project.product.name ? `${project.promotionKind === "business" ? "Business or service" : "Product"} name: ${project.product.name}.` : "",
    project.product.description ? `Confirmed description or tagline: ${project.product.description}.` : "",
    project.product.brand ? `Confirmed brand or agency: ${project.product.brand}.` : "",
    project.product.price ? `Confirmed price: ${project.product.price} KWD.` : "",
    project.offer ? `Confirmed offer: ${project.offer}.` : "",
    project.location ? `Confirmed Kuwait location: ${project.location}.` : "",
    project.bookingUrl ? `Confirmed booking destination: ${project.bookingUrl}.` : "",
    project.whatsapp ? `Confirmed WhatsApp number: ${project.whatsapp}.` : "",
  ].filter(Boolean);
  return [
    `Create a ${template.duration}-second ${project.aspectRatio} ${project.promotionKind === "business" ? "service" : "product"} campaign using ${template.name}.`,
    "Follow this template's scene order, pacing and visual direction consistently. The template controls the presentation; the uploaded client image controls the subject identity.",
    "Use @Image1 as the authoritative client reference in every scene. Do not replace, redesign, relabel or reinterpret the referenced product, person, business or service.",
    `The supplied references are ${refs}. ${project.promotionKind === "business" ? "Keep the business environment, people and branding faithful to the references. Do not invent service results, qualifications or claims." : "Preserve the exact product shape, package, label, colours and logo across every shot."}`,
    ...confirmedFacts,
    `Market: ${MARKET_META[project.market].label}. Spoken and campaign language: ${language}. ${project.language !== "en" ? "Use natural Kuwait dialect—not Egyptian, Levantine, Emirati, Saudi, or generic Modern Standard Arabic—and compose deterministic RTL overlays with correct punctuation." : ""}`,
    `CTA: ${project.cta}. Brand colour: ${project.brandColor}.`,
    "Scene recipe:",
    ...project.scenes.map((scene, index) => `${index + 1}. ${scene.duration}s — ${scene.title}. ${scene.direction} Leave clean negative space for the deterministic overlay: “${scene.headline}”. Do not render that text in the generated footage.`),
    "The finishing service adds the confirmed price, offer, location, contact destination and CTA after generation. Omit every empty optional value. Keep overlay areas inside social safe zones. Premium, photoreal advertising. No altered spelling, extra products, invented claims, watermarks or AI-rendered typography.",
  ].join("\n");
}
