import { useState } from "react";
import { ArrowUpRight, Check, Clock, Play } from "lucide-react";

import { templateLengths } from "./templates";
import type { CreatorTemplate } from "./types";
import { preloadedTemplatePreview } from "./templatePreviewPreload";
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
}

function canHoverPreview() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches
    && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
}: TemplateCardV2Props) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const title = ar ? template.nameAr : template.name;
  const description = ar ? template.descriptionAr : template.description;
  const [hovering, setHovering] = useState(false);
  const previewSrc = template.previewVideo ? preloadedTemplatePreview(template.previewVideo) ?? template.previewVideo : null;

  const classes = [
    "creator-template-card-v2",
    isSelected ? "is-selected" : "",
    isFeatured ? "is-featured" : "",
    isReady ? "is-ready" : "",
    hovering && previewSrc ? "is-previewing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const lengths = templateLengths(template);
  const startPreview = () => { if (previewSrc && canHoverPreview()) setHovering(true); };
  const stopPreview = () => setHovering(false);

  return (
    <article
      className={classes}
      data-template-id={template.id}
      data-preview-src={template.previewVideo ?? undefined}
      data-testid={`v2-${template.id}`}
      data-template-selected={isSelected ? "true" : "false"}
      aria-label={title}
      onPointerEnter={startPreview}
      onPointerLeave={stopPreview}
      onFocus={startPreview}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) stopPreview(); }}
    >
      <div className="creator-template-media">
        <img
          src={template.poster}
          alt=""
          loading={isFeatured ? "eager" : "lazy"}
          decoding="async"
          style={{ objectPosition: template.posterPosition }}
          onError={(event) => { event.currentTarget.hidden = true; }}
        />
        {hovering && previewSrc ? (
          <video
            className="creator-template-hover-video"
            src={previewSrc}
            poster={template.poster}
            muted
            loop
            autoPlay
            playsInline
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
          />
        ) : null}
        <span className="creator-template-badges" aria-hidden="true">
          {template.previewVideo ? <span className="creator-template-badge"><Play />{ar ? "معاينة حركة" : "Motion preview"}</span> : null}
          {isSelected ? <span className="creator-template-badge is-selected"><Check />{ar ? "محدد" : "Selected"}</span> : null}
        </span>
        <span className="creator-template-length" aria-label={ar ? `${lengths.join("، ")} ثانية` : `${lengths.join(", ")} seconds`}>
          <Clock aria-hidden="true" />
          {lengths.join(" · ")}{ar ? "ث" : "s"}
        </span>
      </div>

      <div className="creator-template-body">
        <p className="creator-template-cat">{categoryLabel}</p>
        <h3 className="creator-template-title">{title}</h3>
        <p className="creator-template-desc">{description}</p>
        {!isReady ? <p className="creator-template-status">{ar ? "قريباً" : "Coming soon"}</p> : null}

        <div className="creator-template-actions">
          <button
            type="button"
            className="creator-template-cta creator-template-choose"
            onClick={(event) => {
              event.stopPropagation();
              onSelect(template);
            }}
            aria-label={ar ? `اختر قالب ${title}` : `Choose ${title} template`}
            aria-pressed={isSelected}
            disabled={isSelectionDisabled}
          >
            {isSelected ? (ar ? "محدد" : "Selected") : (ar ? "اختر القالب" : "Choose template")}
            <ArrowUpRight aria-hidden="true" />
          </button>
          {onPreview ? (
            <button
              type="button"
              className="creator-template-cta creator-template-preview"
              onClick={(event) => {
                event.stopPropagation();
                onPreview(template);
              }}
              aria-label={template.previewVideo
                ? ar ? `معاينة ${title}` : `Play ${title} preview`
                : ar ? `شاهد اتجاه ${title}` : `View ${title} direction`}
            >
              <Play aria-hidden="true" />
              {template.previewVideo ? ar ? "معاينة" : "Preview" : ar ? "الاتجاه" : "Direction"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
