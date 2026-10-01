import { ArrowLeft, Clock3, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { useId, type RefObject } from "react";

import { LAUNCH_PHOTO_POLICIES, SELECTABLE_TEMPLATE_DURATIONS } from "@movprompt/creative-engine";
import { templatePhotoIssues } from "@movprompt/contracts";
import { TemplatePhotos, type TemplatePhotoActions } from "./TemplatePhotos";
import { cn } from "@/lib/utils";

import { useCapabilities } from "./useCapabilities";
import { templateCampaignOptions } from "./templateCampaignOptions";

import type { TemplateQuote, TemplateQuoteFailure } from "./templateQuoteState";
import { hasCreatorImageReference, templateRequiresSourceMedia } from "./templates";
import { getCampaignGoalOption, type CreatorAspectRatio, type CreatorProject, type CreatorTemplate } from "./types";

type CreateScreenQuoteState = "ready" | "loading" | "unavailable" | "expired" | "changed";

type CreateScreenProps = TemplatePhotoActions & {
  project: CreatorProject;
  template: CreatorTemplate;
  durationSeconds: number;
  linkUrl: string;
  busy?: boolean;
  error?: string;
  generationError?: string;
  arabic?: boolean;
  hidePricing?: boolean;
  quote: TemplateQuote | null;
  quoteState: CreateScreenQuoteState;
  quoteError?: string;
  quoteFailure?: TemplateQuoteFailure | null;
  generateButtonRef?: RefObject<HTMLButtonElement | null>;
  onRemoveImage?: (imageId: string) => void;
  onMakeOpeningImage?: (imageId: string) => void;
  onLinkChange: (value: string) => void;
  onImportLink: () => void;
  onCancelImport: () => void;
  onDurationChange: (seconds: number) => void;
  onAspectRatioChange?: (ratio: CreatorAspectRatio) => void;
  onNameChange?: (value: string) => void;
  onMessageChange: (value: string) => void;
  onActionChange?: (value: string) => void;
  onChangeTemplate: () => void;
  onRetryQuote?: () => void;
  onGenerate: () => void;
};

function copy(arabic: boolean, english: string, arabicText: string) {
  return arabic ? arabicText : english;
}

/** Arabic counts 3–10 with the plural "ثوانٍ" and 11 upwards with "ثانية". */
function arabicSeconds(seconds: number) {
  return seconds <= 10 ? `${seconds} ثوانٍ` : `${seconds} ثانية`;
}

/**
 * The whole campaign on one screen: media, length, a few optional lines,
 * the price and Generate. An empty line stays out of the video.
 */
export function CreateScreen({
  project,
  template,
  durationSeconds,
  linkUrl,
  busy = false,
  error,
  generationError,
  arabic = false,
  hidePricing = false,
  quote,
  quoteState,
  quoteError,
  quoteFailure,
  generateButtonRef,
  onFiles,
  onPhotoChange,
  onMovePhoto,
  onRemoveImage,
  onLinkChange,
  onImportLink,
  onCancelImport,
  onDurationChange,
  onAspectRatioChange = () => undefined,
  onNameChange = () => undefined,
  onMessageChange,
  onActionChange = () => undefined,
  onChangeTemplate,
  onRetryQuote,
  onGenerate,
}: CreateScreenProps) {
  const nameId = useId();
  const messageId = useId();
  const actionId = useId();
  const generationErrorId = useId();
  const templateAction = getCampaignGoalOption(project.goal).defaultCta;
  const actionValue = project.cta === templateAction ? "" : project.cta;
  const images = project.product.images;
  const selected = images.filter(image => image.selected !== false);
  const mediaMissing = templateRequiresSourceMedia(project.templateId) && !hasCreatorImageReference(selected);
  const policy = LAUNCH_PHOTO_POLICIES[project.templateId];
  const photoIssues = policy ? templatePhotoIssues(policy, selected) : [];
  const templateName = arabic ? template.nameAr : template.name;
  const capabilities = useCapabilities();
  const durationChoices = SELECTABLE_TEMPLATE_DURATIONS;
  const unavailable = !capabilities.templateReady || !capabilities.active.durations.includes(durationSeconds);
  const canGenerate = !busy && !mediaMissing && photoIssues.length === 0 && !unavailable && (hidePricing ? quoteState === "ready" : Boolean(quote));
  const generationFeedback = generationError ||
    (mediaMissing ? copy(arabic, "Add one photo of what you are promoting to continue.", "أضف صورة واحدة لما تروّج له للمتابعة.") : "") ||
    (photoIssues.includes("subject_photos_required") ? copy(arabic, "Add a product photo in Product photos to continue.", "أضف صورة للمنتج في قسم صور المنتج للمتابعة.") : "") ||
    (photoIssues.includes("character_rights_required") ? copy(arabic, "Confirm permission below each selected character photo to continue.", "أكّد إذن الاستخدام أسفل كل صورة شخصية محددة للمتابعة.") : "") ||
    (photoIssues.length ? copy(arabic, "Check the photo counts, types and character permissions. Unselect extra photos to continue; they stay saved.", "راجع عدد الصور وأنواعها وأذونات الشخصية. ألغِ تحديد الصور الزائدة للمتابعة؛ تبقى محفوظة.") : "") ||
    (["unavailable", "expired"].includes(quoteState) ? quoteError : "") ||
    (unavailable ? copy(arabic, "This template is temporarily unavailable at the selected length. Your duration and photos have not changed.", "هذا القالب غير متاح مؤقتاً بالمدة المحددة. لم تتغير مدتك أو صورك.") : "");

  return (
    <section className="creator-create-screen" dir={arabic ? "rtl" : undefined} aria-labelledby="create-screen-heading">
      <div className="creator-create-layout">
      <aside className="creator-create-panel">
        <button className="creator-template-back" type="button" onClick={onChangeTemplate}>
          <ArrowLeft aria-hidden="true" />
          {copy(arabic, "Change template", "غيّر القالب")}
        </button>
        <div className="creator-create-identity">
          <div className="creator-create-cover">
            {template.poster
              ? <img className="creator-create-poster" src={template.poster} alt="" style={{ objectPosition: template.posterPosition }} onError={event => { event.currentTarget.style.visibility = "hidden"; }} />
              : <span className="creator-create-poster" aria-hidden="true" />}
          </div>
          <div>
            <p className="creator-kicker">{templateName}</p>
            <h1 id="create-screen-heading">{copy(arabic, "Make your video", "سوِّ فيديوك")}</h1>
            <p className="creator-create-lead">{copy(arabic, "Leave a box empty and it stays out of the video.", "إذا تركت خانة فاضية، ما تنذكر في الفيديو.")}</p>
          </div>
        </div>
        <div className="creator-create-sheet">
        <div className="creator-create-sheet-body">
        <div className="creator-create-fields">
          <div className="creator-create-field">
            <label htmlFor={nameId}>{copy(arabic, "What is it called?", "وش اسمه؟")}</label>
            <input
              id={nameId}
              className="creator-input"
              value={project.product.name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder={copy(arabic, "Product or business name", "اسم المنتج أو النشاط")}
              autoComplete="off"
            />
          </div>
          <div className="creator-create-field">
            <label htmlFor={messageId}>{copy(arabic, "Anything to say in the video?", "في شي تبي يذكره الفيديو؟")}</label>
            <input
              id={messageId}
              className="creator-input"
              value={project.offer}
              onChange={(event) => onMessageChange(event.target.value)}
              placeholder={copy(arabic, "For example, 20% off", "مثلاً خصم 20%")}
              autoComplete="off"
            />
          </div>
          <div className="creator-create-field">
            <label htmlFor={actionId}>{copy(arabic, "What should the viewer do?", "وش يسوي المشاهد؟")}</label>
            <input
              id={actionId}
              className="creator-input"
              value={actionValue}
              onChange={(event) => onActionChange(event.target.value)}
              placeholder={copy(arabic, "For example, Order now", "مثلاً اطلب الحين")}
              autoComplete="off"
            />
          </div>
        </div>
        <div className="creator-create-actions">
          <div className="creator-cost-box" aria-live="polite">
            {hidePricing ? (
              quoteState === "unavailable" || quoteState === "expired" ? (
                <>
                  <small>{copy(arabic, "Preview", "معاينة")}</small>
                  <strong>{copy(arabic, "The video could not be prepared yet.", "تعذر تجهيز الفيديو الآن.")}</strong>
                  {onRetryQuote && quoteFailure?.retryable && <button className="creator-cost-retry" type="button" onClick={onRetryQuote}><RefreshCw aria-hidden="true" /> {copy(arabic, "Try again", "حاول مرة ثانية")}</button>}
                </>
              ) : quoteState === "ready" ? (
                <><small>{copy(arabic, "Preview", "معاينة")}</small><strong>{copy(arabic, "No credits are charged for this video", "ما ينخصم رصيد لهذا الفيديو")}</strong></>
              ) : (
                <><small>{copy(arabic, "Preview", "معاينة")}</small><strong>{copy(arabic, "Preparing your video…", "جارٍ تجهيز فيديوك…")}</strong></>
              )
            ) : quote ? (
              <>
                <small>{quote.entitlementEligible ? copy(arabic, "Your first video", "فيديوك الأول") : copy(arabic, "Confirmed price", "السعر المؤكد")}</small>
                <strong>{quote.entitlementEligible ? copy(arabic, "Included, 0 credits", "مشمول، 0 رصيد") : copy(arabic, `${quote.credits} credits`, `${quote.credits} رصيد`)}</strong>
              </>
            ) : (
              <>
                <small>{copy(arabic, "Price", "السعر")}</small>
                <strong>{copy(arabic, "Confirming the current price…", "جارٍ تأكيد السعر الحالي…")}</strong>
                {onRetryQuote && quoteFailure?.retryable && <button className="creator-cost-retry" type="button" onClick={onRetryQuote}><RefreshCw aria-hidden="true" /> {copy(arabic, "Retry price", "أعد محاولة السعر")}</button>}
              </>
            )}
            <span className="creator-cost-meta"><Clock3 aria-hidden="true" /> {copy(arabic, `${durationSeconds} seconds. Ready in about 2-5 minutes.`, `${arabicSeconds(durationSeconds)}. جاهز خلال 2-5 دقائق.`)}</span>
          </div>
          <button
            ref={generateButtonRef}
            className="creator-button creator-button-primary creator-create-generate"
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate}
            aria-describedby={generationFeedback ? generationErrorId : undefined}
          >
            <Sparkles aria-hidden="true" /> {copy(arabic, "Generate video", "ولّد الفيديو")}
          </button>
          {generationFeedback && <p id={generationErrorId} className="creator-field-error" role="alert">{generationFeedback}</p>}
          <p className="creator-field-help">{copy(arabic, "By generating you confirm you own or have permission to use this media.", "بتوليدك للفيديو تؤكد أنك تملك حق استخدام هذه الوسائط.")}</p>
        </div>
        </div>
        </div>
      </aside>
      <div className="creator-create-stage">
        <TemplatePhotos templateId={project.templateId} images={images} arabic={arabic} busy={busy} onFiles={onFiles} onPhotoChange={onPhotoChange} onMovePhoto={onMovePhoto} onRemoveImage={onRemoveImage} />
        <div className="creator-create-length">
          <h2 id="create-length-heading">{copy(arabic, "How long should it be?", "كم تبي مدته؟")}</h2>
          <div className="creator-choice-grid" role="radiogroup" aria-labelledby="create-length-heading" style={{ gridTemplateColumns: `repeat(${durationChoices.length}, minmax(0, 1fr))` }}>
            {durationChoices.map((seconds) => (
              <button
                key={seconds}
                type="button"
                role="radio"
                aria-checked={durationSeconds === seconds}
                className={cn("creator-choice", durationSeconds === seconds && "is-selected")}
                onClick={() => onDurationChange(seconds)}
              >
                {copy(arabic, `${seconds} seconds`, arabicSeconds(seconds))}
              </button>
            ))}
          </div>
        </div>
        <div className="creator-create-shape">
          <h2 id="create-shape-heading">{copy(arabic, "What shape should it be?", "أي مقاس تبيه؟")}</h2>
          <div className="creator-choice-grid" role="radiogroup" aria-labelledby="create-shape-heading" style={{ gridTemplateColumns: `repeat(${templateCampaignOptions(template).ratios.length}, minmax(0, 1fr))` }}>
            {templateCampaignOptions(template).ratios.map((ratio) => (
              <button
                key={ratio}
                type="button"
                role="radio"
                aria-checked={project.aspectRatio === ratio}
                className={cn("creator-choice", project.aspectRatio === ratio && "is-selected")}
                onClick={() => onAspectRatioChange(ratio)}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>
        <div className="creator-create-link">
          <label htmlFor="create-link">{copy(arabic, "Or paste a product or business link", "أو الصق رابط منتج أو نشاط")}</label>
          <div className="creator-input-row">
            <input
              id="create-link"
              className="creator-input"
              value={linkUrl}
              onChange={(event) => onLinkChange(event.target.value)}
              placeholder="https://yourstore.com/product"
              inputMode="url"
              autoComplete="url"
              disabled={busy}
            />
            {busy ? (
              <button className="creator-button creator-button-secondary" type="button" onClick={onCancelImport}><X aria-hidden="true" /> {copy(arabic, "Cancel check", "إلغاء الفحص")}</button>
            ) : (
              <button className="creator-button creator-button-secondary" type="button" onClick={onImportLink}>{copy(arabic, "Check link", "افحص الرابط")}</button>
            )}
          </div>
        </div>
        {busy && <p className="creator-source-status" role="status"><Loader2 className="animate-spin" aria-hidden="true" /> {copy(arabic, "Checking the link…", "جارٍ فحص الرابط…")}</p>}
        {error && <p className="creator-error" role="alert">{error}</p>}
      </div>
      </div>
    </section>
  );
}
