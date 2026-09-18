import { CheckCircle2, CircleAlert, Clock3, PencilLine, RefreshCw, Sparkles } from "lucide-react";
import { useId, type RefObject } from "react";

import type { CampaignFactField } from "@movprompt/contracts";
import { cn } from "@/lib/utils";

import type { TemplateQuote } from "./templateQuoteState";
import { campaignFactValue, campaignSourceForProject, factsForReview } from "./sourceFacts";
import { hasCreatorImageReference, templateRequiresSourceMedia } from "./templates";
import { getCampaignGoalOption, MARKET_META, type CreatorProject } from "./types";

export type CampaignReviewEditTarget = "source" | "facts" | "template" | "details";
type CampaignReviewQuoteState = "ready" | "loading" | "unavailable" | "expired" | "changed";

type CampaignReviewStepProps = {
  project: CreatorProject;
  rightsConfirmed: boolean;
  quote: TemplateQuote | null;
  quoteState: CampaignReviewQuoteState;
  arabic?: boolean;
  hidePricing?: boolean;
  sourceError?: string;
  sourceBusy?: boolean;
  requestId?: string;
  generateButtonRef?: RefObject<HTMLButtonElement | null>;
  onEdit: (target: CampaignReviewEditTarget) => void;
  onRightsChange?: (confirmed: boolean) => void;
  onRetryQuote?: () => void;
  onGenerate: () => void;
};

const FACT_LABELS: Record<CampaignFactField, { en: string; ar: string }> = {
  name: { en: "Name", ar: "الاسم" },
  description: { en: "Description", ar: "الوصف" },
  brand: { en: "Brand", ar: "العلامة التجارية" },
  price: { en: "Price", ar: "السعر" },
  offer: { en: "Offer", ar: "العرض" },
  location: { en: "Location", ar: "الموقع" },
  booking_url: { en: "Booking link", ar: "رابط الحجز" },
  whatsapp: { en: "WhatsApp", ar: "واتساب" },
  logo: { en: "Logo", ar: "الشعار" },
  brand_color: { en: "Brand colour", ar: "لون العلامة" },
  service_name: { en: "Business or service", ar: "النشاط أو الخدمة" },
  service_details: { en: "Service details", ar: "تفاصيل الخدمة" },
  media: { en: "Photos or footage", ar: "الصور أو الفيديو" },
};

function copy(arabic: boolean, english: string, arabicText: string) {
  return arabic ? arabicText : english;
}

function valueDirection(value: string) {
  return /^(https?:\/\/|\+?[0-9][0-9\s()-]+$|[0-9]+(?:\.[0-9]+)?\s*KWD$)/i.test(value.trim()) ? "ltr" : undefined;
}

function provenanceCopy(arabic: boolean, provenance: "imported" | "user_confirmed" | "manual") {
  if (provenance === "imported") return copy(arabic, "Imported", "مستورد");
  if (provenance === "user_confirmed") return copy(arabic, "Confirmed by you", "أكدته بنفسك");
  return copy(arabic, "Added by you", "أضفته بنفسك");
}

/** Mirror the per-template label overrides used in FactReviewStep so the review-step copy
 *  matches what the user already saw in the facts form. */
function primaryNameLabel(arabic: boolean, templateId: string, subject: "product" | "service"): { en: string; ar: string } {
  if (subject === "service") {
    if (templateId === "real-estate-property") return { en: "Property or listing name", ar: "اسم العقار أو الإعلان" };
    if (templateId === "business-service-promotion") return { en: "Service name", ar: "اسم الخدمة" };
    return { en: "Business or service name", ar: "اسم النشاط أو الخدمة" };
  }
  if (/phone/u.test(templateId)) return { en: "Phone model or product name", ar: "اسم الهاتف أو المنتج" };
  if (/food/u.test(templateId)) return { en: "Dish name", ar: "اسم الطبق" };
  if (/fashion/u.test(templateId)) return { en: "Clothing or product name", ar: "اسم قطعة الأزياء أو المنتج" };
  if (/cosmetic|perfume/u.test(templateId)) return { en: "Cosmetic or fragrance name", ar: "اسم المستحضر أو العطر" };
  if (templateId === "new-york-billboard-takeover") return { en: "Brand name on the billboard", ar: "اسم العلامة على الشاشة" };
  return { en: "Product name", ar: "اسم المنتج" };
}

