import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Film, Grid2X2, Play, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { isFeatureEnabled } from "@/config/features";
import { portableCreatorApi } from "@/lib/api/portableApiClient";
import { DISCOVERABLE_CREATOR_TEMPLATES } from "./templates";
import type { CreatorTemplate } from "./types";
import { creatorTemplateFromCatalog } from "./templateCatalogMapper";
import { templateGoalLabel } from "./templateMedia";
import { TemplatePreviewDialog } from "./TemplatePreviewDialog";
import { TemplateCardV2 } from "./TemplateCardV2";
import { useCapabilities } from "./useCapabilities";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TemplateDiscoveryCategory } from "@movprompt/contracts";

const CATEGORY_COPY = {
  electronics: { en: "Electronics", ar: "الإلكترونيات" },
  food: { en: "Food", ar: "الأطعمة" },
  ecommerce: { en: "Ecommerce", ar: "التجارة الإلكترونية" },
  advertising: { en: "Advertising", ar: "الإعلانات" },
  brand: { en: "Brand", ar: "العلامة" },
} as const;
const CATEGORY_ORDER = Object.keys(CATEGORY_COPY) as Array<keyof typeof CATEGORY_COPY>;

function categoryTitle(category: string, locale: "en" | "ar") {
  return CATEGORY_COPY[category as keyof typeof CATEGORY_COPY]?.[locale] ?? category;
}

function groupByCategory(templates: CreatorTemplate[]) {
  const groups = new Map<string, CreatorTemplate[]>();
  for (const template of templates) groups.set(template.discoveryCategory, [...(groups.get(template.discoveryCategory) ?? []), template]);
  return [...groups.entries()].sort(([left], [right]) => {
    const leftIndex = CATEGORY_ORDER.indexOf(left as keyof typeof CATEGORY_COPY);
    const rightIndex = CATEGORY_ORDER.indexOf(right as keyof typeof CATEGORY_COPY);
    return (leftIndex < 0 ? CATEGORY_ORDER.length : leftIndex) - (rightIndex < 0 ? CATEGORY_ORDER.length : rightIndex);
  });
}

