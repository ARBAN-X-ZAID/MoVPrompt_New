import { ArrowUpRight, Clock, Sparkles } from "lucide-react";

import type { CreatorTemplate } from "./types";
import { useLanguage } from "@/i18n/LanguageContext";

export interface TemplateCardV2Props {
  template: CreatorTemplate;
  isSelected: boolean;
  isFeatured?: boolean;
  isReady?: boolean;
  isSelectionDisabled?: boolean;
  onSelect: (template: CreatorTemplate) => void;
  onPreview?: (template: CreatorTemplate) => void;
  categoryLabel: string;
  modelLabel: string;
}

export function TemplateCardV2({
  template,
  isSelected,
  isFeatured = false,
  isReady = true,
  isSelectionDisabled = false,
  onSelect,
  onPreview,
  categoryLabel,
  modelLabel,
}: TemplateCardV2Props) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const title = ar ? template.nameAr : template.name;
  const description = ar ? template.descriptionAr : template.description;

  const classes = [
    "creator-template-card-v2",
    isSelected ? "is-selected" : "",
    isFeatured ? "is-featured" : "",
    isReady ? "is-ready" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={classes}
      data-template-id={template.id}
      data-preview-src={template.previewVideo ?? undefined}
      data-testid={`v2-${template.id}`}
      data-template-selected={isSelected ? "true" : "false"}
      aria-label={title}
    >
      <div className="creator-template-media">
        <img
          src={template.poster}
          alt={title}
          loading={isFeatured ? "eager" : "lazy"}
          decoding="async"
        />
        <span className="creator-template-eyebrow" aria-hidden="true">
          {categoryLabel}
        </span>
        <span className="creator-template-chip-row">
          <span className="creator-template-chip" title={ar ? "مدة الفيديو" : "Video duration"}>
            <Clock aria-hidden="true" />
            {template.duration}{ar ? "ث" : "s"}
          </span>
          <span className="creator-template-chip" title={ar ? "النموذج" : "Model"}>
            <Sparkles aria-hidden="true" />
            {modelLabel}
          </span>
        </span>
      </div>

      <div className="creator-template-body">
        <span className="creator-template-cat" aria-hidden="true">{categoryLabel}</span>
        <h3 className="creator-template-title">{title}</h3>
        <p className="creator-template-desc">{description}</p>

        <div className="creator-template-actions">
          <span className="creator-template-status">
            <span className="creator-template-status-dot" aria-hidden="true" />
            {isReady
              ? ar ? "جاهز" : "Ready"
              : ar ? "قريباً" : "Coming soon"}
          </span>
          <button
            type="button"
            className="creator-template-cta"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(template);
            }}
            aria-label={ar ? `اختر قالب ${title}` : `Choose ${title} template`}
            disabled={isSelectionDisabled}
          >
            {ar ? "اختر هذا القالب" : "Choose template"}
            <ArrowUpRight aria-hidden="true" />
          </button>
          {onPreview ? (
            <button
              type="button"
              className="creator-template-cta"
              onClick={(event) => {
                event.stopPropagation();
                onPreview(template);
              }}
              aria-label={ar ? `معاينة ${title}` : `Play ${title} preview`}
            >
              {ar ? "معاينة" : "Preview"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