function sourceLabel(arabic: boolean, kind: ReturnType<typeof campaignSourceForProject>["kind"]) {
  const copyByKind = {
    product_url: ["Product link", "رابط منتج"],
    business_url: ["Business or service link", "رابط نشاط أو خدمة"],
    product_upload: ["Uploaded photos", "صور مرفوعة"],
    real_footage: ["Real footage", "فيديو حقيقي"],
    service_manual: ["Details entered manually", "تفاصيل مدخلة يدوياً"],
  } as const;
  const current = copyByKind[kind];
  return copy(arabic, current[0], current[1]);
}

function quoteStateMessage(arabic: boolean, state: CampaignReviewQuoteState) {
  if (state === "loading") return copy(arabic, "Confirming the current price…", "جارٍ تأكيد السعر الحالي…");
  if (state === "expired") return copy(arabic, "The confirmed price expired. Refresh it before generating.", "انتهت صلاحية السعر المؤكد. حدّثه قبل الإنشاء.");
  if (state === "changed") return copy(arabic, "Your campaign changed. Confirm the current price again.", "تغيّرت حملتك. أكد السعر الحالي مرة ثانية.");
  return copy(arabic, "We couldn’t confirm the current price. Your campaign is saved.", "ما قدرنا نؤكد السعر الحالي. حملتك محفوظة.");
}

/**
 * The final review is deliberately derived from the active project on every render.
 * It never creates a second summary payload, so the facts the user sees are the
 * same facts used by claim, quote and eventual submission.
 */
