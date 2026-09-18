import { useId, useRef, type KeyboardEvent, type MutableRefObject } from "react";
import { FileUp, Globe2, Link2, Loader2, PencilLine, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { templateRequiresSourceMedia } from "./templates";

export type SourceChoice = "product_link" | "business_link" | "upload" | "manual";
export type SourceSubject = "product" | "service";

type SourceChoiceStepProps = {
  value: SourceChoice;
  subject: SourceSubject;
  url: string;
  busy?: boolean;
  error?: string;
  arabic?: boolean;
  /** When set, the manual option is disabled for templates that require a primary reference image. */
  templateId?: string | null;
  onChoiceChange: (choice: SourceChoice) => void;
  onSubjectChange: (subject: SourceSubject) => void;
  onUrlChange: (value: string) => void;
  onImport: () => void;
  onCancel: () => void;
  onFiles: (files: FileList | null) => void;
  onManualStart: () => void;
  onRetry?: () => void;
  retryLabel?: string;
  onBack?: () => void;
};

const SOURCE_CHOICES: Array<{
  value: SourceChoice;
  icon: typeof Link2;
  label: string;
  labelAr: string;
  description: string;
  descriptionAr: string;
}> = [
  {
    value: "product_link",
    icon: Link2,
    label: "Product link",
    labelAr: "رابط منتج",
    description: "Bring back product facts and photos to check.",
    descriptionAr: "نسترجع معلومات المنتج وصوره لتراجعها.",
  },
  {
    value: "business_link",
    icon: Globe2,
    label: "Business or service link",
    labelAr: "رابط نشاط أو خدمة",
    description: "Check the details for your location, service, or booking.",
    descriptionAr: "راجع تفاصيل موقعك أو خدمتك أو حجزك.",
  },
  {
    value: "upload",
    icon: FileUp,
    label: "Upload photos or footage",
    labelAr: "ارفع صوراً أو فيديو",
    description: "Use the real media you already have.",
    descriptionAr: "استخدم الوسائط الحقيقية الموجودة عندك.",
  },
  {
    value: "manual",
    icon: PencilLine,
    label: "Enter details manually",
    labelAr: "أدخل التفاصيل بنفسك",
    description: "Start with the facts you want to use.",
    descriptionAr: "ابدأ بالمعلومات التي تريد استخدامها.",
  },
];

function text(arabic: boolean, english: string, arabicText: string) {
  return arabic ? arabicText : english;
}

function localizeSourceError(error: string | undefined, arabic: boolean): string | undefined {
  if (!error) return error;
  const knownMessages: Array<{ en: string; ar: string }> = [
    {
      en: "Enter a complete product link beginning with http:// or https://.",
      ar: "أدخل رابطاً كاملاً للمنتج.",
    },
    {
      en: "Enter a complete business or service link beginning with http:// or https://.",
      ar: "أدخل رابطاً كاملاً للنشاط أو الخدمة.",
    },
  ];
  const known = knownMessages.find((message) => error === message.en || error === message.ar);
  return known ? known[arabic ? "ar" : "en"] : error;
}

function selectWithRadioKeys<T extends string>(
  event: KeyboardEvent<HTMLButtonElement>,
  values: readonly T[],
  current: T,
  refs: MutableRefObject<Array<HTMLButtonElement | null>>,
  onChange: (value: T) => void,
) {
  const currentIndex = values.indexOf(current);
  let nextIndex: number | null = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % values.length;
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + values.length) % values.length;
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = values.length - 1;
  if (nextIndex === null) return;
  event.preventDefault();
  const next = values[nextIndex]!;
  onChange(next);
  refs.current[nextIndex]?.focus();
}

/**
 * A controlled source entry surface. It has no persistence or network logic;
 * CreateStudio owns scanning, guest drafts, aborts, and recovery.
 */
