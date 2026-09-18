import { useId, useMemo } from "react";

import { isDurationSupported, snapDuration, useCapabilities } from "./useCapabilities";
import { useLanguage } from "@/i18n/LanguageContext";

export interface DurationSelectorProps {
  /** Current value (seconds). */
  value: number;
  /** Called when the user picks a new duration. */
  onChange: (next: number) => void;
  /** Used in the legend if a specific template is selected. */
  templateName?: string;
  /** Optional override; otherwise the live capabilities list is used. */
  defaultValue?: number;
}

function copy(arabic: boolean, english: string, arabicText: string) {
  return arabic ? arabicText : english;
}

export function DurationSelector({
  value,
  onChange,
  templateName,
  defaultValue,
}: DurationSelectorProps) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const capabilities = useCapabilities();
  const legendId = useId();
  const helperId = useId();

  const durations = useMemo(
    () => [...capabilities.active.durations].sort((a, b) => a - b),
    [capabilities.active.durations],
  );

  // Snap the incoming value into the supported list so the radios are always
  // in a valid state even if a project was loaded with a stale duration.
  const safeValue = isDurationSupported(capabilities, value) ? value : snapDuration(capabilities, value);
  const recommended = defaultValue ?? safeValue;

  return (
    <fieldset className="creator-duration-selector" aria-labelledby={legendId}>
      <legend id={legendId} className="creator-duration-selector-legend">
        <span className="creator-duration-selector-title">
          {copy(ar, "How long should the video be?", "كم مدة الفيديو؟")}
        </span>
        {templateName ? (
          <span className="creator-duration-selector-subtitle">
            {copy(ar, `For the ${templateName} template`, `لقالب ${templateName}`)}
          </span>
        ) : null}
      </legend>

      <div
        className="creator-duration-selector-grid"
        role="radiogroup"
        aria-describedby={helperId}
      >
        {durations.map((seconds) => {
          const inputId = `${legendId}-${seconds}`;
          const isChecked = seconds === safeValue;
          const isRecommended = seconds === recommended;
          return (
            <label
              key={seconds}
              htmlFor={inputId}
              className={`creator-duration-pill${isChecked ? " is-selected" : ""}${isRecommended ? " is-recommended" : ""}`}
            >
              <input
                id={inputId}
                type="radio"
                name="creator-duration"
                value={seconds}
                checked={isChecked}
                onChange={() => onChange(seconds)}
                className="sr-only"
              />
              <span className="creator-duration-pill-value" aria-hidden="true">{seconds}</span>
              <span className="creator-duration-pill-unit" aria-hidden="true">
                {copy(ar, "ثانية", "s")}
              </span>
              {isRecommended ? (
                <span className="creator-duration-pill-flag">
                  {copy(ar, "الموصى به", "Recommended")}
                </span>
              ) : null}
              <span className="sr-only">
                {copy(ar, `${seconds} ثانية`, `${seconds} seconds`)}
                {isRecommended ? copy(ar, " — الموصى به", " — recommended") : ""}
              </span>
            </label>
          );
        })}
      </div>

      <p id={helperId} className="creator-duration-selector-helper">
        {copy(
          ar,
          "Shorter renders are cheaper; longer renders add more scenes. Every value here is supported by the model on the right.",
          "الفيديوهات الأقصر أرخص، الأطول تضيف مشاهد أكثر. كل قيمة هنا يدعمها النموذج.",
        )}
        {" · "}
        <span className="creator-duration-selector-model">
          {capabilities.active.displayName}
        </span>
        {!capabilities.live ? (
          <>
            {" · "}
            <span className="creator-duration-selector-fallback" role="status">
              {copy(ar, "افتراضي: التحقق المباشر غير متاح", "Default list; live capability pending")}
            </span>
          </>
        ) : null}
      </p>
    </fieldset>
  );
}