export function TemplateGrid({
  selectedId,
  onSelect,
}: {
  selectedId?: string | null;
  onSelect: (templateId: string) => void;
}) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const [templates, setTemplates] = useState<CreatorTemplate[]>(DISCOVERABLE_CREATOR_TEMPLATES);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "fallback">(
    isFeatureEnabled("portableAuth") ? "loading" : "fallback",
  );
  const [query, setQuery] = useState("");
  const [discoveryCategory, setDiscoveryCategory] = useState<"all" | Exclude<TemplateDiscoveryCategory, "other">>("all");
  const [visibleCount, setVisibleCount] = useState(12);
  const [previewTemplate, setPreviewTemplate] = useState<CreatorTemplate | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredTemplates = templates.filter((template) => {
    const matchesCategory = discoveryCategory === "all" || template.discoveryCategory === discoveryCategory;
    const haystack = [template.name, template.nameAr, template.eyebrow, template.description, template.descriptionAr, template.bestFor, ...template.tags]
      .join(" ")
      .toLocaleLowerCase();
    return matchesCategory && (!normalizedQuery || haystack.includes(normalizedQuery));
  });
  const selectedTemplate = selectedId
    ? filteredTemplates.find((template) => template.id === selectedId) ?? null
    : null;
  const orderedTemplates = selectedTemplate
    ? [selectedTemplate, ...filteredTemplates.filter((template) => template.id !== selectedTemplate.id)]
    : filteredTemplates;
  const visibleLimit = Math.max(visibleCount, selectedTemplate ? 1 : 0);
  const visibleTemplates = orderedTemplates.slice(0, visibleLimit);
  const visibleGroups = groupByCategory(visibleTemplates);
  const selectionEnabled = catalogState !== "fallback" || !isFeatureEnabled("portableAuth");

  const loadPublishedCatalog = useCallback(() => {
    if (!isFeatureEnabled("portableAuth")) return;
    setCatalogState("loading");
    let active = true;
    void portableCreatorApi.listTemplates().then((published) => {
      if (!active || !published.length) {
        if (active) setCatalogState("fallback");
        return;
      }
      const merged = published
        .map(creatorTemplateFromCatalog)
        .filter((template) => Boolean(template.previewVideo) || template.id === "new-york-billboard-takeover");
      setTemplates(merged);
      setCatalogState("ready");
    }).catch(() => {
      if (active) setCatalogState("fallback");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => loadPublishedCatalog(), [loadPublishedCatalog]);

  useEffect(() => {
    if (selectedId && !templates.some((template) => template.id === selectedId)) {
      void portableCreatorApi.getTemplate(selectedId).then((published) => {
        const mapped = creatorTemplateFromCatalog(published);
        if (mapped.previewVideo || mapped.id === "new-york-billboard-takeover") {
          setTemplates((current) => [mapped, ...current]);
        }
      }).catch(() => undefined);
    }
  }, [selectedId, templates]);

  return (
    <>
      {catalogState === "loading" && <p className="creator-catalog-status" role="status">{ar ? "جاري تحميل القوالب المنشورة…" : "Loading published templates…"}</p>}
      {catalogState === "fallback" && isFeatureEnabled("portableAuth") && (
        <div className="creator-catalog-status" role="status">
          <span>{ar ? "معاينات القوالب المحلية متاحة للعرض فقط إلى أن يرجع كتالوج القوالب المنشورة." : "Local template previews are available to view only while the published catalog reconnects."}</span>
          <button type="button" className="creator-review-edit" onClick={loadPublishedCatalog}>{ar ? "أعد المحاولة" : "Retry catalog"}</button>
        </div>
      )}
      <div className="creator-template-discovery">
        <div className="creator-template-discovery-main">
          <label className="creator-template-search">
            <span className="sr-only">{ar ? "ابحث في قوالب الفيديو" : "Search video templates"}</span>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setVisibleCount(12); }}
              placeholder={ar ? "ابحث عن هدف أو فئة أو نوع فيديو" : "Search an outcome, category or format"}
            />
          </label>
          <p className="creator-template-count" aria-live="polite">
            {ar
              ? `نعرض ${visibleTemplates.length} من ${filteredTemplates.length} قالب`
              : `Showing ${visibleTemplates.length} of ${filteredTemplates.length}`}
          </p>
        </div>
        <div className="creator-template-filters" role="group" aria-label={ar ? "تصفية القوالب حسب الفئة" : "Filter templates by category"}>
          {([
            ["all", ar ? "الكل" : "All"],
            ["electronics", ar ? "الإلكترونيات" : "Electronics"],
            ["food", ar ? "الأطعمة" : "Food"],
            ["ecommerce", ar ? "التجارة الإلكترونية" : "Ecommerce"],
            ["advertising", ar ? "الإعلانات" : "Advertising"],
            ["brand", ar ? "العلامة" : "Brand"],
          ] as const).map(([value, label]) => {
            const available = value === "all" || templates.some((template) => template.discoveryCategory === value);
            return (
            <button
              key={value}
              type="button"
              className={cn("creator-template-filter", discoveryCategory === value && "is-active")}
              aria-pressed={discoveryCategory === value}
              disabled={!available}
              title={!available ? (ar ? "المعاينة قيد التجهيز" : "Preview is being prepared") : undefined}
              onClick={() => { setDiscoveryCategory(value); setVisibleCount(12); }}
            >
              {label}
            </button>
            );
          })}
        </div>
      </div>
      <div className="creator-template-groups" aria-busy={catalogState === "loading"} aria-live="polite">
        {discoveryCategory === "all" ? (
          <FlatTemplateGrid
            templates={visibleTemplates}
            selectedId={selectedId}
            onSelect={onSelect}
            onPreview={setPreviewTemplate}
            locale={locale}
            selectionEnabled={selectionEnabled}
          />
        ) : (
          visibleGroups.map(([category, groupTemplates]) => (
            <TemplateGroup
              key={category}
              id={category.replace(/\s+/g, "-")}
              title={categoryTitle(category, locale)}
              description={ar ? "اختر اتجاهًا ثابتًا، ثم أضف صورتك. قد تختلف التفاصيل البصرية في كل نتيجة مولّدة." : "Choose a fixed direction, then add your image. Visual details may vary in each generated result."}
              icon="direction"
              templates={groupTemplates}
              selectedId={selectedId}
              onSelect={onSelect}
              onPreview={setPreviewTemplate}
              locale={locale}
              selectionEnabled={selectionEnabled}
            />
          ))
        )}
      </div>
      {selectionEnabled && selectedId && filteredTemplates.some((template) => template.id === selectedId) && (
        <div className="creator-template-continue">
          <button type="button" className="creator-button creator-button-primary" onClick={() => onSelect(selectedId)}>
            {ar ? "المتابعة بالقالب المحدد" : "Continue with selected template"}
            <ArrowUpRight aria-hidden="true" />
          </button>
        </div>
      )}
      {visibleTemplates.length < filteredTemplates.length && (
        <div className="creator-template-more">
          <button type="button" className="creator-button creator-button-secondary" onClick={() => setVisibleCount((count) => count + 12)}>
            {ar ? `عرض المزيد (${filteredTemplates.length - visibleTemplates.length})` : `Show more (${filteredTemplates.length - visibleTemplates.length})`}
          </button>
        </div>
      )}
      {!filteredTemplates.length && (
        <div className="creator-template-empty" role="status">
          <strong>{ar ? "ما لقينا قالب مطابق" : "No matching templates"}</strong>
          <span>{ar ? "جرّب بحث أوسع أو اختر فئة ثانية." : "Try a broader search or choose another category."}</span>
          <button type="button" className="creator-button creator-button-secondary" onClick={() => { setQuery(""); setDiscoveryCategory("all"); setVisibleCount(12); }}>
            {ar ? "مسح التصفية" : "Clear filters"}
          </button>
        </div>
      )}
      <TemplatePreviewDialog template={previewTemplate} locale={locale} onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }} />
    </>
  );
}

