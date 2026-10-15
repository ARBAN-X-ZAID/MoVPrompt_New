export type TemplateSection = "templates" | "ad-studio";

/** Placement is a product decision, never inferred from a prompt or custom form.
 * Add new discoverable items here only after the user names their section.
 */
export const TEMPLATE_PLACEMENT: Readonly<Record<string, TemplateSection>> = Object.freeze({
  "premium-phone-reveal": "templates",
  "phone-floating-ad": "templates",
  "restaurant-food-hero": "templates",
  "food-delivery-ad": "templates",
  "fashion-product-showcase": "templates",
  "luxury-fashion-reveal": "templates",
  "jewelry-product-showcase": "templates",
  "luxury-gift-reveal": "templates",
  "cosmetic-product-commercial": "templates",
  "perfume-advertisement": "templates",
  "real-estate-property": "templates",
  "business-service-promotion": "templates",
  "new-york-billboard-takeover": "templates",
  "female-product-review": "ad-studio",
  "product-with-model-ad": "ad-studio",
});

export function templateSection(id: string): TemplateSection | undefined {
  return Object.hasOwn(TEMPLATE_PLACEMENT, id) ? TEMPLATE_PLACEMENT[id] : undefined;
}

export function templateLibraryPath(id: string): string {
  return `/${templateSection(id) ?? "templates"}`;
}

export function templateDetailPath(id: string): string {
  return `${templateLibraryPath(id)}/${encodeURIComponent(id)}`;
}
