import { useCallback, useEffect, useRef, useState } from "react";
import { templateSection, type TemplateSection } from "./templatePlacement";
import { ArrowUpRight, Grid2X2, SearchX, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isFeatureEnabled } from "@/config/features";
import { portableCreatorApi } from "@/lib/api/portableApiClient";
import { DISCOVERABLE_CREATOR_TEMPLATES, isDiscoverableCreatorTemplate } from "./templates";
import type { CreatorTemplate } from "./types";
import { creatorTemplateFromCatalog } from "./templateCatalogMapper";
import { preloadTemplatePreview } from "./templatePreviewPreload";
import { TemplatePreviewDialog } from "./TemplatePreviewDialog";
import { TemplateCardV2 } from "./TemplateCardV2";
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
const INITIAL_VISIBLE_COUNT = DISCOVERABLE_CREATOR_TEMPLATES.length;

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
  section = "templates",
}: {
  selectedId?: string | null;
  onSelect: (templateId: string) => void;
  section?: TemplateSection;
}) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const catalogEnabled = isFeatureEnabled("portableAuth");
  const [templates, setTemplates] = useState<CreatorTemplate[]>(() => catalogEnabled ? [] : DISCOVERABLE_CREATOR_TEMPLATES);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "fallback">(
    catalogEnabled ? "loading" : "fallback",
  );
  const [query, setQuery] = useState("");
  const [discoveryCategory, setDiscoveryCategory] = useState<"all" | Exclude<TemplateDiscoveryCategory, "other">>("all");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [previewTemplate, setPreviewTemplate] = useState<CreatorTemplate | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const sectionTemplates = templates.filter((template) => templateSection(template.id) === section);
  const filteredTemplates = sectionTemplates.filter((template) => {
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
        if (active) {
          setTemplates(DISCOVERABLE_CREATOR_TEMPLATES);
          setCatalogState("fallback");
        }
        return;
      }
      const merged = published
        .map(creatorTemplateFromCatalog)
        .filter(isDiscoverableCreatorTemplate);
      setTemplates(merged);
      setCatalogState("ready");
    }).catch(() => {
      if (active) {
        setTemplates(DISCOVERABLE_CREATOR_TEMPLATES);
        setCatalogState("fallback");
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => loadPublishedCatalog(), [loadPublishedCatalog]);

  useEffect(() => {
    const root = gridRef.current;
    if (!root || catalogState === "loading" || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        preloadTemplatePreview((entry.target as HTMLElement).dataset.previewSrc);
      }
    }, { rootMargin: "200px" });
    for (const card of root.querySelectorAll<HTMLElement>("[data-preview-src]")) observer.observe(card);
    return () => observer.disconnect();
  }, [catalogState, visibleTemplates]);

  useEffect(() => {
    if (selectedId && !templates.some((template) => template.id === selectedId)) {
      void portableCreatorApi.getTemplate(selectedId).then((published) => {
        const mapped = creatorTemplateFromCatalog(published);
        if (isDiscoverableCreatorTemplate(mapped)) {
          setTemplates((current) => [mapped, ...current]);
        }
      }).catch(() => undefined);
    }
  }, [selectedId, templates]);

  const clearFilters = () => { setQuery(""); setDiscoveryCategory("all"); setVisibleCount(INITIAL_VISIBLE_COUNT); };
  const categoryCount = (value: string) => value === "all"
    ? sectionTemplates.length
    : sectionTemplates.filter((template) => template.discoveryCategory === value).length;

  return (
    <>
      {catalogState === "loading" && (
        <>
          <p className="creator-catalog-status is-quiet" role="status">{ar ? "جاري تحميل القوالب المنشورة…" : "Loading published templates…"}</p>
          <div className="creator-template-flat-grid" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="creator-template-skeleton">
                <span className="creator-skeleton-block is-media" />
                <span className="creator-skeleton-block is-line is-short" />
                <span className="creator-skeleton-block is-line" />
                <span className="creator-skeleton-block is-line is-mid" />
              </div>
            ))}
          </div>
        </>
      )}
      {catalogState === "loading" ? null : <>
      <div className="creator-template-discovery">
        <div className="creator-template-discovery-main">
          <label className="creator-template-search">
            <span className="sr-only">{section === "ad-studio" ? (ar ? "ابحث في الإعلانات" : "Search ads") : (ar ? "ابحث في قوالب الفيديو" : "Search video templates")}</span>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setVisibleCount(INITIAL_VISIBLE_COUNT); }}
              placeholder={ar ? "ابحث عن هدف أو فئة أو نوع فيديو" : "Search an outcome, category or format"}
            />
            {query ? (
              <button type="button" className="creator-template-search-clear" onClick={() => { setQuery(""); setVisibleCount(INITIAL_VISIBLE_COUNT); }} aria-label={ar ? "امسح البحث" : "Clear search"}>
                <X aria-hidden="true" />
              </button>
            ) : null}
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
            const count = categoryCount(value);
            const available = value === "all" || count > 0;
            return (
            <button
              key={value}
              type="button"
              className={cn("creator-template-filter", discoveryCategory === value && "is-active")}
              aria-pressed={discoveryCategory === value}
              disabled={!available}
              title={!available ? (ar ? "المعاينة قيد التجهيز" : "Preview is being prepared") : undefined}
              onClick={() => { setDiscoveryCategory(value); setVisibleCount(INITIAL_VISIBLE_COUNT); }}
            >
              {label}
              <span className="creator-template-filter-count" aria-hidden="true">{count}</span>
            </button>
            );
          })}
        </div>
      </div>
      <div ref={gridRef} className="creator-template-groups" aria-live="polite">
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
          <span className="creator-template-empty-icon" aria-hidden="true"><SearchX /></span>
          <strong>{ar ? "ما لقينا قالب مطابق" : "No matching templates"}</strong>
          <span>{ar ? "جرّب بحث أوسع أو اختر فئة ثانية." : "Try a broader search or choose another category."}</span>
          <button type="button" className="creator-button creator-button-secondary" onClick={clearFilters}>
            {ar ? "مسح التصفية" : "Clear filters"}
          </button>
        </div>
      )}
      </>}
      <TemplatePreviewDialog template={previewTemplate} locale={locale} selectionEnabled={selectionEnabled} onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }} />
    </>
  );
}

function TemplateGroup({
  id,
  title,
  description,
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
          <Grid2X2 />
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
            isReady={isDiscoverableCreatorTemplate(template)}
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
          isReady={isDiscoverableCreatorTemplate(template)}
          isSelectionDisabled={!selectionEnabled}
          onSelect={(t) => onSelect(t.id)}
          onPreview={onPreview}
          locale={locale}
        />
      ))}
    </div>
  );
}