function TemplateGroup({
  id,
  title,
  description,
  icon,
  templates,
  selectedId,
  onSelect,
  onPreview,
  locale,
  selectionEnabled,
}: {
  id: string;
  title: string;
  description: string;
  icon: "preview" | "direction";
  templates: CreatorTemplate[];
  selectedId?: string | null;
  onSelect: (templateId: string) => void;
  onPreview: (template: CreatorTemplate) => void;
  locale: "en" | "ar";
  selectionEnabled: boolean;
}) {
  if (!templates.length) return null;
  const headingId = `creator-template-group-${id}`;
  return (
    <section className="creator-template-group" aria-labelledby={headingId}>
      <div className="creator-template-group-heading">
        <span className="creator-template-group-icon" aria-hidden="true">
          {icon === "preview" ? <Film /> : <Grid2X2 />}
        </span>
        <div>
          <h2 id={headingId}>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="creator-template-group-count">
          {locale === "ar" ? `${templates.length} قالب` : `${templates.length} ${templates.length === 1 ? "template" : "templates"}`}
        </span>
      </div>
      <div className="creator-template-flat-grid">
        {templates.map((template) => (
          <BentoCard
            key={template.id}
            template={template}
            isFeatured={false}
            isSelected={selectedId === template.id}
            isReady={Boolean(template.previewVideo)}
            isSelectionDisabled={!selectionEnabled}
            onSelect={(t) => onSelect(t.id)}
            onPreview={onPreview}
            locale={locale}
          />
        ))}
      </div>
    </section>
  );
}

