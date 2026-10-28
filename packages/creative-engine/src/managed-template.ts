import {
  AD_STUDIO_BRAND_AD_ID,
  PRODUCT_MODEL_AD_ID,
  AD_STUDIO_BRAND_AD_REQUIRED,
  isManagedTemplateFieldVisible,
  type ManagedTemplateBinding,
  type ManagedTemplateForm,
} from "@movprompt/contracts";
import type { CreativeTemplateRecipe } from "./types.js";

const LABELS: Record<ManagedTemplateBinding, [string, string]> = {
  "product.photos": ["Reference photos", "الصور المرجعية"],
  "product.name": ["Product or business name", "اسم المنتج أو النشاط"],
  "product.description": ["Product facts", "معلومات المنتج"],
  "display.openingMessage": [
    "Opening message (optional)",
    "رسالة البداية (اختياري)",
  ],
  "display.offer": [
    "Offer or message to display (optional)",
    "عرض أو رسالة للعرض (اختياري)",
  ],
  "display.closingMessage": [
    "Closing message (optional)",
    "رسالة الختام (اختياري)",
  ],
  "video.duration": ["Video length", "مدة الفيديو"],
  "video.ratio": ["Video shape", "مقاس الفيديو"],
  "video.language": ["Message language", "لغة الرسالة"],
  "video.resolution": ["Resolution", "الدقة"],
  "video.audio": ["Sound", "الصوت"],
  "presenter.configuration": ["Character and speech", "الشخصية والكلام"],
  "model.configuration": ["Presenter and action", "الشخصية والحركة"],
  "brand.logo": ["Logo (optional)", "الشعار (اختياري)"],
  "adstudio.brandName": ["Brand name", "اسم العلامة"],
  "adstudio.sellingPoints": ["Selling points", "نقاط البيع"],
  "adstudio.aesthetics": ["Aesthetics", "الطابع البصري"],
  "adstudio.audience": ["Audience", "الجمهور"],
  "adstudio.description": ["Product description", "وصف المنتج"],
  "adstudio.socials": ["Socials (optional)", "حسابات التواصل (اختياري)"],
  "adstudio.videoIdea": [
    "What should happen in the video?",
    "ماذا يحدث في الفيديو؟",
  ],
};
export function defaultManagedTemplateForm(
  definition: CreativeTemplateRecipe,
): ManagedTemplateForm {
  const custom = definition.id === AD_STUDIO_BRAND_AD_ID;
  const model = definition.id === PRODUCT_MODEL_AD_ID;
  const bindings: ManagedTemplateBinding[] = [
    "product.photos",
    ...(custom
      ? ([
          "adstudio.brandName",
          "adstudio.sellingPoints",
          "adstudio.aesthetics",
          "adstudio.audience",
          "adstudio.description",
          "adstudio.socials",
          "adstudio.videoIdea",
        ] as const)
      : model
        ? []
        : (["product.name"] as const)),
    ...(custom || definition.id === "female-product-review"
      ? (["presenter.configuration"] as const)
      : model
        ? (["model.configuration"] as const)
        : []),
    ...(custom || model ? (["brand.logo"] as const) : []),
    "video.duration",
    "video.ratio",
    "video.language",
    "video.resolution",
    ...(custom ? (["video.audio"] as const) : []),
    "display.offer",
    "display.closingMessage",
  ];
  return {
    version: 1,
    fields: bindings.map((binding) => ({
      binding,
      label: { en: LABELS[binding][0], ar: LABELS[binding][1] },
      required:
        binding === "product.photos" ||
        binding.startsWith("video.") ||
        (custom &&
          AD_STUDIO_BRAND_AD_REQUIRED.some(
            (key) => binding === `adstudio.${key}`,
          )),
      visibleWhen: "always",
    })),
  };
}

