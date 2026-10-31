import { LAUNCH_CREATIVE_TEMPLATE_CATALOG } from "./catalog.js";
import { CUSTOM_FORM_TEMPLATE_CATALOG } from "./product-model-ad.js";

/** The catalog's own categories are the only labels an owner can assign. */
export const TEMPLATE_CATEGORIES: readonly string[] = Object.freeze(
  [...new Set([...LAUNCH_CREATIVE_TEMPLATE_CATALOG, ...CUSTOM_FORM_TEMPLATE_CATALOG].map(template => template.category))].sort(),
);
