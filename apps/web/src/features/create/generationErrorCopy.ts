export type GenerationErrorAction = "retry" | "choose_template" | "sign_in" | "none";

export type GenerationErrorCopy = {
  title: string;
  message: string;
  action: GenerationErrorAction;
};

function copy(arabic: boolean, english: string, arabicText: string) {
  return arabic ? arabicText : english;
}

/** Plain-language copy for a generation quote or start failure. Unknown codes keep the server sentence. */
export function generationErrorCopy(
  code: string | undefined,
  serverMessage: string | undefined,
  arabic: boolean,
): GenerationErrorCopy {
  const server = serverMessage?.trim() ?? "";
  switch (code) {
    case "provider_balance_required":
      return {
        title: copy(arabic, "Video service balance needed", "خدمة الفيديو تحتاج رصيداً"),
        message: copy(arabic, "The video service needs more provider balance before it can create videos. Your project and photos are saved. Please try again after the service balance is restored.", "تحتاج خدمة الفيديو إلى رصيد إضافي لدى مزود الخدمة قبل إنشاء الفيديو. مشروعك وصورك محفوظة. حاول مرة أخرى بعد استعادة رصيد الخدمة."),
        action: "none",
      };
    case "provider_person_reference_rejected":
      return {
        title: copy(arabic, "Character photo declined", "تم رفض صورة الشخصية"),
        message: copy(arabic, "The video service couldn't use this character photo, which can happen with photos of real-looking people. Your credits were returned and your campaign is saved. Try an illustrated photo or a generated character.", "تعذر على خدمة الفيديو استخدام صورة الشخصية هذه، وقد يحدث ذلك مع صور الأشخاص الواقعيين. تمت إعادة رصيدك وحملتك محفوظة. جرّب صورة مرسومة أو شخصية مولّدة."),
        action: "none",
      };
    case "template_catalog_outdated":
      return {
        title: copy(arabic, "Template update pending", "تحديث القالب قيد الانتظار"),
        message: copy(arabic, "The app and template catalog are out of sync. Refresh after the template update is available. Your photos and details remain saved.", "إصدار التطبيق وكتالوج القوالب غير متطابقين. حدّث الصفحة بعد توفر تحديث القالب. صورك وتفاصيلك محفوظة."),
        action: "retry",
      };
    case "wallet_reconciliation_required":
      return {title:copy(arabic,"Wallet review needed","المحفظة تحتاج مراجعة"),message:arabic?"تحتاج محفظتك إلى مراجعة توزيع الرصيد قبل توليد فيديو جديد. تواصل مع الدعم.":"Your wallet needs a credit review before another video can start. Contact support.",action:"none"};
    case "insufficient_credits":
      return {
        title: copy(arabic, "Not enough credits", "الرصيد غير كافٍ"),
        message: copy(arabic, "Not enough credits for this video.", "رصيدك لا يكفي لهذا الفيديو."),
        action: "none",
      };
    case "paid_generation_not_enabled":
      return {
        title: copy(arabic, "Video creation isn't open yet", "إنشاء الفيديو غير متاح بعد"),
        message: copy(arabic, "Paid video creation hasn't been switched on yet. Your project is saved.", "لم يتم تفعيل إنشاء الفيديو المدفوع بعد. مشروعك محفوظ."),
        action: "retry",
      };
    case "starter_entitlement_unavailable":
      return {
        title: copy(arabic, "Free video used", "استُخدم الفيديو المجاني"),
        message: copy(arabic, "You've used your free video.", "لقد استخدمت فيديوك المجاني."),
        action: "none",
      };
    case "template_configuration_ineligible":
      return {
        title: copy(arabic, "Template needs an update", "القالب يحتاج تحديثاً"),
        message: server || copy(arabic, "Select the template again before generating.", "اختر القالب مرة ثانية قبل الإنشاء."),
        action: "choose_template",
      };
    case "authentication_required":
      return {
        title: copy(arabic, "Sign in required", "تسجيل الدخول مطلوب"),
        message: copy(arabic, "Please sign in again.", "يرجى تسجيل الدخول مرة ثانية."),
        action: "sign_in",
      };
    case "capability_unavailable":
    case "generation_service_unavailable":
    case "worker_unavailable":
    case "storage_unavailable":
    case "quality_unavailable":
    case "pricing_unavailable":
      return {
        title: copy(arabic, "Video creation is paused", "إنشاء الفيديو متوقف"),
        message: copy(arabic, "Video creation is paused for a few minutes.", "إنشاء الفيديو متوقف لبضع دقائق."),
        action: "retry",
      };
    case "user_render_limit_reached":
    case "project_render_active":
      return {
        title: copy(arabic, "A video is already being created", "يتم إنشاء فيديو الآن"),
        message: copy(arabic, "A video is already being created.", "يتم إنشاء فيديو الآن."),
        action: "none",
      };
    case "quote_expired":
    case "quote_price_changed":
      return {
        title: copy(arabic, "Refreshing the price", "جارٍ تحديث السعر"),
        message: copy(arabic, "Refreshing the price.", "جارٍ تحديث السعر."),
        action: "retry",
      };
    default:
      if (!code) {
        return {
          title: copy(arabic, "Connection problem", "مشكلة في الاتصال"),
          message: copy(arabic, "We couldn't reach the server. Check your connection.", "تعذر الوصول إلى الخادم. تحقق من اتصالك."),
          action: "retry",
        };
      }
      return {
        title: copy(arabic, "Generation unavailable", "التوليد غير متوفر"),
        message: server || copy(arabic, "Video generation is temporarily unavailable.", "توليد الفيديو غير متوفر مؤقتاً."),
        action: "retry",
      };
  }
}