function TemplateCard({ template, selected, onSelect, onPreview, locale, selectionEnabled }: { template: CreatorTemplate; selected: boolean; onSelect: (templateId: string) => void; onPreview: (template: CreatorTemplate) => void; locale: "en" | "ar"; selectionEnabled: boolean; }) {
  const ar = locale === "ar";
  const goal = template.goals[0] ?? "launch";
  return (
      <article className={cn("creator-template-card", selected && "is-selected")}>
        <button
          type="button"
          className="creator-template-select"
          onClick={() => onSelect(template.id)}
          disabled={!selectionEnabled}
          aria-pressed={selected}
          aria-label={selectionEnabled ? (ar ? `اختر قالب ${template.nameAr}` : `Choose ${template.name} template`) : (ar ? `معاينة قالب ${template.nameAr} فقط` : `${template.name} template preview only`)}
        >
          <div className="creator-template-media" data-media-tone={template.mediaTone}>
            {template.poster ? <img src={template.poster} alt="" loading="lazy" style={{ objectPosition: template.posterPosition }} /> : <span className="creator-template-placeholder" aria-hidden="true" />}
            <span className="creator-template-direction" aria-hidden="true"><b>{template.mediaCode}</b><span>{templateGoalLabel(goal, locale)}</span></span>
            <span className="creator-template-media-kind">{template.previewVideo ? (ar ? "معاينة حركة" : "Motion preview") : (ar ? "معاينة الفيديو قريباً" : "Video preview coming later")}</span>
            {template.previewVideo ? <span className="creator-template-duration">{template.duration}s</span> : null}
          </div>
          <div className="creator-template-copy">
            <span className="creator-template-eyebrow">{categoryTitle(template.discoveryCategory, locale)}</span>
            <h3>{locale === "ar" ? template.nameAr : template.name}</h3>
            <p>{locale === "ar" ? template.descriptionAr : template.description}</p>
            <div className="creator-template-meta">
              <span><strong>{ar ? `${template.scenes.length} مشاهد` : `${template.scenes.length} scenes`}</strong> · {ar ? "كويتي + إنجليزي" : "Kuwaiti Arabic + English"}</span>
              <span className="creator-template-state">
                {selected
                  ? (ar ? "محدد" : "Selected")
                  : selectionEnabled
                    ? (ar ? "اختر" : "Choose")
                    : (ar ? "للمعاينة" : "Preview only")}
                {selected ? <Check aria-hidden="true" /> : <ArrowUpRight aria-hidden="true" />}
              </span>
            </div>
          </div>
        </button>
        {template.previewVideo ? (
          <button
            className="creator-template-preview-link"
            type="button"
            onClick={() => onPreview(template)}
            aria-label={ar ? `شغّل معاينة قالب ${template.nameAr}` : `Play ${template.name} preview`}
          >
            <Play aria-hidden="true" />
            <span>{ar ? "معاينة النتيجة" : "Preview output"}</span>
          </button>
        ) : (
          <Link
            className="creator-template-preview-link"
            to={`/templates/${encodeURIComponent(template.id)}`}
            aria-label={ar ? `شاهد تفاصيل قالب ${template.nameAr}` : `View ${template.name} details`}
          >
            <ArrowUpRight aria-hidden="true" />
            <span>{ar ? "شاهد الاتجاه" : "View direction"}</span>
          </Link>
        )}
      </article>
  );
}

function BentoCard({
  template,
  isFeatured,
  isSelected,
  isReady,
  isSelectionDisabled,
  onSelect,
  onPreview,
  locale,
}: {
  template: CreatorTemplate;
  isFeatured: boolean;
  isSelected: boolean;
  isReady: boolean;
  isSelectionDisabled: boolean;
  onSelect: (template: CreatorTemplate) => void;
  onPreview: (template: CreatorTemplate) => void;
  locale: "en" | "ar";
}) {
  const capabilities = useCapabilities();
  return (
    <div className={isFeatured ? "creator-bento-featured" : undefined}>
      <TemplateCardV2
        template={template}
        isSelected={isSelected}
        isFeatured={isFeatured}
        isReady={isReady}
        isSelectionDisabled={isSelectionDisabled}
        onSelect={onSelect}
        onPreview={onPreview}
        categoryLabel={categoryTitle(template.discoveryCategory, locale)}
        modelLabel={capabilities.active.displayName}
      />
    </div>
  );
}

function FlatTemplateGrid({
  templates,
  selectedId,
  onSelect,
  onPreview,
  locale,
  selectionEnabled,
}: {
  templates: CreatorTemplate[];
  selectedId: string | null | undefined;
  onSelect: (templateId: string) => void;
  onPreview: (template: CreatorTemplate) => void;
  locale: "en" | "ar";
  selectionEnabled: boolean;
}) {
  if (!templates.length) return null;
  return (
    <div className="creator-template-flat-grid" data-flat="all">
      {templates.map((template) => (
        <BentoCard
          key={template.id}
          template={template}
          isFeatured={false}
          isSelected={selectedId === template.id}
          isReady={Boolean(template.previewVideo)}
          isSelectionDisabled={!selectionEnabled}
          onSelect={(t) => onSelect(t.id)}
          onPreview={onPreview}
          locale={locale}
        />
      ))}
    </div>
  );
}
