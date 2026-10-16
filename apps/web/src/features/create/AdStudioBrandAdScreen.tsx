import { useId, useState, type ReactNode } from "react";
import { AlignLeft, AtSign, BadgeDollarSign, ImagePlus, Link2, Sparkles, Users, Video } from "lucide-react";
import {
  AD_STUDIO_BRAND_AD_DURATIONS,
  AD_STUDIO_BRAND_AD_LIMITS,
  AD_STUDIO_BRAND_AD_RATIOS,
  AdStudioBrandAdSettingsSchema,
  missingAdStudioBrandAdFields,
  templatePhotoIssues,
  type AdStudioBrandAdSettings,
} from "@movprompt/contracts";
import { LAUNCH_PHOTO_POLICIES } from "@movprompt/creative-engine";
import type { CreateScreenProps } from "./CreateScreen";
import type { CreatorProject } from "./types";
import { useCapabilities } from "./useCapabilities";
import { brandAdSettingsForProject } from "./adStudioBrandAdProject";
import "./ad-studio.css";

export type AdStudioBrandAdScreenProps = CreateScreenProps & {
  signedIn: boolean;
  /** Shown after a guest returns from sign-in with the saved form. */
  resumeNotice?: boolean;
  onBrandAdSettingsChange: (settings: AdStudioBrandAdSettings) => void;
  onProjectSettingsChange: (changes: Partial<Pick<CreatorProject, "resolution" | "audio">>) => void;
  onLanguageChange: (language: CreatorProject["language"]) => void;
};

type TextKey = keyof typeof AD_STUDIO_BRAND_AD_LIMITS;
type Copy = { label: [string, string]; placeholder: [string, string]; hint: [string, string] };

const FIELDS: Record<TextKey, Copy> = {
  brandName: { label: ["Brand name", "اسم العلامة"], placeholder: ["e.g. Oud Al Layl", "مثال: عود الليل"], hint: ["Spoken in the video and shown on the ending card.", "يُذكر في الفيديو ويظهر في بطاقة الختام."] },
  website: { label: ["Website", "الموقع الإلكتروني"], placeholder: ["www.yourbrand.com", "www.yourbrand.com"], hint: ["Shown on the ending card only.", "يظهر في بطاقة الختام فقط."] },
  sellingPoints: { label: ["Selling points", "نقاط البيع"], placeholder: ["e.g. Free delivery in Kuwait, lasts 12 hours", "مثال: توصيل مجاني في الكويت، يدوم 12 ساعة"], hint: ["The main reasons to buy. Used word for word in the voiceover.", "أهم أسباب الشراء. تُستخدم كما هي في التعليق الصوتي."] },
  aesthetics: { label: ["Aesthetics", "الطابع البصري"], placeholder: ["e.g. Dark, luxury, warm gold light", "مثال: داكن، فاخر، إضاءة ذهبية دافئة"], hint: ["Look and feel: colors, lighting, mood.", "الشكل والإحساس: الألوان والإضاءة والأجواء."] },
  audience: { label: ["Audience", "الجمهور"], placeholder: ["e.g. Women 25 to 40 in Kuwait", "مثال: نساء من 25 إلى 40 في الكويت"], hint: ["Who the ad is for. Sets the presenter, tone, setting and music.", "لمن الإعلان. يحدد الشخصية والنبرة والمكان والموسيقى."] },
  description: { label: ["Description", "الوصف"], placeholder: ["e.g. Handmade oud perfumes made in Kuwait", "مثال: عطور عود مصنوعة يدوياً في الكويت"], hint: ["What you sell and what makes it different. We never change these facts.", "ماذا تبيع وما الذي يميزك. لا نغيّر هذه المعلومات أبداً."] },
  socials: { label: ["Socials", "حسابات التواصل"], placeholder: ["instagram.com/yourbrand", "instagram.com/yourbrand"], hint: ["Shown on the ending card only.", "تظهر في بطاقة الختام فقط."] },
  videoIdea: { label: ["What should happen in the video?", "ماذا يحدث في الفيديو؟"], placeholder: ["e.g. A woman sprays the perfume on her wrist, smiles and says it lasts 12 hours.", "مثال: امرأة ترش العطر على معصمها وتبتسم وتقول إنه يدوم 12 ساعة."], hint: ["Describe the scene, the action and what is said. No on-screen text is needed; we add your brand at the end.", "صف المشهد والحركة وما يُقال. لا حاجة لكتابة نص على الشاشة، نضيف علامتك في النهاية."] },
};

const RATIO_LABELS: Record<(typeof AD_STUDIO_BRAND_AD_RATIOS)[number], [string, string]> = {
  "9:16": ["Vertical", "عمودي"],
  "1:1": ["Square", "مربع"],
  "4:5": ["Portrait", "طولي"],
  "16:9": ["Wide", "عريض"],
};