export function supportsManagedTemplateBinding(
  familyId: string,
  binding: ManagedTemplateBinding,
): boolean {
  if (binding.startsWith("adstudio.") || binding === "video.audio")
    return familyId === AD_STUDIO_BRAND_AD_ID;
  if (binding === "model.configuration")
    return familyId === PRODUCT_MODEL_AD_ID;
  if (binding === "presenter.configuration")
    return [AD_STUDIO_BRAND_AD_ID, "female-product-review"].includes(familyId);
  if (binding === "brand.logo")
    return [AD_STUDIO_BRAND_AD_ID, PRODUCT_MODEL_AD_ID].includes(familyId);
  return true;
}

/** Publishing accepts only controls with a concrete runtime binding. Consent and
 * family requirements remain enforced by the existing generation contracts. */
export function managedTemplateDefinitionIssues(
  definition: CreativeTemplateRecipe,
): string[] {
  if (!definition.managedForm) return [];
  const fields = definition.managedForm.fields;
  const bindings = new Set(fields.map((field) => field.binding));
  const issues: string[] = [];
  for (const field of fields) {
    if (
      field.binding.startsWith("adstudio.") &&
      definition.id !== AD_STUDIO_BRAND_AD_ID
    )
      issues.push(`unsupported_binding:${field.binding}`);
    if (
      field.binding === "video.audio" &&
      definition.id !== AD_STUDIO_BRAND_AD_ID
    )
      issues.push("unsupported_audio_control");
    if (
      field.binding === "model.configuration" &&
      definition.id !== PRODUCT_MODEL_AD_ID
    )
      issues.push("unsupported_model_configuration");
    if (
      field.binding === "presenter.configuration" &&
      ![AD_STUDIO_BRAND_AD_ID, "female-product-review"].includes(definition.id)
    )
      issues.push("speech_family_unsupported");
    if (
      field.binding === "brand.logo" &&
      ![AD_STUDIO_BRAND_AD_ID, PRODUCT_MODEL_AD_ID].includes(definition.id)
    )
      issues.push("unsupported_logo_binding");
  }
  const required: ManagedTemplateBinding[] = [
    "product.photos",
    "video.duration",
    "video.ratio",
    "video.language",
  ];
  if (definition.id === AD_STUDIO_BRAND_AD_ID)
    required.push(
      "presenter.configuration",
      ...AD_STUDIO_BRAND_AD_REQUIRED.map(
        (key) => `adstudio.${key}` as ManagedTemplateBinding,
      ),
    );
  if (definition.id === "female-product-review")
    required.push("presenter.configuration");
  if (definition.id === PRODUCT_MODEL_AD_ID)
    required.push("model.configuration");
  for (const binding of required) {
    const field = fields.find((field) => field.binding === binding);
    if (!bindings.has(binding) || field?.visibleWhen !== "always")
      issues.push(`required_binding_missing:${binding}`);
    if (
      field &&
      (binding === "product.photos" ||
        binding.startsWith("adstudio.") ||
        binding === "product.name") &&
      !field.required
    )
      issues.push(`required_binding_weakened:${binding}`);
  }
  return issues;
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export function managedTemplateInputIssues(
  definition: CreativeTemplateRecipe,
  rootValue: unknown,
): string[] {
  const issues = managedTemplateDefinitionIssues(definition);
  const root = record(rootValue);
  const generation = record(root.generation ?? root);
  const brief = record(generation.creativeBrief);
  const product = record(brief.product);
  const display = record(brief.displayCopy);
  const ad = record(brief.adStudioBrandAd);
  const native = record(brief.nativeUgc);
  if (definition.supportedResolutions && !definition.supportedResolutions.includes(generation.resolution as "480p" | "720p")) issues.push("resolution_not_supported");
  for (const field of definition.managedForm?.fields ?? []) {
    if (
      !field.required ||
      !isManagedTemplateFieldVisible(field, native.enabled === true)
    )
      continue;
    let value: unknown;
    if (field.binding === "product.name") value = product.name;
    else if (field.binding === "product.description")
      value = product.description;
    else if (field.binding.startsWith("adstudio."))
      value = ad[field.binding.slice(9)];
    else if (field.binding.startsWith("display."))
      value = display[field.binding.slice(8)];
    else continue; // Photo counts and typed video/presenter contracts are authoritative.
    if (typeof value !== "string" || !value.trim())
      issues.push(`required_field:${field.binding}`);
  }
  return issues;
}
