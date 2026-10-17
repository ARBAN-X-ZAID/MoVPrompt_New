import { z } from "zod";

export const PRODUCT_MODEL_AD_ID = "product-with-model-ad";
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const short = z.string().trim().max(240);
const httpUrl = z.union([z.literal(""), z.url().max(2_048).refine(value => /^https?:\/\//i.test(value))]);
const entityId = z.string().regex(/^[0-9a-f]{24}$/i).or(z.uuid());

/** A project keeps a copy of this kit; editing a library entry cannot change it. */
export const BrandKitSnapshotSchema = z.object({
  version: z.literal(1),
  name: short,
  primaryColor: color,
  secondaryColor: color,
  tagline: z.string().trim().max(120),
  description: z.string().trim().max(500),
  audience: short,
  sellingPoints: z.array(z.string().trim().min(1).max(120)).max(3),
  style: z.enum(["clean", "luxury", "energetic"]),
  fontStyle: z.enum(["sans", "serif"]),
  website: httpUrl,
  whatsapp: z.union([z.literal(""), z.string().regex(/^\+965[569]\d{7}$/)]),
  // A checksum survives guest asset claiming and canonical ID replacement.
  logoChecksum: z.string().regex(/^[0-9a-f]{64}$/).optional(),
}).strict();
export type BrandKitSnapshot = z.infer<typeof BrandKitSnapshotSchema>;

export const ProductModelAdSettingsSchema = z.object({
  formVersion: z.literal(1),
  category: z.enum(["accessory", "clothing", "beauty", "general"]),
  modelChoice: z.enum(["illustrated_adult", "realistic_adult", "reference_adult"]),
  setting: z.enum(["studio", "lifestyle", "car_arrival"]),
  action: z.enum(["present", "hold", "wear"]),
  openingMessage: z.string().max(120),
  sellingPoint: short,
  brandKit: BrandKitSnapshotSchema,
  libraryKitId: entityId.optional(),
  libraryRevision: z.number().int().positive().optional(),
}).strict().superRefine((value, context) => {
  if (value.action === "wear" && !["accessory", "clothing"].includes(value.category)) {
    context.addIssue({ code: "custom", path: ["action"], message: "Choose hold or present for this product category." });
  }
});
export type ProductModelAdSettings = z.infer<typeof ProductModelAdSettingsSchema>;

export function defaultProductModelAdSettings(): ProductModelAdSettings {
  return { formVersion: 1, category: "general", modelChoice: "realistic_adult", setting: "car_arrival", action: "hold", openingMessage: "", sellingPoint: "", brandKit: {
    version: 1, name: "", primaryColor: "#c99946", secondaryColor: "#f5f1e9", tagline: "", description: "", audience: "", sellingPoints: [], style: "clean", fontStyle: "sans", website: "", whatsapp: "",
  } };
}

export const BrandKitLogoSourceSchema = z.object({ projectId: entityId, assetId: entityId, checksum: z.string().regex(/^[0-9a-f]{64}$/) }).strict();
export const SaveBrandKitRequestSchema = z.object({
  id: entityId.optional(),
  expectedRevision: z.number().int().positive().optional(),
  snapshot: BrandKitSnapshotSchema.refine(kit => kit.name.length > 0, "Enter a brand name."),
  logoSource: BrandKitLogoSourceSchema.optional(),
}).strict().superRefine((value, context) => {
  if (Boolean(value.id) !== Boolean(value.expectedRevision)) context.addIssue({ code: "custom", message: "An update needs its current revision." });
  if (value.snapshot.logoChecksum !== value.logoSource?.checksum) context.addIssue({ code: "custom", message: "The logo must match the verified photo." });
});
export type SaveBrandKitRequest = z.infer<typeof SaveBrandKitRequestSchema>;
export const BrandKitRecordSchema = z.object({
  id: entityId, revision: z.number().int().positive(), snapshot: BrandKitSnapshotSchema,
  logoSource: BrandKitLogoSourceSchema.optional(), updatedAt: z.iso.datetime(),
}).strict();
export type BrandKitRecord = z.infer<typeof BrandKitRecordSchema>;

/** Declarative metadata applies only to new custom-form templates. */
export const TemplateCustomFormSchema = z.object({
  id: z.literal("product-model-ad-form-v1"), version: z.literal(1),
  sections: z.array(z.string().min(1)).max(8),
  fields: z.array(z.object({ key: z.string().min(1), section: z.string().min(1), kind: z.enum(["text", "select", "colors", "photo", "library"]), required: z.boolean(), maxLength: z.number().int().positive().optional(), requiredWhen: z.string().optional() }).strict()).max(32),
  uploads: z.array(z.object({ role: z.enum(["subject", "character"]), min: z.number().int().nonnegative(), max: z.number().int().positive(), requiredWhen: z.string().optional() }).strict()).max(2),
  logo: z.object({ min: z.literal(0), max: z.literal(1), providerReference: z.literal(false) }).strict(),
  durations: z.array(z.union([z.literal(8), z.literal(15), z.literal(20)])), ratios: z.tuple([z.literal("9:16")]), audio: z.boolean(),
}).strict();
export const PRODUCT_MODEL_AD_FORM = TemplateCustomFormSchema.parse({
  id: "product-model-ad-form-v1", version: 1,
  sections: ["product", "brand", "direction", "review"],
  fields: [
    { key: "product.name", section: "product", kind: "text", required: true, maxLength: 240 },
    { key: "product.description", section: "product", kind: "text", required: false, maxLength: 500 },
    { key: "modelChoice", section: "product", kind: "select", required: true },
    { key: "characterPhotos", section: "product", kind: "photo", required: false, requiredWhen: "reference_adult" },
    { key: "brandKit.name", section: "brand", kind: "text", required: false, maxLength: 240 },
    { key: "brandKit.logoChecksum", section: "brand", kind: "photo", required: false },
    { key: "brandKit.primaryColor", section: "brand", kind: "colors", required: true },
    { key: "brandKit.secondaryColor", section: "brand", kind: "colors", required: true },
    { key: "setting", section: "direction", kind: "select", required: true },
    { key: "action", section: "direction", kind: "select", required: true },
    { key: "openingMessage", section: "direction", kind: "text", required: false, maxLength: 120 },
    { key: "sellingPoint", section: "direction", kind: "text", required: false, maxLength: 240 },
    { key: "offer", section: "direction", kind: "text", required: false, maxLength: 500 },
    { key: "cta", section: "direction", kind: "text", required: false, maxLength: 240 },
  ],
  uploads: [{ role: "subject", min: 1, max: 3 }, { role: "character", min: 0, max: 3, requiredWhen: "reference_adult" }],
  logo: { min: 0, max: 1, providerReference: false },
  durations: [8, 15, 20], ratios: ["9:16"], audio: true,
});
