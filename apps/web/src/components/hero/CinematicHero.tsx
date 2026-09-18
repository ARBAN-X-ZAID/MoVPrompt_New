import { FormEvent, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Film,
  Grid2X2,
  Link2,
  Moon,
  Play,
  Search,
  Sparkles,
  Sun,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { HeroTopNav } from "./HeroTopNav";
import { Seo } from "@/components/Seo";
import { useTheme } from "@/components/ThemeProvider";
import { templateGoalLabel } from "@/features/create/templateMedia";
import { PREVIEWED_CREATOR_TEMPLATES } from "@/features/create/templates";
import type { CreatorTemplate } from "@/features/create/types";
import { TemplatePreviewDialog } from "@/features/create/TemplatePreviewDialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { isFeatureEnabled } from "@/config/features";
import logoMark from "@/assets/logo-mark-white.svg";
import "./cinematic-hero.css";

type TemplateCategory = "All" | "Mobile / Electronics" | "Food / Restaurants" | "Clothing / Fashion" | "Beauty / Cosmetics" | "Real Estate / Services";
type TemplateSort = "recommended" | "duration";

const heroReels = [
  { label: "Creator story", format: "9:16", image: "/homepage/hero-creator.png", className: "mp-reel-creator" },
  { label: "Product film", format: "16:9", image: "/homepage/hero-product.png", className: "mp-reel-main" },
  { label: "Lifestyle cut", format: "4:5", image: "/homepage/hero-lifestyle.png", className: "mp-reel-lifestyle" },
];

const campaignFrames = [
  { name: "Hero film", ratio: "16:9", duration: "10s", image: "/homepage/hero-product.png", className: "mp-campaign-hero" },
  { name: "Creator review", ratio: "9:16", duration: "15s", image: "/homepage/hero-creator.png", className: "mp-campaign-creator" },
  { name: "Product detail", ratio: "1:1", duration: "06s", image: "/homepage/template-clean-demo.png", className: "mp-campaign-detail" },
  { name: "Social cut", ratio: "4:5", duration: "08s", image: "/homepage/hero-lifestyle.png", className: "mp-campaign-social" },
  { name: "Launch teaser", ratio: "9:16", duration: "05s", image: "/homepage/hero-lifestyle.png", className: "mp-campaign-launch" },
] as const;

const footerFrames = [
  { label: "Product", image: "/homepage/hero-product.png" },
  { label: "Creator", image: "/homepage/hero-creator.png" },
  { label: "Lifestyle", image: "/homepage/hero-lifestyle.png" },
] as const;

const categoryRecipe: Record<Exclude<TemplateCategory, "All">, string> = {
  "Mobile / Electronics": "mobile electronics",
  "Food / Restaurants": "food restaurants",
  "Clothing / Fashion": "clothing fashion",
  "Beauty / Cosmetics": "beauty cosmetics",
  "Real Estate / Services": "property services",
};

const categories: TemplateCategory[] = [
  "All",
  ...(["Mobile / Electronics", "Food / Restaurants", "Clothing / Fashion", "Beauty / Cosmetics", "Real Estate / Services"] as const)
    .filter((category) => PREVIEWED_CREATOR_TEMPLATES.some((template) => template.eyebrow === categoryRecipe[category])),
];

const formatTemplateCategory = (value: string) => value
  .split("-")
  .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
  .join(" ");

const normalizeProductUrl = (value: string) => {
  const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  const parsed = new URL(candidate);
  if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes(".")) throw new Error("Invalid URL");
  return parsed.toString();
};

