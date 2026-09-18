import { RefreshCw } from "lucide-react";
import type { GenerationConfiguration } from "@movprompt/contracts";

import { cn } from "@/lib/utils";
import { useTemplateQuotes } from "./useTemplateQuotes";
import type { PresenterCompatibility } from "./PresenterChoice";
import {
  recommendTemplates,
  type RecommendationSelection,
  type TemplateRecommendation,
  type TemplateRecommendationInput,
} from "./templateRecommendations";
import type { CreatorTemplate } from "./types";

type TemplateRecommendationsProps = TemplateRecommendationInput & {
  templates: CreatorTemplate[];
  configurationForTemplate: (template: CreatorTemplate) => GenerationConfiguration;
  onSelect: (selection: RecommendationSelection) => void;
  /** Test seam only; production always consumes the server-backed quote hook. */
  quoteStateForTemplate?: (template: CreatorTemplate, configuration: GenerationConfiguration) => ReturnType<typeof useTemplateQuotes>;
  /** Server-projected availability only. The default is deliberately fail-closed. */
  presenterCompatibility?: PresenterCompatibility;
  arabic?: boolean;
  hidePricing?: boolean;
};

export function TemplateRecommendations({
  templates,
  configurationForTemplate,
  onSelect,
  quoteStateForTemplate,
  presenterCompatibility = { aiUgc: false, uploadedSpokesperson: false },
  arabic = false,
  hidePricing = false,
  ...input
}: TemplateRecommendationsProps) {
  const recommendations = recommendTemplates(templates, input);
  const heading = arabic ? "قوالب مقترحة" : "Recommended templates";

  if (!recommendations.length) {
    return (
      <section className="creator-recommendation-empty" aria-labelledby="recommendation-empty-heading" role="status">
        <h2 id="recommendation-empty-heading">{arabic ? "لا يوجد قالب مناسب لهذا الإعداد بعد" : "No template fits this setup yet"}</h2>
        <p>{arabic ? "أضف التفاصيل المطلوبة أو اختر نتيجة حملة مختلفة. تفاصيلك محفوظة." : "Add the missing input or choose a different campaign result. Your details are saved."}</p>
      </section>
    );
  }

  return (
    <section className="creator-recommendations" aria-labelledby="recommendation-heading" aria-live="polite">
      <div className="creator-recommendations-head">
        <div>
          <p className="creator-kicker">{arabic ? "اختيار مناسب" : "A suitable next step"}</p>
          <h2 id="recommendation-heading">{heading}</h2>
        </div>
        <span>{arabic ? `${recommendations.length} خيارات` : `${recommendations.length} ${recommendations.length === 1 ? "option" : "options"}`}</span>
      </div>
      <div className="creator-recommendation-grid">
        {recommendations.map((recommendation) => (
          <RecommendationCard
            key={recommendation.template.id}
            recommendation={recommendation}
            configuration={configurationForTemplate(recommendation.template)}
            onSelect={onSelect}
            quoteStateForTemplate={quoteStateForTemplate}
            presenterCompatibility={presenterCompatibility}
            arabic={arabic}
            hidePricing={hidePricing}
          />
        ))}
      </div>
    </section>
  );
}