export function SourceChoiceStep({
  value,
  subject,
  url,
  busy = false,
  error,
  arabic = false,
  templateId,
  onChoiceChange,
  onSubjectChange,
  onUrlChange,
  onImport,
  onCancel,
  onFiles,
  onManualStart,
  onRetry,
  retryLabel,
  onBack,
}: SourceChoiceStepProps) {
  const sourceChoiceRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const subjectRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const manualDisabled = templateId != null && templateRequiresSourceMedia(templateId);
  const isLink = value === "product_link" || value === "business_link";
  const linkLabel = value === "business_link"
    ? text(arabic, "Business or service link", "رابط النشاط أو الخدمة")
    : text(arabic, "Product link", "رابط المنتج");
  const linkHelp = value === "business_link"
    ? text(arabic, "We’ll bring back public business details for you to review. Add your booking details next.", "سنسترجع معلومات النشاط العامة لتراجعها. أضف تفاصيل الحجز بعدها.")
    : text(arabic, "We’ll bring back public product facts and photos for you to review.", "سنسترجع معلومات المنتج وصوره لتراجعها.");
  const statusId = "source-choice-status";
  const linkHelpId = useId();
  const linkErrorId = useId();
  const errorText = localizeSourceError(error, arabic);

  return (
    <section className="creator-source-choice" aria-labelledby="source-choice-heading" dir={arabic ? "rtl" : undefined}>
      <div className="creator-source-choice-heading">
        <p className="creator-kicker">{text(arabic, "Campaign source", "مصدر الحملة")}</p>
        <h2 id="source-choice-heading">{text(arabic, "What are you promoting?", "شنو تبي تروّج له؟")}</h2>
        <p>{text(arabic, "Choose one starting point. You’ll review every fact before it is used.", "اختر نقطة بداية واحدة. راح تراجع كل معلومة قبل استخدامها.")}</p>
      </div>

      <fieldset className="creator-source-choice-group">
        <legend className="sr-only">{text(arabic, "Choose a campaign source", "اختر مصدر الحملة")}</legend>
        <div className="creator-source-choice-grid" role="radiogroup" aria-label={text(arabic, "Choose a campaign source", "اختر مصدر الحملة")}>
          {SOURCE_CHOICES.map((choice) => {
            const Icon = choice.icon;
            const selected = value === choice.value;
            const isManualChoice = choice.value === "manual";
            const disabled = isManualChoice && manualDisabled;
            return (
              <button
                key={choice.value}
                ref={(node) => { sourceChoiceRefs.current[SOURCE_CHOICES.indexOf(choice)] = node; }}
                className={cn("creator-source-choice-card", selected && "is-selected", disabled && "is-disabled")}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-disabled={disabled || undefined}
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  if (disabled) return;
                  onChoiceChange(choice.value);
                }}
                onKeyDown={(event) => {
                  if (disabled) return;
                  selectWithRadioKeys(event, SOURCE_CHOICES.map((item) => item.value), value, sourceChoiceRefs, onChoiceChange);
                }}
              >
                <span className="creator-source-choice-icon"><Icon aria-hidden="true" /></span>
                <span className="creator-source-choice-copy">
                  <strong>{text(arabic, choice.label, choice.labelAr)}</strong>
                  <span>{text(arabic, choice.description, choice.descriptionAr)}</span>
                  {disabled && (
                    <small className="creator-source-choice-note">
                      {text(
                        arabic,
                        "Not available for this template — the model needs a real photo to use.",
                        "غير متاح لهذا القالب — يحتاج النموذج صورة حقيقية.",
                      )}
                    </small>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {(value === "upload" || value === "manual") && (
        <fieldset className="creator-source-subject-group">
          <legend>{text(arabic, "What are these for?", "هذه خاصة بماذا؟")}</legend>
          <div className="creator-source-subject-options" role="radiogroup" aria-label={text(arabic, "What are these for?", "هذه خاصة بماذا؟")}>
            {([
              ["product", text(arabic, "A product", "منتج")],
              ["service", text(arabic, "A business or service", "نشاط أو خدمة")],
            ] as const).map(([nextSubject, label], index, subjects) => (
              <button
                key={nextSubject}
                ref={(node) => { subjectRefs.current[index] = node; }}
                className={cn("creator-source-subject-option", subject === nextSubject && "is-selected")}
                type="button"
                role="radio"
                aria-checked={subject === nextSubject}
                tabIndex={subject === nextSubject ? 0 : -1}
                onClick={() => onSubjectChange(nextSubject)}
                onKeyDown={(event) => selectWithRadioKeys(event, subjects.map(([option]) => option), subject, subjectRefs, onSubjectChange)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {isLink && (
        <div className="creator-source-entry">
          <label htmlFor="source-url">{linkLabel}</label>
          <div className="creator-input-row">
            <input
              id="source-url"
              className="creator-input"
              value={url}
              onChange={(event) => onUrlChange(event.target.value)}
              placeholder={value === "business_link" ? "https://yourbusiness.com" : "https://yourstore.com/product"}
              inputMode="url"
              disabled={busy}
              aria-invalid={Boolean(errorText)}
              aria-describedby={[linkHelpId, errorText ? linkErrorId : null].filter(Boolean).join(" ")}
            />
            {busy ? (
              <button className="creator-button creator-button-secondary" type="button" onClick={onCancel}>
                <X aria-hidden="true" />
                {text(arabic, "Cancel check", "إلغاء الفحص")}
              </button>
            ) : (
              <button className="creator-button creator-button-primary" type="button" onClick={onImport}>
                {text(arabic, "Check link", "افحص الرابط")}
              </button>
            )}
          </div>
          <p id={linkHelpId} className="creator-field-help">{linkHelp}</p>
        </div>
      )}

      {value === "upload" && (
        <div className="creator-upload-zone creator-source-upload-zone">
          <label htmlFor="campaign-source-files">
            <span className="creator-upload-icon"><FileUp aria-hidden="true" /></span>
            <strong>{text(arabic, "Choose photos or footage", "اختر صوراً أو فيديو")}</strong>
            <span>{text(arabic, "JPG, PNG, WebP, MP4 or MOV · up to 5 files", "JPG أو PNG أو WebP أو MP4 أو MOV · حتى 5 ملفات")}</span>
          </label>
          <input id="campaign-source-files" aria-label={text(arabic, "Choose photos or footage", "اختر صوراً أو فيديو")} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" multiple onChange={(event) => onFiles(event.target.files)} />
        </div>
      )}

      {value === "manual" && (
        <div className="creator-source-manual">
          <p>{text(arabic, "Start with the facts you know. You can add media later without losing these details.", "ابدأ بالمعلومات التي تعرفها. تقدر تضيف الوسائط لاحقاً بدون ما تفقد هذه التفاصيل.")}</p>
          <button className="creator-button creator-button-primary" type="button" onClick={onManualStart}>
            {text(arabic, "Enter details", "أدخل التفاصيل")}
          </button>
        </div>
      )}

      {busy && (
        <p id={statusId} className="creator-source-status" role="status">
          <Loader2 className="animate-spin" aria-hidden="true" />
          {text(arabic, "Checking the link…", "جارٍ فحص الرابط…")}
        </p>
      )}
      {errorText && (
        <div className="creator-source-recovery" aria-labelledby={linkErrorId}>
          <p id={linkErrorId} className="creator-error" role="alert">{errorText}</p>
          {onRetry && (
            <button className="creator-button creator-button-secondary" type="button" onClick={onRetry}>
              {retryLabel ?? (value === "upload"
                ? text(arabic, "Choose another file", "اختر ملفاً آخر")
                : text(arabic, "Try another link", "حاول رابطاً آخر"))}
            </button>
          )}
        </div>
      )}
      {onBack && <button className="creator-button creator-button-quiet" type="button" onClick={onBack}>{text(arabic, "Back", "رجوع")}</button>}
    </section>
  );
}
