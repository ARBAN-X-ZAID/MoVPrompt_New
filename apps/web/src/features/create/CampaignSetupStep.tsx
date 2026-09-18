import { useId, useMemo, useState } from "react";

import { campaignCtaLabel, CTA_OPTIONS, getCampaignGoalOption, type CreatorLanguage, type CreatorProject, type CreatorResolution } from "./types";
import { getCreatorTemplate } from "./templates";
import { campaignPurposeChange, templateCampaignIssue, templateCampaignOptions, type TemplateCampaignOptions } from "./templateCampaignOptions";
import { PresenterChoice, type PresenterCompatibility } from "./PresenterChoice";
import {
  CTA_BY_GOAL,
  deliveryFieldsFor,
  validateCampaignSetup,
  type CampaignSetupField,
} from "./campaignSetupRules";

type CampaignSetupStepProps = {
  project: CreatorProject;
  onChange: (changes: Partial<CreatorProject>, field: CampaignSetupField) => void;
  onContinue: () => void;
  presenterCompatibility?: PresenterCompatibility;
  arabic?: boolean;
  options?: TemplateCampaignOptions;
  settingsReady?: boolean;
  settingsError?: string;
  onRetrySettings?: () => void;
};

function copy(arabic: boolean, english: string, arabicText: string) {
  return arabic ? arabicText : english;
}