function RecommendationCard({
  recommendation,
  configuration,
  onSelect,
  quoteStateForTemplate,
  presenterCompatibility,
  arabic,
  hidePricing,
}: {
  recommendation: TemplateRecommendation;
  configuration: GenerationConfiguration;
  onSelect: (selection: RecommendationSelection) => void;
  quoteStateForTemplate?: (template: CreatorTemplate, configuration: GenerationConfiguration) => ReturnType<typeof useTemplateQuotes>;
  presenterCompatibility: PresenterCompatibility;
  arabic: boolean;
  hidePricing: boolean;
}) {
  const { template, whyThisFits, requiredInputs } = recommendation;
  const liveQuoteState = useTemplateQuotes({ enabled: true, templateId: template.id, configuration });
  const quoteState = quoteStateForTemplate?.(template, configuration) ?? liveQuoteState;
  const quoteReady = quoteState.status === "ready" && Boolean(quoteState.quote);
  const buttonLabel = arabic ? "استخدم هذا القالب" : "Use this template";
  const quoteLabel = quoteState.status === "ready"
    ? (quoteState.quote?.entitlementEligible ? (arabic ? "مشمول لهذا الفيديو" : "Included for this video") : (arabic ? "السعر المؤكد جاهز" : "Confirmed price"))
    : quoteState.status === "loading" || quoteState.status === "idle"
      ? (arabic ? "جارٍ تأكيد السعر…" : "Confirming current price…")
      : quoteState.status === "expired"
        ? (arabic ? "انتهت صلاحية السعر" : "Price expired")
        : quoteState.status === "changed"
          ? (arabic ? "تم تحديث السعر" : "Price updated")
          : (arabic ? "تعذر تأكيد السعر" : "Price unavailable");
  const recoveryLabel = quoteState.status === "changed"
    ? (arabic ? "راجع السعر الجديد" : "Review new price")
    : (arabic ? "أعد محاولة السعر" : "Retry price");
  const presenterAvailability = presenterCompatibility.aiUgc
    ? (arabic ? "مقدّم محتوى UGC متاح" : "AI UGC presenter available")
    : presenterCompatibility.uploadedSpokesperson
      ? (arabic ? "متحدث مرفوع متاح مع فيديو موثّق" : "Uploaded spokesperson available with verified footage")
      : (arabic ? "لا يوجد مقدّم متاح لهذه الحملة" : "No presenter available for this campaign");

  return (
    <article className={cn("creator-recommendation-card", quoteReady && "is-ready")} aria-label={arabic ? `قالب ${template.nameAr}` : `${template.name} template`}>
      <div className="creator-recommendation-media" data-preview-type={template.previewVideo ? "motion" : "direction"}>
        {template.poster ? <img src={template.poster} alt="" /> : <span className="creator-template-placeholder" aria-hidden="true" />}
        <span>{template.previewVideo ? (arabic ? "معاينة حركة" : "Motion preview") : (arabic ? "اتجاه ثابت" : "Static direction")}</span>
      </div>
      <div className="creator-recommendation-copy">
        <p className="creator-template-eyebrow">{template.eyebrow}</p>
        <h3>{arabic ? template.nameAr : template.name}</h3>
        <p>{arabic ? template.descriptionAr : template.description}</p>
        <dl>
          <div><dt>{arabic ? "لماذا يناسب" : "Why this fits"}</dt><dd>{whyThisFits}</dd></div>
          <div><dt>{arabic ? "المطلوب" : "Required"}</dt><dd>{requiredInputs.join(" · ")}</dd></div>
          <div><dt>{arabic ? "المدة والمقاسات" : "Duration and formats"}</dt><dd>{template.duration}s · {template.aspectRatios.join(" · ")}</dd></div>
          <div><dt>{arabic ? "مقدّم الفيديو" : "Presenter"}</dt><dd>{presenterAvailability}</dd></div>
        </dl>
      </div>
      {!hidePricing && <div className="creator-recommendation-quote" data-quote-state={quoteState.status}>
        <span>{quoteLabel}</span>
        {quoteReady && quoteState.quote ? <strong>{quoteState.quote.entitlementEligible ? (arabic ? "0 رصيد" : "0 credits") : (arabic ? `${quoteState.quote.credits} رصيد` : `${quoteState.quote.credits} credits`)}</strong> : null}
        {!quoteReady && quoteState.status !== "loading" && quoteState.status !== "idle" ? (
          <button className="creator-button creator-button-secondary" type="button" onClick={quoteState.retry}>
            <RefreshCw aria-hidden="true" /> {recoveryLabel}
          </button>
        ) : null}
        {quoteState.requestId ? <details className="creator-support-details"><summary>{arabic ? "تفاصيل الدعم" : "Support details"}</summary><code>{quoteState.requestId}</code></details> : null}
      </div>}
      <button
        className="creator-button creator-button-primary creator-recommendation-select"
        type="button"
        aria-describedby={!quoteReady ? `quote-${template.id}` : undefined}
        onClick={() => {
          onSelect({ template, quote: quoteState.quote, configuration });
        }}
      >
        {buttonLabel}
      </button>
      {!quoteReady ? <p id={`quote-${template.id}`} className="sr-only">{quoteLabel}</p> : null}
    </article>
  );
}
