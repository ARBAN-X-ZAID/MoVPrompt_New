import { getVerifiedTemplatePreview } from "@movprompt/creative-engine";
import { templateDetailPath, templateSection, type TemplateSection } from "@/features/create/templatePlacement";
import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Seo } from "@/components/Seo";
import { CreatorShell } from "@/features/create/CreatorShell";
import { TemplateGrid } from "@/features/create/TemplateGrid";
import { creatorTemplateFromCatalog } from "@/features/create/templateCatalogMapper";
import { DISCOVERABLE_CREATOR_TEMPLATES, getCreatorTemplate } from "@/features/create/templates";
import type { CreatorTemplate } from "@/features/create/types";
import { isFeatureEnabled } from "@/config/features";
import { portableCreatorApi } from "@/lib/api/portableApiClient";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

export default function CreatorTemplates({ qaMode = false, section = "templates" }: { qaMode?: boolean; section?: TemplateSection }) {
  const location = useLocation();
  const adStudio = section === "ad-studio";
  const listParams = new URLSearchParams(location.search);
  if (qaMode) listParams.set("view", section);
  const listPath = `${qaMode ? "/qa/create" : "/" + section}${listParams.size ? "?" + listParams : ""}`;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const { slug } = useParams();
  const createPath = (templateId: string) => {
    const next = new URLSearchParams();
    const draft = params.get("draft");
    const project = params.get("project");
    if (draft) next.set("draft", draft);
    if (project) next.set("project", project);
    next.set("template", templateId);
    return `${qaMode ? "/qa/create" : "/create"}?${next}`;
  };
  const [template, setTemplate] = useState<CreatorTemplate>(() => getCreatorTemplate(slug));
  const [detailState, setDetailState] = useState<"loading" | "ready" | "missing">(
    slug && isFeatureEnabled("portableAuth") ? "loading" : "ready",
  );
  useEffect(() => {
    if (!slug || !isFeatureEnabled("portableAuth")) {
      const local = DISCOVERABLE_CREATOR_TEMPLATES.find((candidate) => candidate.id === slug);
      if (local) setTemplate(local);
      setDetailState(slug && !local ? "missing" : "ready");
      return;
    }
    setDetailState("loading");
    let active = true;
    void portableCreatorApi.getTemplate(slug).then((published) => {
      if (!active) return;
      setTemplate(creatorTemplateFromCatalog(published));
      setDetailState("ready");
    }).catch(() => {
      if (!active) return;
      // A local preview must not make an unpublished server item selectable.
      setDetailState("missing");
    });
    return () => { active = false; };
  }, [slug]);
  if (slug && templateSection(slug) && templateSection(slug) !== section) {
    return <Navigate replace to={`${templateDetailPath(slug)}${location.search}${location.hash}`} />;
  }
  if (slug) {
    if (detailState === "loading") {
      return <CreatorShell qaMode={qaMode}><div className="creator-page"><p className="creator-catalog-status" role="status">{ar ? "جاري تحميل القالب المنشور…" : "Loading the published template…"}</p></div></CreatorShell>;
    }
    if (detailState === "missing") {
      return <CreatorShell qaMode={qaMode}><div className="creator-page creator-empty"><div><h1>{ar ? "القالب غير متوفر" : "Template unavailable"}</h1><p>{ar ? "هذا القالب غير منشور حالياً. اختر نوع حملة ثاني." : "This template is not currently published. Choose another campaign format."}</p><Link className="creator-button creator-button-primary" to={listPath}>{adStudio ? (ar ? "تصفح الإعلانات" : "Browse ads") : (ar ? "تصفح القوالب" : "Browse templates")}</Link></div></div></CreatorShell>;
    }
    const displayName = ar ? template.nameAr : template.name;
    const displayDescription = ar ? template.descriptionAr : template.description;
    return (
      <CreatorShell qaMode={qaMode}>
        <Seo title={`${displayName} · MovPrompt`} description={displayDescription} path={templateDetailPath(template.id)} />
        <div className="creator-page creator-template-detail creator-library">
          <Link className="creator-template-back" to={listPath}><ArrowLeft aria-hidden="true" /> {adStudio ? (ar ? "استوديو الإعلانات" : "Ad Studio") : (ar ? "كل القوالب" : "All templates")}</Link>
          <div className="creator-template-detail-grid">
            <figure className="creator-template-detail-media" data-preview-kind={template.previewVideo ? "video" : "poster"}>
              <div className="creator-template-detail-frame">
                {template.previewVideo ? (
                  <video src={template.previewVideo} poster={template.poster} controls playsInline preload="metadata" aria-label={ar ? `معاينة حركة حقيقية لقالب ${displayName}` : `Real motion preview for ${displayName}`} />
                ) : (
                  <img src={template.poster} alt={ar ? `اتجاه بصري لقالب ${displayName}` : `Visual direction for ${displayName}`} style={{ objectPosition: template.posterPosition }} />
                )}
              </div>
              <figcaption>
                {template.previewVideo
                  ? (ar ? "معاينة حركة حقيقية من موادنا الحالية. منتجك ونصك يُضافان عند التوليد." : "Real motion sample from the current asset library. Your product and copy are added at generation.")
                  : (ar ? "اتجاه بصري ثابت للقالب، وليس فيديو جاهزاً. اللقطات النهائية تُولد من موادك." : "Static template direction, not a finished video. Final footage is generated from your assets.")}
              </figcaption>
            </figure>
            <TemplateDetailSide template={template} qaMode={qaMode} listPath={listPath} adStudio={adStudio} />
          </div>
        </div>
      </CreatorShell>
    );
  }
  return (
    <CreatorShell qaMode={qaMode}>
      <Seo title={adStudio ? (ar ? "استوديو الإعلانات · MovPrompt" : "Ad Studio · MovPrompt") : (ar ? "قوالب الفيديو · MovPrompt" : "Video templates · MovPrompt")} description={ar ? "اختر قالب فيديو موجه لحملتك القادمة." : "Choose a guided product-video template for your next campaign."} path={`/${section}`} />
      <div className="creator-page creator-library">
        <header className="creator-page-head creator-library-head">
          <div>
            <p className="creator-kicker">{adStudio ? (ar ? "استوديو الإعلانات" : "Ad Studio") : (ar ? "قوالب حملات مختارة" : "Curated campaign formats")}</p>
            <h1 className="creator-title creator-title-sm">{adStudio ? (ar ? "منتجك في قلب الإعلان." : "Put your product in the spotlight.") : (ar ? "اختر النتيجة، مو مهارة المونتاج." : "Choose by outcome, not editing skill.")}</h1>
            <p className="creator-subtitle">{adStudio ? (ar ? "اختر نوع الإعلان، ثم أضف صورك وتفاصيلك." : "Pick an ad format, then add your photos and details.") : (ar ? "كل قالب يضبط الإيقاع والتكوين، وأنت تعدّل المنتج والرسالة." : "Each template handles pacing and composition. You bring the product and message.")}</p>
          </div>
        </header>
        <TemplateGrid key={section} section={section} onSelect={(templateId) => navigate(createPath(templateId))} />
      </div>
    </CreatorShell>
  );
}

