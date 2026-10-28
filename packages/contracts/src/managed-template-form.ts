import { z } from "zod";

export const ManagedTemplateBindingSchema = z.enum([
  "product.photos",
  "product.name",
  "product.description",
  "display.openingMessage",
  "display.offer",
  "display.closingMessage",
  "video.duration",
  "video.ratio",
  "video.language",
  "video.resolution",
  "video.audio",
  "presenter.configuration",
  "model.configuration",
  "brand.logo",
  "adstudio.brandName",
  "adstudio.sellingPoints",
  "adstudio.aesthetics",
  "adstudio.audience",
  "adstudio.description",
  "adstudio.socials",
  "adstudio.videoIdea",
]);
export type ManagedTemplateBinding = z.infer<
  typeof ManagedTemplateBindingSchema
>;
const copy = z
  .object({
    en: z.string().trim().min(1).max(240),
    ar: z.string().trim().min(1).max(240),
  })
  .strict();
export const ManagedTemplateFieldSchema = z
  .object({
    binding: ManagedTemplateBindingSchema,
    label: copy,
    help: copy.optional(),
    required: z.boolean(),
    visibleWhen: z.enum(["always", "speaking", "silent"]).default("always"),
  })
  .strict()
  .superRefine((field, context) => {
    if (field.binding.startsWith("display.") && field.required)
      context.addIssue({
        code: "custom",
        message: "Display messages always remain optional.",
      });
    if (
      [
        "product.photos",
        "presenter.configuration",
        "model.configuration",
        "video.duration",
        "video.language",
        "video.ratio",
      ].includes(field.binding) &&
      field.visibleWhen !== "always"
    )
      context.addIssue({
        code: "custom",
        message:
          "Required setup and permission controls cannot be hidden conditionally.",
      });
  });
export type ManagedTemplateField = z.infer<typeof ManagedTemplateFieldSchema>;
export const ManagedTemplateFormSchema = z
  .object({
    version: z.literal(1),
    fields: z.array(ManagedTemplateFieldSchema).min(3).max(24),
  })
  .strict()
  .superRefine((form, context) => {
    const bindings = form.fields.map((field) => field.binding);
    if (new Set(bindings).size !== bindings.length)
      context.addIssue({
        code: "custom",
        message: "Each binding may appear only once.",
      });
    for (const binding of [
      "product.photos",
      "video.duration",
      "video.ratio",
      "video.language",
    ])
      if (!bindings.includes(binding as ManagedTemplateBinding))
        context.addIssue({
          code: "custom",
          message: `Missing required binding: ${binding}`,
        });
  });
export type ManagedTemplateForm = z.infer<typeof ManagedTemplateFormSchema>;

export function isManagedTemplateFieldVisible(
  field: ManagedTemplateField,
  speaking: boolean,
): boolean {
  return (
    field.visibleWhen === "always" ||
    (field.visibleWhen === "speaking" ? speaking : !speaking)
  );
}