export function CampaignSetupStep({
  project,
  onChange,
  onContinue,
  presenterCompatibility = { aiUgc: false, uploadedSpokesperson: false },
  arabic = false,
  options = templateCampaignOptions(getCreatorTemplate(project.templateId)),
  settingsReady = true,
  settingsError = "",
  onRetrySettings,
}: CampaignSetupStepProps) {
  const [errors, setErrors] = useState<ReturnType<typeof validateCampaignSetup>>({});
  const errorSummaryId = useId();
  const compatibilityIssue = templateCampaignIssue(project, options, arabic);
  const delivery = deliveryFieldsFor(project.goal);
  const showBooking = delivery.showBooking || Boolean(project.bookingUrl);
  const showWhatsapp = delivery.showWhatsapp || Boolean(project.whatsapp);
  const presenter = project.presenter ?? (project.presenterMode === "ai_ugc" ? { mode: "ai_ugc" as const } : { mode: "none" as const });
  const activeErrors = useMemo(() => Object.values(errors).filter(Boolean), [errors]);

  const apply = (field: CampaignSetupField, changes: Partial<CreatorProject>) => {
    onChange(changes, field);
  };

  const continueToReview = () => {
    if (!settingsReady || compatibilityIssue) return;
    const nextErrors = validateCampaignSetup(project);
    setErrors(nextErrors);
    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      document.getElementById(`campaign-${firstInvalid}`)?.focus();
      return;
    }
    onContinue();
  };

  return (
    <div className="creator-campaign-setup" dir={arabic ? "rtl" : undefined}>
      <div className="creator-campaign-setup-head">
        <div>
          <p className="creator-kicker">{copy(arabic, "Final details", "التفاصيل الأخيرة")}</p>
          <h2>{copy(arabic, "Set up your campaign", "جهّز حملتك")}</h2>
          <p>{copy(arabic, "Choose only the details your customer will see. Your source facts stay unchanged.", "اختر فقط التفاصيل التي راح يشوفها العميل. معلومات المصدر تبقى مثل ما هي.")}</p>
        </div>
        <div className="creator-setup-complete-summary" aria-label={copy(arabic, "Completed campaign settings", "إعدادات الحملة المكتملة")}>
          <span>{copy(arabic, "Kuwait", "الكويت")}</span>
          <span>{project.language === "bilingual" ? copy(arabic, "Arabic + English", "عربي + إنجليزي") : project.language === "ar" ? copy(arabic, "Arabic", "عربي") : copy(arabic, "English", "إنجليزي")}</span>
          <span>{project.aspectRatio}</span>
        </div>
      </div>

      {(compatibilityIssue || !settingsReady) && <p className="creator-field-error" role={compatibilityIssue || settingsError ? "alert" : "status"}>{compatibilityIssue || settingsError || copy(arabic, "Checking this template’s supported settings…", "جارٍ التحقق من إعدادات القالب…")}</p>}
      {settingsError && onRetrySettings && <button type="button" className="creator-button creator-button-secondary" onClick={onRetrySettings}>{copy(arabic, "Retry template check", "أعد التحقق من القالب")}</button>}
      <div className="creator-field">
        <label htmlFor="campaign-goal">{copy(arabic, "Campaign purpose", "هدف الحملة")}<span className="creator-required" aria-hidden="true"> *</span></label>
        <select id="campaign-goal" aria-label={copy(arabic, "Campaign purpose", "هدف الحملة")} aria-required="true" aria-invalid={!options.goals.includes(project.goal)} className="creator-select" value={options.goals.includes(project.goal) ? project.goal : ""} onChange={event => apply("goal", campaignPurposeChange(project, event.target.value as CreatorProject["goal"]))}>
          {!options.goals.includes(project.goal) && <option value="" disabled>{copy(arabic, "Choose a supported purpose", "اختر هدفاً يدعمه القالب")}</option>}
          {options.goals.map(goal => <option key={goal} value={goal}>{copy(arabic, getCampaignGoalOption(goal).label, ({ whatsapp_orders: "طلبات واتساب", bookings: "الحصول على حجوزات", launch: "إطلاق شيء جديد", offer: "الترويج لعرض", demonstration: "شرح المنتج أو الخدمة", education: "شرح فكرة", announcement: "إعلان خبر", trust: "بناء الثقة", brand_story: "قصة العلامة التجارية" })[goal])}</option>)}
        </select>
        <span className="creator-field-help">{copy(arabic, "Only settings supported by this template are shown.", "تظهر فقط الإعدادات التي يدعمها هذا القالب.")}</span>
      </div>

      {activeErrors.length > 0 && (
        <div className="creator-campaign-error-summary" id={errorSummaryId} role="alert" tabIndex={-1}>
          <strong>{copy(arabic, "Check the highlighted details", "راجع التفاصيل المحددة")}</strong>
          <span>{activeErrors[0]}</span>
        </div>
      )}

      <section className="creator-campaign-section" aria-labelledby="campaign-presenter-heading">
        <div className="creator-campaign-section-head">
          <span>01</span>
          <div><h3 id="campaign-presenter-heading">{copy(arabic, "Who appears?", "من يظهر في الفيديو؟")}</h3><p>{copy(arabic, "This version keeps the focus on your product or service.", "هذه النسخة تركز على منتجك أو خدمتك.")}</p></div>
        </div>
        <PresenterChoice
          value={presenter}
          compatibility={presenterCompatibility}
          eligibleFootage={project.product.images}
          onChange={(presenter) => {
            apply("presenter", { presenter, presenterMode: presenter.mode });
          }}
          arabic={arabic}
        />
      </section>

      <section className="creator-campaign-section" aria-labelledby="campaign-audience-heading">
        <div className="creator-campaign-section-head">
          <span>02</span>
          <div><h3 id="campaign-audience-heading">{copy(arabic, "Market and language", "السوق واللغة")}</h3><p>{copy(arabic, "Kuwait is selected for this launch. Your interface language can stay separate.", "الكويت مختارة لهذا الإطلاق. لغة الواجهة تقدر تبقى مختلفة.")}</p></div>
        </div>
        <div className="creator-form-grid">
          <div className="creator-field"><label htmlFor="campaign-market">{copy(arabic, "Market", "السوق")}</label><select id="campaign-market" className="creator-select" value="KW" disabled><option value="KW">{copy(arabic, "Kuwait · KWD", "الكويت · د.ك")}</option></select></div>
          <div className="creator-field"><label htmlFor="campaign-language">{copy(arabic, "Campaign language", "لغة الحملة")}</label><select id="campaign-language" className="creator-select" value={options.languages.includes(project.language) ? project.language : ""} onChange={(event) => apply("language", { language: event.target.value as CreatorLanguage })}>{!options.languages.includes(project.language) && <option value="" disabled>{copy(arabic, "Choose a supported language", "اختر لغة يدعمها القالب")}</option>}{options.languages.map(language => <option key={language} value={language}>{language === "en" ? copy(arabic, "English", "الإنجليزية") : language === "ar" ? copy(arabic, "Kuwaiti Arabic", "العربية الكويتية") : copy(arabic, "Arabic + English", "العربية + الإنجليزية")}</option>)}</select><span className="creator-field-help">{project.language === "en" ? copy(arabic, "The campaign copy will be in English.", "نص الحملة راح يكون بالإنجليزية.") : copy(arabic, "Arabic copy uses Kuwait language conventions.", "النص العربي يستخدم أسلوب اللغة الكويتية.")}</span></div>
        </div>
      </section>

      <section className="creator-campaign-section" aria-labelledby="campaign-offer-heading">
        <div className="creator-campaign-section-head"><span>03</span><div><h3 id="campaign-offer-heading">{copy(arabic, "Offer and action", "العرض والإجراء")}</h3><p>{copy(arabic, "Optional values remain saved if you change the campaign result later.", "القيم الاختيارية تظل محفوظة إذا غيّرت نتيجة الحملة لاحقاً.")}</p></div></div>
        <div className="creator-form-grid">
          <div className="creator-field"><label htmlFor="campaign-offer">{copy(arabic, "Offer", "العرض")}{project.goal === "offer" && <span className="creator-required" aria-hidden="true"> *</span>}</label><input id="campaign-offer" aria-label={copy(arabic, "Offer", "العرض")} aria-required={project.goal === "offer"} aria-invalid={Boolean(errors.offer)} aria-describedby={errors.offer ? "campaign-offer-error" : undefined} className="creator-input" value={project.offer} onChange={(event) => apply("offer", { offer: event.target.value })} placeholder={copy(arabic, "e.g. gift with every order", "مثلاً هدية مع كل طلب")} />{errors.offer && <p id="campaign-offer-error" className="creator-field-error">{errors.offer}</p>}</div>
          <div className="creator-field"><label htmlFor="campaign-cta">{copy(arabic, "Call to action", "الدعوة للإجراء")}</label><select id="campaign-cta" className="creator-select" value={project.cta} onChange={(event) => apply("cta", { cta: event.target.value })}>{CTA_OPTIONS.map((cta) => { const label = campaignCtaLabel(cta, arabic); return <option key={cta} value={cta}>{cta === CTA_BY_GOAL[project.goal] ? `${label} · ${copy(arabic, "recommended", "موصى به")}` : label}</option>; })}</select></div>
        </div>
      </section>

      <section className="creator-campaign-section" aria-labelledby="campaign-delivery-heading">
        <div className="creator-campaign-section-head"><span>04</span><div><h3 id="campaign-delivery-heading">{copy(arabic, "Where should customers go?", "وين يروح العميل؟")}</h3><p>{delivery.showBooking ? copy(arabic, "This booking campaign needs a working booking link.", "حملة الحجز تحتاج رابط حجز يعمل.") : delivery.showWhatsapp ? copy(arabic, "This WhatsApp campaign needs a Kuwait WhatsApp number.", "حملة الواتساب تحتاج رقم واتساب كويتي.") : copy(arabic, "Add a destination when it helps your campaign. Nothing is deleted when this section changes.", "أضف وجهة إذا كانت تفيد حملتك. ما نحذف أي شيء لما يتغير هذا القسم.")}</p></div></div>
        <div className="creator-form-grid">
          {showBooking && <div className="creator-field"><label htmlFor="campaign-bookingUrl">{copy(arabic, "Booking link", "رابط الحجز")}{delivery.showBooking && <span className="creator-required" aria-hidden="true"> *</span>}</label><input id="campaign-bookingUrl" aria-label={copy(arabic, "Booking link", "رابط الحجز")} aria-required={delivery.showBooking} className="creator-input" aria-invalid={Boolean(errors.bookingUrl)} aria-describedby={errors.bookingUrl ? "campaign-bookingUrl-error" : undefined} inputMode="url" value={project.bookingUrl} onChange={(event) => apply("bookingUrl", { bookingUrl: event.target.value })} placeholder="https://…" />{errors.bookingUrl && <p id="campaign-bookingUrl-error" className="creator-field-error">{errors.bookingUrl}</p>}</div>}
          {showWhatsapp && <div className="creator-field"><label htmlFor="campaign-whatsapp">{copy(arabic, "WhatsApp number", "رقم واتساب")}{delivery.showWhatsapp && <span className="creator-required" aria-hidden="true"> *</span>}</label><input id="campaign-whatsapp" aria-label={copy(arabic, "WhatsApp number", "رقم واتساب")} aria-required={delivery.showWhatsapp} className="creator-input" aria-invalid={Boolean(errors.whatsapp)} aria-describedby={errors.whatsapp ? "campaign-whatsapp-error" : undefined} inputMode="tel" dir="ltr" value={project.whatsapp} onChange={(event) => apply("whatsapp", { whatsapp: event.target.value })} placeholder="+965 5000 0000" />{errors.whatsapp && <p id="campaign-whatsapp-error" className="creator-field-error">{errors.whatsapp}</p>}</div>}
          {!showBooking && !showWhatsapp && <p className="creator-field-help creator-campaign-preserved">{copy(arabic, "Add optional contact details in Review the facts if you want them on the closing card.", "أضف بيانات التواصل الاختيارية في مراجعة المعلومات لعرضها في بطاقة نهاية الفيديو.")}</p>}
        </div>
      </section>

      <section className="creator-campaign-section" aria-labelledby="campaign-delivery-format-heading">
        <div className="creator-campaign-section-head"><span>05</span><div><h3 id="campaign-delivery-format-heading">{copy(arabic, "Delivery", "التسليم")}</h3><p>{copy(arabic, "Choose a social format and quality. You can export other formats later.", "اختر مقاس وجودة للسوشيال. تقدر تصدر مقاسات ثانية لاحقاً.")}</p></div></div>
        <div className="creator-form-grid">
          <fieldset className="creator-field"><legend>{copy(arabic, "Video format", "مقاس الفيديو")}</legend><div className="creator-choice-grid creator-ratio-grid">{options.ratios.map((ratio) => <button key={ratio} type="button" className={`creator-choice ${project.aspectRatio === ratio ? "is-selected" : ""}`} aria-pressed={project.aspectRatio === ratio} onClick={() => apply("aspectRatio", { aspectRatio: ratio })}>{ratio}</button>)}</div></fieldset>
          <div className="creator-field"><label htmlFor="campaign-resolution">{copy(arabic, "Quality", "الجودة")}</label><select id="campaign-resolution" className="creator-select" value={options.resolutions.includes(project.resolution) ? project.resolution : ""} onChange={(event) => apply("resolution", { resolution: event.target.value as CreatorResolution })}>{!options.resolutions.includes(project.resolution) && <option value="" disabled>{copy(arabic, "Choose a supported quality", "اختر جودة يدعمها القالب")}</option>}{options.resolutions.map(resolution => <option key={resolution} value={resolution}>{resolution} · {resolution === "720p" ? copy(arabic, "Recommended", "موصى به") : copy(arabic, "Faster preview", "معاينة أسرع")}</option>)}</select></div>
        </div>
        <div className="creator-campaign-toggles"><label className="creator-check-row"><input type="checkbox" checked={project.subtitles} onChange={(event) => apply("subtitles", { subtitles: event.target.checked })} /><span>{copy(arabic, "Include subtitles when the video contains speech.", "أضف ترجمة مكتوبة إذا كان الفيديو يحتوي على كلام.")}</span></label><label className="creator-check-row"><input type="checkbox" checked={project.audio} onChange={(event) => apply("audio", { audio: event.target.checked })} /><span>{copy(arabic, "Include music and sound for this version.", "أضف موسيقى وصوت لهذه النسخة.")}</span></label></div>
      </section>

      <div className="creator-campaign-actions">
        <button className="creator-button creator-button-primary" type="button" onClick={continueToReview} disabled={!settingsReady || Boolean(compatibilityIssue)}>{copy(arabic, "Continue to review", "المتابعة للمراجعة")}</button>
      </div>
    </div>
  );
}