function TemplateDetailSide({ template, qaMode, listPath, adStudio }: { template: CreatorTemplate; qaMode: boolean; listPath: string; adStudio: boolean }) {
  const { locale } = useLanguage();
  const [params] = useSearchParams();
  const createPath = (templateId: string) => {
    const next = new URLSearchParams();
    const draft = params.get("draft");
    const project = params.get("project");
    if (draft) next.set("draft", draft);
    if (project) next.set("project", project);
    next.set("template", templateId);
    return `${qaMode ? "/qa/create" : "/create"}?${next}`;
  };
  const ar = locale === "ar";
  const displayName = ar ? template.nameAr : template.name;
  const displayDescription = ar ? template.descriptionAr : template.description;
  return (
    <aside className="creator-template-detail-side">
      <p className="creator-kicker">{template.eyebrow}</p>
      <h1>{displayName}</h1>
      <p className="creator-subtitle">{displayDescription}</p>
      <dl className="creator-template-detail-summary">
        <div>
          <span>{ar ? "الأنسب لـ" : "Best for"}</span>
          <strong>{template.bestFor}</strong>
        </div>
        <div>
          <span>{ar ? "اللغات" : "Languages"}</span>
          <strong>{ar ? "اللهجة الكويتية، الإنجليزية، أو الاثنين" : "Kuwaiti Arabic, English, bilingual"}</strong>
        </div>
        <div>
          <span>{ar ? "المقاسات" : "Formats"}</span>
          <strong>{template.aspectRatios.join(" · ")}</strong>
        </div>
        <div>
          <span>{ar ? "المدة" : "Length"}</span>
          <strong>{(getVerifiedTemplatePreview(template.id)?.durationSeconds ?? template.duration)}{ar ? " ث" : "s"}</strong>
        </div>
      </dl>
      <div className="creator-template-detail-cta">
        <Link
          className="creator-button creator-button-primary"
          to={createPath(template.id)}
        >
          <Sparkles aria-hidden="true" /> {ar ? "استخدم هذا القالب" : "Use this template"}
          <ArrowUpRight aria-hidden="true" />
        </Link>
        <Link className="creator-button creator-button-quiet" to={listPath}>
          {adStudio ? (ar ? "تصفح إعلاناً آخر" : "Browse another ad") : (ar ? "تصفح قالباً آخر" : "Browse another template")}
        </Link>
      </div>
    </aside>
  );
}