function HomepageTemplateGroup({
  id,
  title,
  description,
  templates,
  selectedTemplate,
  locale,
  onSelect,
  onUse,
  onPreview,
}: {
  id: string;
  title: string;
  description: string;
  templates: CreatorTemplate[];
  selectedTemplate: string;
  locale: "en" | "ar";
  onSelect: (templateId: string) => void;
  onUse: (templateId: string) => void;
  onPreview: (template: CreatorTemplate) => void;
}) {
  if (!templates.length) return null;
  const ar = locale === "ar";
  const headingId = `mp-template-group-${id}`;
  return (
    <section className="mp-template-group" aria-labelledby={headingId}>
      <div className="mp-template-group-heading">
        <div>
          <h3 id={headingId}>{title}</h3>
          <p>{description}</p>
        </div>
        <span>{ar ? `${templates.length} قالب` : `${templates.length} ${templates.length === 1 ? "template" : "templates"}`}</span>
      </div>
      <div className="mp-template-grid">
        {templates.map((template) => {
          const selected = selectedTemplate === template.id;
          return (
            <article key={template.id} className="mp-template-card" data-selected={selected}>
              <button
                className="mp-template-choice"
                type="button"
                aria-pressed={selected}
                aria-label={ar ? `اختر قالب ${template.nameAr}` : `Select ${template.name} template`}
                onClick={() => onSelect(template.id)}
              >
                <span className="mp-template-card-media" data-media-tone={template.mediaTone}>
                  {template.poster ? <img src={template.poster} alt="" loading="lazy" style={{ objectPosition: template.posterPosition }} /> : <span className="creator-template-placeholder" aria-hidden="true" />}
                  <span className="mp-template-media-stamp" aria-hidden="true"><b>{template.mediaCode}</b><span>{templateGoalLabel(template.goals[0] ?? "launch", locale)}</span></span>
                  <em aria-hidden="true">{ar ? "اتجاه القالب" : "Template direction"}</em>
                </span>
                <span className="mp-template-info">
                  <strong>{ar ? template.nameAr : template.name}</strong>
                  <i><span>{formatTemplateCategory(template.eyebrow)}</span><span aria-hidden="true">•</span><span>{template.duration}s</span></i>
                  {!selected && <ArrowRight aria-hidden="true" />}
                </span>
              </button>
              {template.previewVideo ? (
                <button
                  className="mp-template-preview-link"
                  type="button"
                  onClick={() => onPreview(template)}
                  aria-label={ar ? `شغّل معاينة قالب ${template.nameAr}` : `Play ${template.name} preview`}
                >
                  <Play aria-hidden="true" />
                  <span>{ar ? "شغّل المعاينة" : "Play preview"}</span>
                </button>
              ) : (
                <Link
                  className="mp-template-preview-link"
                  to={`/templates/${encodeURIComponent(template.id)}`}
                  aria-label={ar ? `شاهد اتجاه قالب ${template.nameAr}` : `View ${template.name} direction`}
                >
                  <ArrowUpRight aria-hidden="true" />
                  <span>{ar ? "شاهد الاتجاه" : "View direction"}</span>
                </Link>
              )}
              {selected && (
                <button className="mp-use-template" type="button" onClick={() => onUse(template.id)}>
                  {ar ? "استخدم القالب" : "Use template"}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export const CinematicHero = () => {
  const developmentFreeGeneration = import.meta.env.DEV && isFeatureEnabled("developmentFreeGeneration");
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { locale } = useLanguage();
  const reduceMotion = useReducedMotion();
  const productInputRef = useRef<HTMLInputElement>(null);
  const [productUrl, setProductUrl] = useState("");
  const [productError, setProductError] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<CreatorTemplate | null>(null);
  const [category, setCategory] = useState<TemplateCategory>("All");
  const [query, setQuery] = useState("");
  const [visibleTemplateCount, setVisibleTemplateCount] = useState(13);
  const [templateSort, setTemplateSort] = useState<TemplateSort>("recommended");
  const [selectedTemplate, setSelectedTemplate] = useState(PREVIEWED_CREATOR_TEMPLATES[0]!.id);
  const [activeCampaignFrame, setActiveCampaignFrame] = useState("Hero film");

  const matchingTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = PREVIEWED_CREATOR_TEMPLATES.filter((template) => {
      const matchesCategory = category === "All" || template.eyebrow === categoryRecipe[category];
      const haystack = [template.name, template.nameAr, template.eyebrow, template.description, template.descriptionAr, template.bestFor, ...template.tags]
        .join(" ")
        .toLocaleLowerCase();
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
    return templateSort === "duration"
      ? [...matches].sort((left, right) => left.duration - right.duration || left.name.localeCompare(right.name))
      : matches;
  }, [category, query, templateSort]);
  const orderedMatchingTemplates = useMemo(() => {
    const selected = matchingTemplates.find((template) => template.id === selectedTemplate) ?? null;
    const remaining = selected
      ? matchingTemplates.filter((template) => template.id !== selected.id)
      : matchingTemplates;
    const readyPreviews = remaining.filter((template) => template.previewVideo);
    const campaignDirections = remaining.filter((template) => !template.previewVideo);
    return selected
      ? [selected, ...readyPreviews, ...campaignDirections]
      : [...readyPreviews, ...campaignDirections];
  }, [matchingTemplates, selectedTemplate]);
  const selectedStaticTemplate = matchingTemplates.find((template) => template.id === selectedTemplate && !template.previewVideo) ?? null;
  const visibleLimit = visibleTemplateCount + (selectedStaticTemplate ? 1 : 0);
  const visibleTemplates = orderedMatchingTemplates.slice(0, visibleLimit);
  const selectedDirection = visibleTemplates.find((template) => template.id === selectedTemplate && !template.previewVideo) ?? null;
  const visibleReadyPreviews = visibleTemplates.filter((template) => template.previewVideo);
  const visibleCampaignDirections = visibleTemplates.filter((template) => !template.previewVideo && template.id !== selectedDirection?.id);

  const rememberCreation = (templateId?: string, url?: string) => {
    try {
      if (templateId) localStorage.setItem("movprompt.home.templateId", templateId);
      if (url) localStorage.setItem("movprompt.home.productUrl", url);
    } catch {
      // Local storage is optional; navigation should still work.
    }
  };

  const goToStudio = (templateId?: string) => {
    rememberCreation(templateId);
    navigate(templateId ? `/create?template=${encodeURIComponent(templateId)}` : "/create");
  };

  const handleProductSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const normalizedUrl = normalizeProductUrl(productUrl);
      setProductError("");
      rememberCreation(undefined, normalizedUrl);
      navigate("/create");
    } catch {
      setProductError("Enter a complete product URL, such as yourstore.com/product.");
      productInputRef.current?.focus();
    }
  };

  const focusProductInput = () => {
    document.getElementById("top")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => productInputRef.current?.focus(), 350);
  };

  return (
    <div id="top" className="mp-home">
      <Seo
        title="MovPrompt - Create campaign-ready videos from templates"
        description="Add a product, choose a proven video format, and create polished product, creator, and social videos with MovPrompt."
        path="/"
      />
      <a className="mp-skip-link" href="#main-content">Skip to main content</a>
      <HeroTopNav />

      <main id="main-content">
        <section className="mp-hero" aria-labelledby="hero-title">
          <div className="mp-container mp-hero-grid">
            <motion.div
              className="mp-hero-copy"
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.58, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="mp-eyebrow">Template-first AI video</p>
              <h1 id="hero-title">One product. A complete campaign.</h1>
              <p className="mp-hero-description">
                Add a product link, choose a format, and create polished social video without shoots, prompts, or editing.
              </p>

              <form className="mp-product-form" onSubmit={handleProductSubmit} noValidate>
                <label htmlFor="hero-product-link">Product link</label>
                <div className="mp-product-field" data-error={Boolean(productError)}>
                  <Link2 aria-hidden="true" />
                  <input
                    ref={productInputRef}
                    id="hero-product-link"
                    name="productUrl"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="https://yourstore.com/product"
                    value={productUrl}
                    aria-describedby={productError ? "product-url-error" : "product-url-help"}
                    aria-invalid={Boolean(productError)}
                    onChange={(event) => {
                      setProductUrl(event.target.value);
                      if (productError) setProductError("");
                    }}
                  />
                  <button className="mp-button mp-button-primary" type="submit">
                    Create my video <ArrowUpRight aria-hidden="true" />
                  </button>
                </div>
                {productError ? (
                  <p id="product-url-error" className="mp-form-error" role="alert">{productError}</p>
                ) : (
                  <span id="product-url-help" className="sr-only">Paste the public URL of the product you want to promote.</span>
                )}
              </form>

              <div className="mp-hero-links">
                <a href="#templates">Browse templates <ArrowRight aria-hidden="true" /></a>
                <span>No prompt required. No credit card required.</span>
              </div>
            </motion.div>

            <motion.div
              className="mp-hero-visual"
              role="group"
              tabIndex={0}
              aria-label={locale === "ar" ? "ثلاثة أمثلة لاتجاهات حملة لمنتج واحد" : "Three example campaign directions for one product"}
              initial={reduceMotion ? false : { opacity: 0, x: 26, scale: 0.985 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.66, delay: reduceMotion ? 0 : 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mp-storyboard-head" aria-hidden="true">
                <span>Campaign 01</span>
                <strong>One product, three directions</strong>
                <span>Ready to shape</span>
              </div>
              <div className="mp-reel-row">
                {heroReels.map((reel, index) => (
                  <motion.figure
                    key={reel.label}
                    className={`mp-reel ${reel.className}`}
                    initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.16 + index * 0.07, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <img src={reel.image} alt={`${reel.label} preview featuring the same dark perfume bottle`} />
                    <figcaption>
                      <span aria-hidden="true">0{index + 1}</span>
                      <strong>{reel.label}</strong>
                      <small>{reel.format}</small>
                    </figcaption>
                  </motion.figure>
                ))}
              </div>
              <div className="mp-storyboard-foot" aria-hidden="true"><span>Product</span><span>Creator</span><span>Social</span></div>
            </motion.div>
          </div>
        </section>

        <motion.section
          id="templates"
          className="mp-section mp-templates"
          aria-labelledby="templates-title"
          initial={reduceMotion ? false : { opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.08 }}
          transition={{ duration: reduceMotion ? 0 : 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mp-container">
            <div className="mp-section-heading mp-template-heading">
              <div>
                <h2 id="templates-title">Choose the result, then make it yours.</h2>
                <p>Start with a format built for the way people watch, shop and share. MovPrompt handles the technical decisions.</p>
              </div>
              <Link to="/templates">View all {PREVIEWED_CREATOR_TEMPLATES.length} templates <ArrowRight aria-hidden="true" /></Link>
            </div>

            <div id="template-browser" className="mp-template-toolbar">
              <label className="mp-template-search">
                <span>Search templates</span>
                <div><Search aria-hidden="true" /><input value={query} onChange={(event) => { setQuery(event.target.value); setVisibleTemplateCount(13); }} placeholder="Search by product, business or goal" /></div>
              </label>
              <div className="mp-category-tabs" role="group" aria-label="Filter templates by category">
                {categories.map((item) => (
                  <button key={item} type="button" aria-pressed={category === item} onClick={() => { setCategory(item); setVisibleTemplateCount(13); }}>{item}</button>
                ))}
              </div>
              <label className="mp-sort-select">
                <span className="sr-only">Sort templates</span>
                <select
                  value={templateSort}
                  onChange={(event) => {
                    setTemplateSort(event.target.value as TemplateSort);
                    setVisibleTemplateCount(13);
                  }}
                >
                  <option value="recommended">Sort: Recommended</option>
                  <option value="duration">Sort: Duration</option>
                </select>
                <ChevronDown aria-hidden="true" />
              </label>
            </div>

            <p className="mp-template-count" aria-live="polite">
              Showing {visibleTemplates.length} of {matchingTemplates.length} matching templates, {PREVIEWED_CREATOR_TEMPLATES.length} total
            </p>

            {visibleTemplates.length ? (
              <div className="mp-template-groups" aria-live="polite">
                {selectedDirection && (
                  <HomepageTemplateGroup
                    id="selected-direction"
                    title={locale === "ar" ? "الاتجاه المحدد" : "Selected direction"}
                    description={locale === "ar" ? "اختيارك الحالي محفوظ في الأعلى بينما تقارن المعاينات الجاهزة." : "Your current choice stays first while you compare ready previews."}
                    templates={[selectedDirection]}
                    selectedTemplate={selectedTemplate}
                    locale={locale}
                    onSelect={setSelectedTemplate}
                    onUse={goToStudio}
                    onPreview={setPreviewTemplate}
                  />
                )}
                <HomepageTemplateGroup
                  id="ready-previews"
                  title={locale === "ar" ? "معاينات جاهزة" : "Ready previews"}
                  description={locale === "ar" ? "معاينات حركة حقيقية تم التحقق منها ويمكن تشغيلها الآن." : "Verified motion previews you can play now."}
                  templates={visibleReadyPreviews}
                  selectedTemplate={selectedTemplate}
                  locale={locale}
                  onSelect={setSelectedTemplate}
                  onUse={goToStudio}
                  onPreview={setPreviewTemplate}
                />
                <HomepageTemplateGroup
                  id="campaign-directions"
                  title={locale === "ar" ? "اتجاهات حملات إضافية" : "More campaign directions"}
                  description={locale === "ar" ? "أفكار بمعاينات ثابتة، وليست فيديوهات قابلة للتشغيل بعد." : "Concepts with static direction art. Playable videos are still being prepared."}
                  templates={visibleCampaignDirections}
                  selectedTemplate={selectedTemplate}
                  locale={locale}
                  onSelect={setSelectedTemplate}
                  onUse={goToStudio}
                  onPreview={setPreviewTemplate}
                />
              </div>
            ) : (
              <div className="mp-template-empty" role="status">
                <strong>No matching templates</strong>
                <span>Try another search or choose a different category.</span>
                <button type="button" onClick={() => { setQuery(""); setCategory("All"); setVisibleTemplateCount(13); }}>Show all templates</button>
              </div>
            )}

            {visibleTemplates.length < matchingTemplates.length && (
              <div className="mp-template-more">
                <button type="button" onClick={() => setVisibleTemplateCount((count) => count + 12)}>
                  Show more templates ({matchingTemplates.length - visibleTemplates.length})
                </button>
              </div>
            )}

            <div className="mp-template-footer">
              <span>Templates include shot direction, pacing and format. Your product stays yours.</span>
              <Link to="/learn">How templates work <ArrowRight aria-hidden="true" /></Link>
            </div>
          </div>
        </motion.section>

        <motion.section
          id="campaign-system"
          className="mp-section mp-campaign"
          aria-labelledby="campaign-title"
          initial={reduceMotion ? false : { opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.08 }}
          transition={{ duration: reduceMotion ? 0 : 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mp-container">
            <div className="mp-campaign-heading">
              <div>
                <p className="mp-eyebrow">Campaign blueprint</p>
                <h2 id="campaign-title">Plan once. Create each format with intent.</h2>
              </div>
              <p>See how one product can become a coordinated set of product, creator and social directions before you generate.</p>
              <button type="button" onClick={focusProductInput}>Start with your product <ArrowRight aria-hidden="true" /></button>
            </div>

            <div
              className="mp-campaign-grid"
              role="group"
              aria-label={locale === "ar" ? "خمسة أمثلة لتنسيقات حملة لمنتج واحد" : "Five example campaign formats for one product"}
            >
              {campaignFrames.map((frame) => (
                <figure
                  key={frame.name}
                  className={`mp-campaign-frame ${frame.className}`}
                  data-active={activeCampaignFrame === frame.name}
                >
                  <img src={frame.image} alt={`${frame.name} example for a perfume campaign`} loading="lazy" />
                  <figcaption>
                    <button
                      type="button"
                      aria-label={`Select ${frame.name} campaign frame`}
                      aria-pressed={activeCampaignFrame === frame.name}
                      onClick={() => setActiveCampaignFrame(frame.name)}
                    >
                      <Grid2X2 aria-hidden="true" />
                    </button>
                    <strong>{frame.name}</strong>
                    <span>{frame.ratio} · {frame.duration}</span>
                  </figcaption>
                </figure>
              ))}
            </div>

            <div className="mp-review-strip">
              <div className="mp-campaign-timeline" role="group" aria-label="Select campaign variation">
                {campaignFrames.map((frame) => (
                  <button
                    key={frame.name}
                    type="button"
                    aria-label={`Select ${frame.name}`}
                    aria-pressed={activeCampaignFrame === frame.name}
                    onClick={() => setActiveCampaignFrame(frame.name)}
                  >
                    <img src={frame.image} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
              <div className="mp-campaign-facts" role="group" aria-label="Campaign details">
                <span><Film aria-hidden="true" />5 planned cuts</span>
                <span><Grid2X2 aria-hidden="true" />3 shown ratios</span>
                <span><Sparkles aria-hidden="true" />Example layout</span>
              </div>
              <button className="mp-button mp-button-primary" type="button" onClick={() => goToStudio()}>
                Start a campaign <ArrowUpRight aria-hidden="true" />
              </button>
            </div>
            <p className="sr-only" aria-live="polite">{activeCampaignFrame} selected for preview.</p>
          </div>
        </motion.section>

        <motion.section
          id="start-creating"
          className="mp-final-cta"
          aria-labelledby="final-cta-title"
          initial={reduceMotion ? false : { opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.12 }}
          transition={{ duration: reduceMotion ? 0 : 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mp-container mp-final-cta-grid">
            <div className="mp-final-copy">
              <h2 id="final-cta-title">Your next campaign starts with a link.</h2>
              <p>Bring the product. Choose the format. MovPrompt handles the production.</p>
              <button className="mp-button mp-button-primary mp-final-primary" type="button" onClick={focusProductInput}>Add your product link <ArrowUpRight aria-hidden="true" /></button>
              <a className="mp-final-template-link" href="#templates">Browse templates first <ArrowRight aria-hidden="true" /></a>
              <p className="mp-final-reassurance">No credit card required. Your product stays private.</p>
            </div>

            <div
              className="mp-final-media"
              role="group"
              tabIndex={0}
              aria-label={locale === "ar" ? "معاينات حملات المنتج وصانع المحتوى ونمط الحياة" : "Product, creator and lifestyle campaign previews"}
            >
              {footerFrames.map((frame) => (
                <figure key={frame.label}>
                  <span>{frame.label}</span>
                  <img src={frame.image} alt={`${frame.label} campaign preview`} loading="lazy" />
                </figure>
              ))}
              <div className="mp-final-progress" aria-hidden="true"><span /></div>
            </div>
          </div>
        </motion.section>
      </main>

      <footer className="mp-site-footer">
        <div className="mp-container">
          <div className="mp-footer-grid">
            <div className="mp-footer-brand">
              <a href="#top" className="mp-brand" aria-label="MovPrompt home">
                <img className="mp-footer-mark" src={logoMark} alt="" width="34" height="48" />
                <span>MovPrompt</span>
              </a>
              <p>Template-first AI video for modern campaigns.</p>
            </div>

            <nav aria-label="Create">
              <h2>Create</h2>
              <a href="#templates">Templates</a>
              <a href="#campaign-system">Product ads</a>
              <a href="#templates">UGC</a>
              {/* Advanced Studio remains implemented for a later release. */}
            </nav>

            <nav aria-label="Explore">
              <h2>Explore</h2>
              <a href="#campaign-system">Showcase</a>
              {!developmentFreeGeneration && <Link to="/pricing">Pricing</Link>}
              <Link to="/learn">Learn</Link>
            </nav>

            <nav aria-label="Company">
              <h2>Company</h2>
              <Link to="/about">About</Link>
              <a href="mailto:hello@movprompt.com">Contact</a>
              <Link to="/terms">Terms</Link>
              <Link to="/privacy">Privacy</Link>
            </nav>

            <div className="mp-footer-appearance">
              <h2>Appearance</h2>
              <div role="group" aria-label="Choose color theme">
                <button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")}>
                  <Sun aria-hidden="true" /><span className="sr-only">Use light mode</span>
                </button>
                <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>
                  <Moon aria-hidden="true" /><span className="sr-only">Use dark mode</span>
                </button>
              </div>
              <p>{theme === "light" ? "Light" : "Dark"}</p>
            </div>
          </div>

          <div className="mp-footer-bottom">
            <span>© 2026 MovPrompt</span>
            <div><span>English</span><span>KWD</span></div>
          </div>
        </div>
      </footer>
      <TemplatePreviewDialog template={previewTemplate} locale={locale} onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }} />
    </div>
  );
};
