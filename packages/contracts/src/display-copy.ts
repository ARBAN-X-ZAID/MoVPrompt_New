import { z } from "zod";

/** Only these explicitly supplied messages may become generated-video text. */
export const DisplayCopySchema = z.object({
  version: z.literal(1),
  openingMessage: z.string().max(120),
  offer: z.string().max(500),
  closingMessage: z.string().max(240),
}).strict();
export type DisplayCopy = z.infer<typeof DisplayCopySchema>;
export const emptyDisplayCopy = (): DisplayCopy => ({ version: 1, openingMessage: "", offer: "", closingMessage: "" });

const STOCK_ACTIONS = new Set(["shop now", "order on whatsapp", "book now", "learn more", "visit store", "تسوّق الآن", "تسوق الآن", "احجز الآن", "اطلب على الواتساب", "اطلب عبر واتساب", "اعرف المزيد", "زر المتجر", "زيارة المتجر"]);
/** Legacy drafts have no CTA provenance. Known auto-filled values require re-entry. */
export function legacyDisplayCopy(input: { offer?: string; cta?: string; openingMessage?: string }): DisplayCopy {
  const closing = input.cta?.trim() ?? "";
  return DisplayCopySchema.parse({ version: 1, offer: input.offer ?? "", openingMessage: input.openingMessage ?? "", closingMessage: STOCK_ACTIONS.has(closing.toLowerCase()) ? "" : closing });
}
