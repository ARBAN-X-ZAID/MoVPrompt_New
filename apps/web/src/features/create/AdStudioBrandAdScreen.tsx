import { useEnabledTemplateDurations } from "./useEnabledTemplateDurations";
import { AssetUpload } from "../assets/AssetUpload";
import { AutomaticPhotoStatus } from "../assets/automaticAssets";
import { ReferencePhoto } from "../assets/ReferencePhoto";
import { offeredCampaignLanguages } from "./templateCampaignOptions";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ImagePlus } from "lucide-react";
import { CreditShortfallNotice, GenerateLabel } from "./creditGate";
import {
  AD_STUDIO_BRAND_AD_DURATIONS,
  AD_STUDIO_BRAND_AD_LIMITS,
  isAdStudioWebsite,
  missingAdStudioBrandAdFields,
  templatePhotoIssues,
  type AdStudioBrandAdSettings,
} from "@movprompt/contracts";
import { LAUNCH_PHOTO_POLICIES } from "@movprompt/creative-engine";
import type { CreateScreenProps } from "./CreateScreen";
import type { CreatorProject } from "./types";
import { useCapabilities } from "./useCapabilities";
import { brandAdSettingsForProject, hiddenAdStudioSettingsReset } from "./adStudioBrandAdProject";
import "./ad-studio.css";

export type AdStudioBrandAdScreenProps = CreateScreenProps & {
  signedIn: boolean;
  /** Shown after a guest returns from sign-in with the saved form. */
  resumeNotice?: boolean;
  onBrandAdSettingsChange: (settings: AdStudioBrandAdSettings) => void;
  onProjectSettingsChange: (changes: Partial<CreatorProject>) => void;
  onLanguageChange: (language: CreatorProject["language"]) => void;
};

type TextKey = Exclude<keyof typeof AD_STUDIO_BRAND_AD_LIMITS, "website">;
type Copy = { label: [string, string]; placeholder: [string, string] };

const FIELDS: Record<TextKey, Copy> = {
  brandName: { label: ["Brand name", "اسم العلامة"], placeholder: ["e.g. Oud Al Layl", "مثال: عود الليل"] },
  sellingPoints: { label: ["Selling points", "نقاط البيع"], placeholder: ["Main reason to buy, e.g. Free delivery in Kuwait", "أهم سبب للشراء، مثال: توصيل مجاني في الكويت"] },
  aesthetics: { label: ["Aesthetics", "الطابع البصري"], placeholder: ["Look and feel, e.g. Dark, luxury, warm gold light", "الشكل والإحساس، مثال: داكن، فاخر، إضاءة ذهبية دافئة"] },
  audience: { label: ["Audience", "الجمهور"], placeholder: ["Who the ads are for", "لمن هذه الإعلانات"] },
  description: { label: ["Description", "الوصف"], placeholder: ["What the brand sells, who it's for and what makes it different", "ماذا تبيع العلامة ولمن وما الذي يميزها"] },
  socials: { label: ["Socials", "حسابات التواصل"], placeholder: ["Instagram, TikTok or other profile link", "إنستغرام أو تيك توك أو رابط حساب آخر"] },
  videoIdea: { label: ["What should happen in the video?", "ماذا يحدث في الفيديو؟"], placeholder: ["e.g. A woman sprays the perfume on her wrist and smiles.", "مثال: امرأة ترش العطر على معصمها وتبتسم."] },
};