export function CampaignReviewStep({
  project,
  rightsConfirmed,
  quote,
  quoteState,
  arabic = false,
  hidePricing = false,
  sourceError,
  sourceBusy = false,
  requestId,
  generateButtonRef,
  onEdit,
  onRightsChange,
  onRetryQuote,
  onGenerate,
}: CampaignReviewStepProps) {
  const source = campaignSourceForProject(project);
  const sourceFacts = factsForReview(source, project.goal).filter((row) => row.fact && (!hidePricing || row.field !== "price"));
  const templateName = project.templateId.replace(/-/g, " ");
  const presenter = project.presenterMode === "ai_ugc"
    ? copy(arabic, "AI UGC presenter", "مقدّم UGC")
    : project.presenterMode === "uploaded_spokesperson"
      ? copy(arabic, "Uploaded spokesperson", "متحدث مرفوع")
      : copy(arabic, "No presenter", "بدون مقدم");
  const quoteFresh = quoteState === "ready" && quote && new Date(quote.expiresAt).getTime() > Date.now();
  const primaryName = campaignFactValue(source, source.subject === "product" ? "name" : "service_name").trim() || project.product.name.trim();
  const requiresSourceMedia = templateRequiresSourceMedia(project.templateId);
  const hasRequiredSource = Boolean(primaryName && (!requiresSourceMedia || hasCreatorImageReference(project.product.images)));
  const canGenerate = Boolean(quoteFresh && rightsConfirmed && hasRequiredSource && !sourceBusy);
  const missingRights = !rightsConfirmed;
  const goal = getCampaignGoalOption(project.goal).label;

  // Per-template "what is required" list. Each item is a structured object so the UI can
  // render a specific message and a single "Edit source" link that jumps the user back to
  // the relevant step. The labels reuse primaryNameLabel() so the wording matches what the
  // user already saw in the facts form.
  const missingItems: { key: string; message: string; editTarget: CampaignReviewEditTarget }[] = [];
  if (!primaryName) {
    const label = primaryNameLabel(false, project.templateId, source.subject);
    const labelAr = primaryNameLabel(true, project.templateId, source.subject);
    missingItems.push({
      key: "primaryName",
      message: arabic
        ? `أضف ${labelAr.ar} للمتابعة.`
        : `Add a ${label.en.toLowerCase()} to continue.`,
      editTarget: "source",
    });
  }
  if (requiresSourceMedia && !hasCreatorImageReference(project.product.images)) {
    missingItems.push({
      key: "media",
      message: copy(
        arabic,
        "Upload at least one product photo to continue.",
        "أرفق صورة منتج واحدة على الأقل للمتابعة.",
      ),
      editTarget: "source",
    });
  }
  if (project.goal === "whatsapp_orders" && !project.whatsapp?.trim()) {
    missingItems.push({
      key: "whatsapp",
      message: copy(
        arabic,
        "Add a Kuwait WhatsApp number to continue.",
        "أضف رقم واتساب كويتي للمتابعة.",
      ),
      editTarget: "details",
    });
  }
  if (project.goal === "bookings" && !project.bookingUrl?.trim()) {
    missingItems.push({
      key: "bookingUrl",
      message: copy(
        arabic,
        "Add a valid booking link to continue.",
        "أضف رابط حجز صحيح للمتابعة.",
      ),
      editTarget: "details",
    });
  }
  if (project.goal === "offer" && !project.offer?.trim()) {
    missingItems.push({
      key: "offer",
      message: copy(arabic, "Add an offer to continue.", "أضف عرضًا للمتابعة."),
      editTarget: "details",
    });
  }
  // Build a single concise summary that matches the inline list, so screen readers using
  // the Generate-button aria-describedby hear the same wording.
  const summaryEn = missingItems.map((item) => item.message).join(" ");
  const summaryAr = missingItems.map((item) => item.message).join(" ");

  const reviewActionsId = useId();
  const missingListId = `${reviewActionsId}-missing`;
  const reviewActionsAria = missingItems.length ? { "aria-describedby": missingListId } : {};

  const editButton = (target: CampaignReviewEditTarget, label: string) => (
    <button type="button" className="creator-review-edit" onClick={() => onEdit(target)}>
      <PencilLine aria-hidden="true" /> {label}
    </button>
  );

  return (
    <section className="creator-campaign-review" dir={arabic ? "rtl" : undefined} aria-labelledby="campaign-review-heading">
      <header className="creator-campaign-review-head">
        <p className="creator-kicker">{copy(arabic, "Final review", "المراجعة الأخيرة")}</p>
        <h2 id="campaign-review-heading">{copy(arabic, "Review your campaign", "راجع حملتك")}</h2>
        <p>{copy(arabic, "Check exactly what we’ll use. You can edit any group without losing your campaign.", "تأكد من كل ما سنستخدمه. تقدر تعدّل أي قسم بدون ما تفقد حملتك.")}</p>
      </header>

      <div className="creator-review-groups">
        <section className="creator-review-group" aria-labelledby="review-source-heading">
          <div className="creator-review-group-head"><div><span className="creator-review-index">01</span><h3 id="review-source-heading">{copy(arabic, "Source", "المصدر")}</h3></div>{editButton("source", copy(arabic, "Edit source", "تعديل المصدر"))}</div>
          <dl className="creator-review-list">
            <div><dt>{copy(arabic, "Type", "النوع")}</dt><dd>{sourceLabel(arabic, source.kind)}</dd></div>
            {project.product.sourceUrl && <div><dt>{copy(arabic, "Link", "الرابط")}</dt><dd dir="ltr" className="creator-review-direction-value">{project.product.sourceUrl}</dd></div>}
            <div><dt>{copy(arabic, "Media", "الوسائط")}</dt><dd>{project.product.images.length ? copy(arabic, `${project.product.images.length} selected`, `${project.product.images.length} محددة`) : copy(arabic, "No media selected", "لم يتم اختيار وسائط")}</dd></div>
          </dl>
        </section>

        <section className="creator-review-group" aria-labelledby="review-campaign-heading">
          <div className="creator-review-group-head"><div><span className="creator-review-index">02</span><h3 id="review-campaign-heading">{copy(arabic, "Campaign", "الحملة")}</h3></div>{editButton("facts", copy(arabic, "Edit facts", "تعديل المعلومات"))}</div>
          <dl className="creator-review-list">
            <div><dt>{copy(arabic, "Template", "القالب")}</dt><dd className="creator-review-capitalize">{templateName}</dd></div>
            <div><dt>{copy(arabic, "Result", "النتيجة")}</dt><dd>{arabic ? ({ whatsapp_orders: "طلبات واتساب", bookings: "الحجوزات", launch: "إطلاق جديد", offer: "ترويج عرض", demonstration: "شرح المنتج أو الخدمة", education: "محتوى توعوي", announcement: "إعلان", trust: "بناء الثقة", brand_story: "قصة العلامة التجارية" }[project.goal]) : goal}</dd></div>
            <div><dt>{copy(arabic, "Call to action", "الدعوة للإجراء")}</dt><dd>{project.cta}</dd></div>
            {sourceFacts.map(({ field, fact }) => fact && <div key={field}><dt>{FACT_LABELS[field][arabic ? "ar" : "en"]}</dt><dd><span dir={valueDirection(fact.value)} className={cn(valueDirection(fact.value) && "creator-review-direction-value")}>{field === "price" ? `${fact.value} KWD` : fact.value}</span><small>{provenanceCopy(arabic, fact.provenance)}</small></dd></div>)}
          </dl>
        </section>

        <section className="creator-review-group" aria-labelledby="review-presenter-heading">
          <div className="creator-review-group-head"><div><span className="creator-review-index">03</span><h3 id="review-presenter-heading">{copy(arabic, "Presenter and media", "المقدم والوسائط")}</h3></div>{editButton("details", copy(arabic, "Edit presenter", "تعديل المقدم"))}</div>
          <dl className="creator-review-list"><div><dt>{copy(arabic, "Who appears", "من يظهر")}</dt><dd>{presenter}</dd></div><div><dt>{copy(arabic, "Reference media", "وسائط مرجعية")}</dt><dd>{project.product.images.length ? copy(arabic, `${project.product.images.length} file${project.product.images.length === 1 ? "" : "s"} selected`, `${project.product.images.length} ملف محدد`) : copy(arabic, "No media selected", "لم يتم اختيار وسائط")}</dd></div></dl>
        </section>

        <section className="creator-review-group" aria-labelledby="review-delivery-heading">
          <div className="creator-review-group-head"><div><span className="creator-review-index">04</span><h3 id="review-delivery-heading">{copy(arabic, "Delivery", "التسليم")}</h3></div>{editButton("details", copy(arabic, "Edit delivery", "تعديل التسليم"))}</div>
          <dl className="creator-review-list"><div><dt>{copy(arabic, "Market", "السوق")}</dt><dd>{MARKET_META[project.market].label} · {MARKET_META[project.market].currency}</dd></div><div><dt>{copy(arabic, "Language", "اللغة")}</dt><dd>{project.language === "bilingual" ? copy(arabic, "Arabic + English", "العربية + الإنجليزية") : project.language === "ar" ? copy(arabic, "Kuwaiti Arabic", "العربية الكويتية") : copy(arabic, "English", "الإنجليزية")}</dd></div><div><dt>{copy(arabic, "Format", "المقاس")}</dt><dd dir="ltr" className="creator-review-direction-value">{project.aspectRatio} · {project.resolution}</dd></div><div><dt>{copy(arabic, "Audio and subtitles", "الصوت والترجمة")}</dt><dd>{project.audio ? copy(arabic, "Audio on", "الصوت مفعّل") : copy(arabic, "Audio off", "الصوت متوقف")} · {project.subtitles ? copy(arabic, "Subtitles on", "الترجمة مفعلة") : copy(arabic, "Subtitles off", "الترجمة متوقفة")}</dd></div></dl>
        </section>

        <section className={cn("creator-review-group", missingRights && "has-review-warning")} aria-labelledby="review-rights-heading">
          <div className="creator-review-group-head"><div><span className="creator-review-index">05</span><h3 id="review-rights-heading">{copy(arabic, "Rights", "الحقوق")}</h3></div>{editButton("details", copy(arabic, "Edit rights", "تعديل الحقوق"))}</div>
          <label className="creator-review-rights"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => onRightsChange?.(event.target.checked)} /><span><strong>{rightsConfirmed ? <><CheckCircle2 aria-hidden="true" /> {copy(arabic, "Confirmed", "تم التأكيد")}</> : <><CircleAlert aria-hidden="true" /> {copy(arabic, "Confirmation needed", "التأكيد مطلوب")}</>}</strong><span>{copy(arabic, "I have permission to use the media and the campaign facts are accurate.", "لدي إذن لاستخدام الوسائط ومعلومات الحملة دقيقة.")}</span></span></label>
        </section>

        {!hidePricing && <section className="creator-review-group creator-review-price" aria-labelledby="review-price-heading">
          <div className="creator-review-group-head"><div><span className="creator-review-index">06</span><h3 id="review-price-heading">{copy(arabic, "Price", "السعر")}</h3></div>{quoteState !== "ready" && onRetryQuote ? <button type="button" className="creator-review-edit" onClick={onRetryQuote}><RefreshCw aria-hidden="true" /> {copy(arabic, "Refresh price", "حدّث السعر")}</button> : editButton("details", copy(arabic, "Edit campaign", "تعديل الحملة"))}</div>
          {quoteFresh ? <div className="creator-review-price-ready"><span>{quote.entitlementEligible ? copy(arabic, "Your first campaign", "حملتك الأولى") : copy(arabic, "Confirmed generation price", "سعر الإنشاء المؤكد")}</span><strong>{quote.entitlementEligible ? copy(arabic, "Included · 0 credits", "مشمول · 0 رصيد") : copy(arabic, `${quote.credits} credits`, `${quote.credits} رصيد`)}</strong><small><Clock3 aria-hidden="true" /> {copy(arabic, "Valid for this exact campaign", "صالح لهذه الحملة بالضبط")}</small></div> : <div className="creator-review-price-state" role="status" aria-live="polite"><CircleAlert aria-hidden="true" /><span>{quoteStateMessage(arabic, quoteState)}</span>{requestId && <details><summary>{copy(arabic, "Support details", "تفاصيل الدعم")}</summary><code>{copy(arabic, "Request ID", "رقم الطلب")}: {requestId}</code></details>}</div>}
        </section>}
      </div>

      {sourceError && <p className="creator-error" role="alert">{sourceError}</p>}
      {hidePricing && ["unavailable", "expired"].includes(quoteState) && onRetryQuote && <button type="button" className="creator-button creator-button-secondary" onClick={onRetryQuote}><RefreshCw aria-hidden="true" /> {copy(arabic, "Retry connection", "إعادة الاتصال")}</button>}
      {missingItems.length > 0 && (
        <aside className="creator-review-missing" id={missingListId} aria-labelledby={`${missingListId}-heading`}>
          <p id={`${missingListId}-heading`} className="creator-review-missing-title">
            <CircleAlert aria-hidden="true" /> {copy(arabic, "Before you can generate, finish these:", "قبل الإنشاء، أكمل ما يلي:")}
          </p>
          <ul>
            {missingItems.map((item) => (
              <li key={item.key}>
                <span>{item.message}</span>
                <button type="button" className="creator-review-missing-link" onClick={() => onEdit(item.editTarget)}>
                  <PencilLine aria-hidden="true" /> {item.editTarget === "source"
                    ? copy(arabic, "Edit source", "تعديل المصدر")
                    : copy(arabic, "Edit details", "تعديل التفاصيل")}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
      <div className="creator-review-actions">
        <p {...reviewActionsAria}>
          {canGenerate
            ? copy(arabic, "Everything is ready. Generate a preview, then sign in to download.", "كل شيء جاهز. أنشئ المعاينة ثم سجل الدخول للتنزيل.")
            : missingItems.length > 0
              ? arabic ? summaryAr : summaryEn
              : missingRights
                ? copy(arabic, "Confirm your rights to generate this campaign.", "أكد حقوقك لإنشاء هذه الحملة.")
                : hidePricing
                  ? quoteState === "loading" || quoteState === "changed"
                    ? copy(arabic, "Checking generation availability…", "جارٍ التحقق من توفر التوليد…")
                    : copy(arabic, "Generation is unavailable. Complete the storage and generation setup, then retry. Your campaign is saved.", "التوليد غير متوفر. أكمل إعداد التخزين والتوليد ثم أعد المحاولة. حملتك محفوظة.")
                  : quoteState === "ready"
                    ? copy(arabic, "Your campaign is being prepared. Keep this page open.", "جارٍ تجهيز حملتك. أبق هذه الصفحة مفتوحة.")
                    : quoteStateMessage(arabic, quoteState)}
        </p>
        <button ref={generateButtonRef} type="button" className="creator-button creator-button-primary" onClick={onGenerate} disabled={!canGenerate} {...reviewActionsAria}>
          {sourceBusy ? <RefreshCw className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
          {copy(arabic, "Generate campaign", "أنشئ الحملة")}
        </button>
      </div>
    </section>
  );
}
