import type { LedgerEntry } from "@/hooks/useCredits";
const REASON_LABEL: Record<string, string> = {
  signup_bonus: "Welcome bonus",
  backfill_bonus: "Welcome bonus",
  daily_grant: "Legacy daily credit",
  director_chat_text: "Director chat",
  director_chat_multimodal: "Director chat (with media)",
  image_generation: "Image generation",
  image_generation_refund: "Image refund",
  write_ad_scene: "Ad scene writer",
  write_ad_scene_refund: "Ad scene refund",
  video_render: "Video render",
  video_render_refund: "Video render refund",
  video_generation: "Video generation",
  admin_grant: "Credits added",
  credit_top_up: "Credits top-up",
};

const REASON_LABEL_AR: Record<string, string> = {
  signup_bonus: "رصيد ترحيبي",
  backfill_bonus: "رصيد ترحيبي",
  daily_grant: "رصيد يومي سابق",
  director_chat_text: "محادثة المخرج",
  director_chat_multimodal: "محادثة المخرج مع مواد",
  image_generation: "توليد صورة",
  image_generation_refund: "استرجاع توليد صورة",
  write_ad_scene: "كتابة مشهد إعلان",
  write_ad_scene_refund: "استرجاع كتابة مشهد",
  video_render: "توليد فيديو",
  video_render_refund: "استرجاع توليد فيديو",
  video_generation: "توليد فيديو",
  admin_grant: "رصيد مضاف",
  credit_top_up: "شحن رصيد",
};

export function entryLabel(entry: LedgerEntry, ar: boolean): string {
  // Refund reasons are internal failure codes; show the customer outcome instead.
  if (entry.kind === "cash_refund")
    return ar ? "استرداد قيمة الشراء" : "Cash purchase refund";
  if (entry.kind === "refund")
    return ar ? "استرجاع توليد فاشل" : "Failed generation refund";
  const labels = ar ? REASON_LABEL_AR : REASON_LABEL;
  return (
    labels[entry.reason] ||
    REASON_LABEL[entry.reason] ||
    entry.reason.replace(/_/g, " ")
  );
}