export function AdStudioBrandAdScreen(props: AdStudioBrandAdScreenProps) {
  const { project, arabic = false, onLanguageChange, onProjectSettingsChange } = props;
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const focusFeedback = useRef(false);
  const t = (en: string, ar: string) => arabic ? ar : en;
  const pick = (pair: [string, string]) => arabic ? pair[1] : pair[0];
  const value = brandAdSettingsForProject(project);
  const offeredLanguages = offeredCampaignLanguages(props.template.languages);
  const firstLanguage = offeredLanguages[0] ?? "en";
  const needsGenerate = Boolean(props.resumeNotice || props.generationError);
  const [step, setStep] = useState<1 | 2>(needsGenerate ? 2 : 1);
  const [attempted, setAttempted] = useState(false);
  // Half-typed addresses stay here: only a valid website reaches the saved draft.
  const [website, setWebsite] = useState(value.website);
  const capabilities = useCapabilities();
  const availability = useEnabledTemplateDurations(project.templateCatalogSlug ?? project.templateId, (props.project.templateDefinition?.supportedDurations ?? AD_STUDIO_BRAND_AD_DURATIONS));
  const selected = project.product.images.filter(photo => photo.selected !== false && (photo.referenceRole ?? "subject") === "subject");
  const logo = value.logoChecksum ? project.product.images.find(photo => photo.referenceRole === "artwork" && photo.checksum === value.logoChecksum) : undefined;
  const photoIssues = templatePhotoIssues(LAUNCH_PHOTO_POLICIES[project.templateId]!, project.product.images.filter(photo => photo.selected !== false));
  const missing = missingAdStudioBrandAdFields(value);
  const websiteValid = isAdStudioWebsite(website);
  const fieldMessage = (key: TextKey) => t(`Fill in ${FIELDS[key].label[0].toLowerCase()}.`, `أكمل حقل ${FIELDS[key].label[1]}.`);
  const brandIssues = [...missing.map(fieldMessage), ...(websiteValid ? [] : [t("Enter a website such as www.yourbrand.com.", "أدخل موقعاً مثل www.yourbrand.com.")])];
  const adIssues = selected.length && !photoIssues.length ? [] : [t("Add at least one product photo.", "أضف صورة واحدة على الأقل للمنتج.")];
  const issues = step === 1 ? brandIssues : [...brandIssues, ...adIssues];
  const invalid = brandIssues.length > 0 || adIssues.length > 0;
  const unavailable = !availability.ready || !availability.durations.includes(props.durationSeconds) || !capabilities.templateReady || !capabilities.active.durations.includes(props.durationSeconds);
  const serverFeedback = step === 1 ? "" : props.generationError || props.error || (invalid ? "" : props.quoteError || (unavailable ? t("Generation is temporarily unavailable. Your form is saved.", "التوليد غير متاح مؤقتاً. نموذجك محفوظ.") : ""));
  const update = (patch: Partial<AdStudioBrandAdSettings>) => props.onBrandAdSettingsChange({ ...value, ...patch });
  const showIssue = (key: TextKey) => attempted && (missing as string[]).includes(key);
  const hiddenReset = hiddenAdStudioSettingsReset(project);
  useEffect(() => {
    if (hiddenReset) onProjectSettingsChange(hiddenReset);
    // The reset is rebuilt each render; a cleaned project returns null and ends this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(hiddenReset), onProjectSettingsChange]);
  useEffect(() => {
    // Ad Studio speaks one language; drafts saved before bilingual was removed switch to the first offered one.
    if (project.language === "bilingual") onLanguageChange(firstLanguage);
  }, [project.language, firstLanguage, onLanguageChange]);
  useEffect(() => {
    if (needsGenerate) setStep(2);
  }, [needsGenerate]);
  useEffect(() => {
    if (!focusFeedback.current) return;
    focusFeedback.current = false;
    feedbackRef.current?.focus();
  }, [attempted, issues.length]);

  const go = (next: 1 | 2) => {
    setAttempted(false);
    setStep(next);
    // The heading is the same element in both steps, so moving focus keeps keyboard users in place.
    window.requestAnimationFrame(() => headingRef.current?.focus());
  };
  const proceed = () => {
    if (brandIssues.length) {
      setAttempted(true);
      focusFeedback.current = true;
      return;
    }
    go(2);
  };

  const field = (key: TextKey, options: { multiline?: boolean; optional?: boolean; rows?: number } = {}) => {
    const copy = FIELDS[key];
    const fieldId = `${id}-${key}`;
    const invalidField = showIssue(key);
    const common = {
      id: fieldId,
      value: value[key],
      maxLength: AD_STUDIO_BRAND_AD_LIMITS[key],
      placeholder: pick(copy.placeholder),
      "aria-describedby": invalidField ? `${fieldId}-error` : undefined,
      "aria-invalid": invalidField || undefined,
      required: !options.optional,
      dir: "auto" as const,
      onChange: (event: { target: { value: string } }) => update({ [key]: event.target.value } as Partial<AdStudioBrandAdSettings>),
    };
    return <div className="ad-studio-field">
      <label htmlFor={fieldId} className="ad-studio-label">
        <span>{pick(copy.label)}</span>
        {options.optional && <span className="ad-studio-optional">{t("Optional", "اختياري")}</span>}
      </label>
      {options.multiline ? <textarea {...common} rows={options.rows ?? 3} /> : <input {...common} type="text" />}
      {invalidField && <p id={`${fieldId}-error`} className="ad-studio-field-error">{fieldMessage(key)}</p>}
    </div>;
  };

  const menu = <T extends string | number>(name: string, label: string, options: ReadonlyArray<readonly [T, string]>, current: T, onPick: (next: T) => void) =>
    <div className="ad-studio-field">
      <label htmlFor={`${id}-${name}`} className="ad-studio-label">
        <span>{label}</span>
      </label>
      <select id={`${id}-${name}`} value={String(current)} onChange={event => {
        const next = options.find(([option]) => String(option) === event.target.value);
        if (next) onPick(next[0]);
      }}>
        {options.map(([option, text]) => <option key={String(option)} value={String(option)}>{text}</option>)}
      </select>
    </div>;

  const websiteError = attempted && !websiteValid;
  const feedback = (attempted && issues.length > 0) || serverFeedback
    ? <div ref={feedbackRef} tabIndex={-1} id={`${id}-feedback`} className="ad-studio-feedback" role="alert">
      {attempted && issues.length > 0 && <ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
      {serverFeedback && <p>{serverFeedback}</p>}
    </div>
    : null;

  return <section className="ad-studio" dir={arabic ? "rtl" : "ltr"} aria-labelledby={`${id}-heading`}>
    <header className="ad-studio-header">
      <p className="ad-studio-eyebrow">{t(`Ad Studio · Step ${step} of 2`, `استوديو الإعلانات · الخطوة ${step} من 2`)}</p>
      <h1 ref={headingRef} tabIndex={-1} id={`${id}-heading`}>{step === 1 ? t("Create your brand kit", "أنشئ هوية علامتك") : t("Create your ad", "أنشئ إعلانك")}</h1>
      <p>{step === 1 ? t("Everything here shapes your ads.", "كل ما هنا يشكّل إعلاناتك.") : t("Add your product and choose your video.", "أضف منتجك واختر الفيديو.")}</p>
    </header>

    {props.resumeNotice && <p className="ad-studio-notice" role="status">{t("You're signed in. Press Generate to start.", "تم تسجيل الدخول. اضغط إنشاء للبدء.")}</p>}

    {step === 1 ? <div className="ad-studio-form">
      <section className="ad-studio-card ad-studio-brand" aria-label={t("Brand", "العلامة")}>
        <div className="ad-studio-brand-row">
          <div className="ad-studio-brand-fields">
            {field("brandName")}
            <div className="ad-studio-field">
              <label htmlFor={`${id}-website`} className="ad-studio-label">
                <span>{t("Website", "الموقع الإلكتروني")}</span>
                <span className="ad-studio-optional">{t("Optional", "اختياري")}</span>
              </label>
              <input id={`${id}-website`} type="text" inputMode="url" dir="ltr" autoComplete="url" value={website} maxLength={AD_STUDIO_BRAND_AD_LIMITS.website}
                placeholder="www.yourbrand.com" aria-invalid={websiteError || undefined} aria-describedby={websiteError ? `${id}-website-error` : undefined}
                onChange={event => { setWebsite(event.target.value); if (isAdStudioWebsite(event.target.value)) update({ website: event.target.value.trim() }); }} />
              {websiteError && <p id={`${id}-website-error`} className="ad-studio-field-error">{t("Enter a website such as www.yourbrand.com.", "أدخل موقعاً مثل www.yourbrand.com.")}</p>}
            </div>
          </div>
          <div className="ad-studio-logo">
            <span className="ad-studio-label"><span>{t("Logo", "الشعار")}</span><span className="ad-studio-optional">{t("Optional", "اختياري")}</span></span>
            <label className="ad-studio-logo-drop" htmlFor={`${id}-logo`}>
              {logo ? <img src={logo.url} alt={t("Your logo", "شعارك")} /> : <ImagePlus aria-hidden="true" />}
              <input id={`${id}-logo`} type="file" accept="image/jpeg,image/png,image/webp" disabled={props.busy}
                onChange={event => { const files = Array.from(event.target.files ?? []); if (files.length) props.onFiles(files, "artwork", true); event.target.value = ""; }} />
              <span>{logo ? t("Replace logo", "استبدل الشعار") : t("Choose logo", "اختر الشعار")}</span>
            </label>
            {logo && <button type="button" className="ad-studio-link" onClick={() => update({ logoChecksum: undefined })}>{t("Remove logo", "إزالة الشعار")}</button>}
          </div>
        </div>
      </section>
      <section className="ad-studio-card">{field("sellingPoints", { multiline: true, optional: true, rows: 2 })}</section>
      <div className="ad-studio-split">
        <section className="ad-studio-card">{field("aesthetics", { multiline: true, optional: true, rows: 2 })}</section>
        <section className="ad-studio-card">{field("audience", { multiline: true, optional: true, rows: 2 })}</section>
      </div>
      <section className="ad-studio-card">{field("description", { multiline: true, rows: 2 })}</section>
      <section className="ad-studio-card">{field("socials", { optional: true })}</section>
    </div> : <div className="ad-studio-form">
      <section className="ad-studio-card" aria-label={t("Product photos", "صور المنتج")}>
        <ProductPhotos props={props} missing={attempted && !selected.length} />
      </section>
      <section className="ad-studio-card" aria-label={t("Your video", "الفيديو")}>
        {field("videoIdea", { multiline: true, optional: true, rows: 3 })}
        <div className="ad-studio-choices">
          {menu("duration", t("Length", "المدة"), availability.durations.map(seconds => [seconds, t(`${seconds} seconds`, `${seconds} ثانية`)] as const), props.durationSeconds as (typeof AD_STUDIO_BRAND_AD_DURATIONS)[number], seconds => props.onDurationChange(seconds))}
          {menu("language", t("Language", "اللغة"), ([["ar", "العربية"], ["en", "English"]] as const).filter(([language]) => offeredLanguages.includes(language)), project.language === "ar" ? "ar" : "en", language => props.onLanguageChange(language))}
        </div>
      </section>
    </div>}

    <div className="ad-studio-bar">
      {feedback}
      {step === 2 && props.creditShortfall && !invalid && <CreditShortfallNotice id={`${id}-credits`} shortfall={props.creditShortfall} arabic={arabic} />}
      <div className="ad-studio-bar-row">
        {step === 2 && <button type="button" className="creator-button creator-button-quiet" onClick={() => go(1)}><ArrowLeft aria-hidden="true" className="rtl:rotate-180" />{t("Back", "رجوع")}</button>}
        <div className="ad-studio-bar-end">
          {step === 2 && !props.hidePricing && props.quote && !invalid && <p className="ad-studio-price"><strong>{props.quote.credits}</strong> {t("credits", "رصيد")}</p>}
          {step === 2 && props.onRetryQuote && !invalid && (unavailable || props.quoteError) && <button className="creator-button creator-button-quiet" type="button" onClick={props.onRetryQuote}>{t("Refresh generation check", "تحديث فحص التوليد")}</button>}
          {step === 1
            ? <button type="button" className="creator-button creator-button-primary ad-studio-generate" onClick={proceed}>{t("Continue", "متابعة")}</button>
            : <button ref={props.generateButtonRef} type="button" className="creator-button creator-button-primary ad-studio-generate"
              aria-describedby={issues.length || serverFeedback ? `${id}-feedback` : undefined}
              disabled={Boolean(props.busy) || (!invalid && (Boolean(props.creditShortfall) || unavailable || props.quoteState !== "ready" || (!props.hidePricing && !props.quote)))}
              aria-disabled={invalid || undefined}
              onClick={() => { setAttempted(true); if (invalid) focusFeedback.current = true; else props.onGenerate(); }}>
              <GenerateLabel signIn={props.signInToGenerate} arabic={arabic} english="Generate" arabicLabel="إنشاء" />
            </button>}
        </div>
      </div>
    </div>
  </section>;
}

function ProductPhotos({ props, missing }: { props: AdStudioBrandAdScreenProps; missing: boolean }) {
  const t = (en: string, ar: string) => props.arabic ? ar : en;
  const images = props.project.product.images.filter(image => image.selected !== false && (image.referenceRole ?? "subject") === "subject");
  return <fieldset className="ad-studio-photos" aria-invalid={missing || undefined}>
    <legend className="ad-studio-label"><span>{t("Product photos", "صور المنتج")}</span><span className="ad-studio-optional">{t("1 to 3 photos", "من 1 إلى 3 صور")}</span></legend>
    <div className={images.length ? "ad-studio-photo-row" : "ad-studio-photo-row is-empty"}>
      {images.map(image => <figure key={image.id}>
        <ReferencePhoto asset={image} />
        <AutomaticPhotoStatus asset={image} checksum={image.checksum} kind="product" failed={image.automaticSaveFailed} />
        <figcaption>
          <button type="button" onClick={() => props.onRemoveImage?.(image.id)} aria-label={t(`Remove ${image.name}`, `احذف ${image.name}`)}>×</button>
        </figcaption>
      </figure>)}
      {images.length < 3 && <AssetUpload role="subject" onFiles={props.onFiles} disabled={props.busy} className="ad-studio-photo-add"><ImagePlus aria-hidden="true" /><span>{t("Add photos", "أضف صوراً")}</span></AssetUpload>}
    </div>
    {missing && <p className="ad-studio-field-error">{t("Add at least one product photo.", "أضف صورة واحدة على الأقل للمنتج.")}</p>}
  </fieldset>;
}