export function AdStudioBrandAdScreen(props: AdStudioBrandAdScreenProps) {
  const { project, arabic = false } = props;
  const id = useId();
  const t = (en: string, ar: string) => arabic ? ar : en;
  const pick = (pair: [string, string]) => arabic ? pair[1] : pair[0];
  const value = brandAdSettingsForProject(project);
  const [attempted, setAttempted] = useState(false);
  const capabilities = useCapabilities();
  const selected = project.product.images.filter(photo => photo.selected !== false && (photo.referenceRole ?? "subject") === "subject");
  const logo = value.logoChecksum ? project.product.images.find(photo => photo.referenceRole === "artwork" && photo.checksum === value.logoChecksum) : undefined;
  const photoIssues = templatePhotoIssues(LAUNCH_PHOTO_POLICIES[project.templateId]!, project.product.images.filter(photo => photo.selected !== false));
  const missing = missingAdStudioBrandAdFields(value);
  const websiteInvalid = !AdStudioBrandAdSettingsSchema.shape.website.safeParse(value.website).success;
  const invalid = missing.length > 0 || photoIssues.length > 0 || websiteInvalid;
  const unavailable = !capabilities.templateReady || !capabilities.active.durations.includes(props.durationSeconds);
  const issues = [
    ...(selected.length ? [] : [t("Add at least one product photo.", "أضف صورة واحدة على الأقل للمنتج.")]),
    ...missing.map(key => key === "videoIdea"
      ? t("Describe what should happen in the video.", "صف ما يحدث في الفيديو.")
      : t(`Fill in ${FIELDS[key].label[0].toLowerCase()}.`, `أكمل حقل ${FIELDS[key].label[1]}.`)),
    ...(websiteInvalid ? [t("Enter a website such as www.yourbrand.com, or leave it empty.", "أدخل موقعاً مثل www.yourbrand.com أو اتركه فارغاً.")] : []),
  ];
  const serverFeedback = props.generationError || props.error || (invalid ? "" : props.quoteError) || (unavailable ? t("Generation is temporarily unavailable. Your form is saved.", "التوليد غير متاح مؤقتاً. نموذجك محفوظ.") : "");
  const update = (patch: Partial<AdStudioBrandAdSettings>) => props.onBrandAdSettingsChange({ ...value, ...patch });
  const showIssue = (key: TextKey) => attempted && (key === "website" ? websiteInvalid : (missing as string[]).includes(key));

  const field = (key: TextKey, options: { multiline?: boolean; optional?: boolean; icon?: ReactNode; rows?: number } = {}) => {
    const copy = FIELDS[key];
    const fieldId = `${id}-${key}`;
    const length = Array.from(value[key]).length;
    const describedBy = `${fieldId}-hint ${fieldId}-count`;
    const common = {
      id: fieldId,
      value: value[key],
      maxLength: AD_STUDIO_BRAND_AD_LIMITS[key],
      placeholder: pick(copy.placeholder),
      "aria-describedby": describedBy,
      "aria-invalid": showIssue(key) || undefined,
      required: !options.optional,
      dir: "auto" as const,
      onChange: (event: { target: { value: string } }) => update({ [key]: event.target.value } as Partial<AdStudioBrandAdSettings>),
    };
    return <div className="ad-studio-field">
      <label htmlFor={fieldId} className="ad-studio-label">
        {options.icon && <span className="ad-studio-icon" aria-hidden="true">{options.icon}</span>}
        <span>{pick(copy.label)}</span>
        <span className={options.optional ? "ad-studio-optional" : "ad-studio-required"}>{options.optional ? t("Optional", "اختياري") : t("Required", "مطلوب")}</span>
      </label>
      {options.multiline ? <textarea {...common} rows={options.rows ?? 3} /> : <input {...common} type="text" />}
      <div className="ad-studio-help">
        <small id={`${fieldId}-hint`}>{pick(copy.hint)}</small>
        <small id={`${fieldId}-count`} className="ad-studio-count" aria-label={t(`${length} of ${AD_STUDIO_BRAND_AD_LIMITS[key]} characters`, `${length} من ${AD_STUDIO_BRAND_AD_LIMITS[key]} حرفاً`)}>{length}/{AD_STUDIO_BRAND_AD_LIMITS[key]}</small>
      </div>
    </div>;
  };

  const choice = <T extends string | number>(name: string, legend: string, options: ReadonlyArray<readonly [T, string]>, current: T, onPick: (next: T) => void) =>
    <fieldset className="ad-studio-choice">
      <legend>{legend} <span className="ad-studio-required">{t("Required", "مطلوب")}</span></legend>
      <div className="ad-studio-options">{options.map(([option, label]) => <label key={String(option)} className="ad-studio-option">
        <input type="radio" name={`${id}-${name}`} checked={current === option} onChange={() => onPick(option)} />
        <span>{label}</span>
      </label>)}</div>
    </fieldset>;

  return <section className="ad-studio" dir={arabic ? "rtl" : "ltr"} aria-labelledby={`${id}-heading`}>
    <header className="ad-studio-header">
      <p className="ad-studio-eyebrow">{t("Ad Studio", "استوديو الإعلانات")}</p>
      <h1 id={`${id}-heading`}>{t("Create your brand kit", "أنشئ هوية علامتك")}</h1>
      <p>{t("Everything here shapes your ad. Fill in the required fields, describe your video, then generate.", "كل ما هنا يشكّل إعلانك. أكمل الحقول المطلوبة وصف الفيديو ثم ابدأ الإنشاء.")}</p>
    </header>

    {props.resumeNotice && <p className="ad-studio-notice" role="status">{t("You're signed in. Press Generate to start.", "تم تسجيل الدخول. اضغط إنشاء للبدء.")}</p>}

    <div className="ad-studio-bento">
      <section className="ad-studio-card ad-studio-brand" aria-label={t("Brand", "العلامة")}>
        <div className="ad-studio-brand-fields">
          {field("brandName")}
          {field("website", { optional: true, icon: <Link2 size={16} /> })}
        </div>
        <div className="ad-studio-logo">
          <span className="ad-studio-label"><span>{t("Logo", "الشعار")}</span><span className="ad-studio-optional">{t("Optional", "اختياري")}</span></span>
          <label className="ad-studio-logo-drop" htmlFor={`${id}-logo`}>
            {logo ? <img src={logo.url} alt={t("Your logo", "شعارك")} /> : <ImagePlus aria-hidden="true" />}
            <input id={`${id}-logo`} type="file" accept="image/jpeg,image/png,image/webp" aria-describedby={`${id}-logo-hint`} disabled={props.busy}
              onChange={event => { const files = Array.from(event.target.files ?? []); if (files.length) props.onFiles(files, "artwork", true); event.target.value = ""; }} />
            <span>{logo ? t("Replace logo", "استبدل الشعار") : t("Choose logo", "اختر الشعار")}</span>
          </label>
          <small id={`${id}-logo-hint`}>{t("Added to the ending card. The video itself never redraws your logo.", "يُضاف إلى بطاقة الختام. الفيديو نفسه لا يعيد رسم شعارك.")}</small>
          {logo && <button type="button" className="ad-studio-link" onClick={() => update({ logoChecksum: undefined })}>{t("Remove logo", "إزالة الشعار")}</button>}
        </div>
        <ProductPhotos props={props} id={`${id}-photos`} missing={attempted && !selected.length} />
      </section>

      <section className="ad-studio-card ad-studio-wide">{field("sellingPoints", { multiline: true, rows: 2, icon: <BadgeDollarSign size={18} /> })}</section>
      <section className="ad-studio-card">{field("aesthetics", { multiline: true, rows: 3, icon: <Sparkles size={18} /> })}</section>
      <section className="ad-studio-card">{field("audience", { multiline: true, rows: 3, icon: <Users size={18} /> })}</section>
      <section className="ad-studio-card ad-studio-wide">{field("description", { multiline: true, rows: 3, icon: <AlignLeft size={18} /> })}</section>
      <section className="ad-studio-card ad-studio-wide">{field("socials", { optional: true, icon: <AtSign size={18} /> })}</section>
    </div>

    <section className="ad-studio-card ad-studio-video" aria-labelledby={`${id}-video-heading`}>
      <h2 id={`${id}-video-heading`}><Video size={20} aria-hidden="true" /> {t("Your video", "الفيديو")}</h2>
      {field("videoIdea", { multiline: true, rows: 5 })}
      <div className="ad-studio-choices">
        {choice("duration", t("Length", "المدة"), AD_STUDIO_BRAND_AD_DURATIONS.map(seconds => [seconds, t(`${seconds} seconds`, `${seconds} ثانية`)] as const), props.durationSeconds as (typeof AD_STUDIO_BRAND_AD_DURATIONS)[number], seconds => props.onDurationChange(seconds))}
        {choice("ratio", t("Shape", "الشكل"), AD_STUDIO_BRAND_AD_RATIOS.map(ratio => [ratio, `${ratio} · ${pick(RATIO_LABELS[ratio])}`] as const), project.aspectRatio as (typeof AD_STUDIO_BRAND_AD_RATIOS)[number], ratio => props.onAspectRatioChange?.(ratio))}
        {choice("resolution", t("Resolution", "الدقة"), [["480p", t("480p · faster, lower cost", "480p · أسرع وأقل تكلفة")], ["720p", t("720p · sharper", "720p · أوضح")]] as const, project.resolution, resolution => props.onProjectSettingsChange({ resolution }))}
        {choice("language", t("Language", "اللغة"), [["ar", "العربية"], ["en", "English"], ["bilingual", "English + العربية"]] as const, project.language, language => props.onLanguageChange(language))}
      </div>
      <label className="ad-studio-toggle">
        <input type="checkbox" role="switch" checked={project.audio} onChange={event => props.onProjectSettingsChange({ audio: event.target.checked })} aria-labelledby={`${id}-sound-label`} aria-describedby={`${id}-sound-hint`} />
        <span id={`${id}-sound-label`}>{t("Voice and music", "الصوت والموسيقى")}</span>
        <small id={`${id}-sound-hint`}>{project.audio ? t("On: the video can speak and has background music.", "مفعّل: يمكن أن يتحدث الفيديو مع موسيقى خلفية.") : t("Off: a silent video.", "متوقف: فيديو صامت.")}</small>
      </label>
    </section>

    <footer className="ad-studio-footer">
      {!props.hidePricing && props.quote && !invalid && <p className="ad-studio-price">{props.quote.credits} {t("credits", "رصيد")}</p>}
      <button ref={props.generateButtonRef} type="button" className="creator-button creator-button-primary ad-studio-generate"
        aria-describedby={issues.length || serverFeedback ? `${id}-feedback` : undefined}
        disabled={Boolean(props.busy) || unavailable || (!invalid && (props.quoteState !== "ready" || (!props.hidePricing && !props.quote)))}
        aria-disabled={invalid || undefined}
        onClick={() => { setAttempted(true); if (!invalid) props.onGenerate(); }}>
        {t("Generate", "إنشاء")}
      </button>
      {(attempted && issues.length > 0) || serverFeedback ? <div id={`${id}-feedback`} className="ad-studio-feedback" role={attempted || props.generationError || props.error ? "alert" : "status"}>
        {attempted && issues.length > 0 && <ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
        {serverFeedback && <p>{serverFeedback}</p>}
      </div> : !attempted && invalid ? <p id={`${id}-feedback`} className="ad-studio-pending">{t(`${issues.length} required ${issues.length === 1 ? "item" : "items"} left`, `متبقٍ ${issues.length} من العناصر المطلوبة`)}</p> : null}
      {props.onRetryQuote && !invalid && <button className="creator-button creator-button-quiet" type="button" onClick={props.onRetryQuote}>{t("Refresh generation check", "تحديث فحص التوليد")}</button>}
    </footer>
  </section>;
}

function ProductPhotos({ props, id, missing }: { props: AdStudioBrandAdScreenProps; id: string; missing: boolean }) {
  const t = (en: string, ar: string) => props.arabic ? ar : en;
  const images = props.project.product.images.filter(image => (image.referenceRole ?? "subject") === "subject");
  const selectedCount = images.filter(image => image.selected !== false).length;
  return <fieldset className="ad-studio-photos" aria-invalid={missing || undefined}>
    <legend className="ad-studio-label"><span>{t("Product photos", "صور المنتج")}</span><span className="ad-studio-required">{t("Required · 1 to 3", "مطلوب · من 1 إلى 3")}</span></legend>
    <div className="ad-studio-photo-row">
      {images.map(image => <figure key={image.id} className={image.selected === false ? "is-unselected" : undefined}>
        <img src={image.url} alt={image.name} />
        <figcaption>
          <label><input type="checkbox" checked={image.selected !== false} onChange={event => props.onPhotoChange?.(image.id, { selected: event.target.checked })} />{t("Use", "استخدم")}</label>
          <button type="button" onClick={() => props.onRemoveImage?.(image.id)} aria-label={t(`Remove ${image.name}`, `احذف ${image.name}`)}>×</button>
        </figcaption>
      </figure>)}
      {selectedCount < 3 && <label className="ad-studio-photo-add" htmlFor={id}>
        <input id={id} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={props.busy} aria-describedby={`${id}-hint`}
          onChange={event => { const files = Array.from(event.target.files ?? []); if (files.length) props.onFiles(files, "subject", false); event.target.value = ""; }} />
        <ImagePlus aria-hidden="true" />
        <span>{t("Add photos", "أضف صوراً")}</span>
      </label>}
    </div>
    <small id={`${id}-hint`}>{t("Clear photos of the real product. The video keeps its shape, label and color.", "صور واضحة للمنتج الحقيقي. يحافظ الفيديو على شكله وملصقه ولونه.")}</small>
  </fieldset>;
}
