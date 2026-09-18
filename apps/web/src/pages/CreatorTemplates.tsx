import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Clock, Layers, Sparkles, Languages, RectangleHorizontal } from "lucide-react";
import { Seo } from "@/components/Seo";
import { CreatorShell } from "@/features/create/CreatorShell";
import { TemplateGrid } from "@/features/create/TemplateGrid";
import { creatorTemplateFromCatalog } from "@/features/create/templateCatalogMapper";
import { CREATOR_TEMPLATES, getCreatorTemplate } from "@/features/create/templates";
import { useCapabilities } from "@/features/create/useCapabilities";
import type { CreatorTemplate } from "@/features/create/types";
import { isFeatureEnabled } from "@/config/features";
import { portableCreatorApi } from "@/lib/api/portableApiClient";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

export default function CreatorTemplates({ qaMode = false }: { qaMode?: boolean }) {
  const navigate = useNavigate();
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const { slug } = useParams();
  const [template, setTemplate] = useState<CreatorTemplate>(() => getCreatorTemplate(slug));
  const [detailState, setDetailState] = useState<"loading" | "ready" | "missing">(
    slug && isFeatureEnabled("portableAuth") ? "loading" : "ready",
  );
  useEffect(() => {
    if (!slug || !isFeatureEnabled("portableAuth")) {
      setTemplate(getCreatorTemplate(slug));
      setDetailState("ready");
      return;
    }
    let active = true;
    void portableCreatorApi.getTemplate(slug).then((published) => {
      if (!active) return;
      setTemplate(creatorTemplateFromCatalog(published));
      setDetailState("ready");
    }).catch(() => {
      if (!active) return;
      const localTemplate = CREATOR_TEMPLATES.find((candidate) => candidate.id === slug);
      if (localTemplate) {
        setTemplate(localTemplate);
        setDetailState("ready");
        return;
      }
      setDetailState("missing");
    });
    return () => { active = false; };
  }, [slug]);
  if (slug) {
    if (detailState === "loading") {
      return <CreatorShell qaMode={qaMode}><div className="creator-page"><p className="creator-catalog-status" role="status">{ar ? "جاري تحميل القالب المنشور…" : "Loading the published template…"}</p></div></CreatorShell>;
    }
    if (detailState === "missing") {
      return <CreatorShell qaMode={qaMode}><div className="creator-page creator-empty"><div><h1>{ar ? "القالب غير متوفر" : "Template unavailable"}</h1><p>{ar ? "هذا القالب غير منشور حالياً. اختر نوع حملة ثاني." : "This template is not currently published. Choose another campaign format."}</p><Link className="creator-button creator-button-primary" to="/templates">{ar ? "تصفح القوالب" : "Browse templates"}</Link></div></div></CreatorShell>;
    }
    const displayName = ar ? template.nameAr : template.name;
    const displayDescription = ar ? template.descriptionAr : template.description;
    return (
      <CreatorShell qaMode={qaMode}>
        <Seo title={`${displayName} · MovPrompt`} description={displayDescription} path={`/templates/${template.id}`} />
        <div className="creator-page creator-template-detail">
          <Link className="creator-template-back" to="/templates"><ArrowLeft aria-hidden="true" /> {ar ? "كل القوالب" : "All templates"}</Link>
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
            <TemplateDetailSide template={template} qaMode={qaMode} />
          </div>
        </div>
      </CreatorShell>
    );
  }
  return (
    <CreatorShell qaMode={qaMode}>
      <Seo title={ar ? "قوالب الفيديو · MovPrompt" : "Video templates · MovPrompt"} description={ar ? "اختر قالب فيديو موجه لحملتك القادمة." : "Choose a guided product-video template for your next campaign."} path="/templates" />
      <div className="creator-page">
        <header className="creator-page-head">
          <div>
            <p className="creator-kicker">{ar ? "قوالب حملات مختارة" : "Curated campaign formats"}</p>
            <h1 className="creator-title creator-title-sm">{ar ? "اختر النتيجة، مو مهارة المونتاج." : "Choose by outcome, not editing skill."}</h1>
            <p className="creator-subtitle">{ar ? "كل قالب يرتب التكوين والإيقاع والمساحات الآمنة، ويخلي المنتج والرسالة والهوية قابلة للتعديل." : "Every template controls composition, pacing and safe zones while keeping the product, message and brand editable."}</p>
          </div>
        </header>
        <TemplateGrid onSelect={(templateId) => navigate(`${qaMode ? "/qa/create" : "/create"}?template=${templateId}`)} />
      </div>
    </CreatorShell>
  );
}

function TemplateDetailSide({ template, qaMode }: { template: CreatorTemplate; qaMode: boolean }) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const capabilities = useCapabilities();
  const displayName = ar ? template.nameAr : template.name;
  const displayDescription = ar ? template.descriptionAr : template.description;
  return (
    <aside className="creator-template-detail-side">
      <p className="creator-kicker">{template.eyebrow}</p>
      <h1>{displayName}</h1>
      <p className="creator-subtitle">{displayDescription}</p>
      <ul className="creator-template-detail-chips" aria-label={ar ? "مواصفات القالب" : "Template specifications"}>
        <li>
          <Clock aria-hidden="true" />
          {template.duration}{ar ? "ث" : "s"}
        </li>
        <li>
          <Sparkles aria-hidden="true" />
          {capabilities.active.displayName}
        </li>
        <li>
          <Layers aria-hidden="true" />
          {ar ? `${template.scenes.length} مشاهد` : `${template.scenes.length} scenes`}
        </li>
        <li>
          <RectangleHorizontal aria-hidden="true" />
          {template.aspectRatios.join(" · ")}
        </li>
        <li>
          <Languages aria-hidden="true" />
          {ar ? "كويتي + إنجليزي" : "Kuwaiti Arabic + English"}
        </li>
      </ul>
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
          <span>{ar ? "التركيب" : "Structure"}</span>
          <strong>{ar ? `${template.scenes.length} مشاهد موجهة` : `${template.scenes.length} guided scenes`}</strong>
        </div>
        <div>
          <span>{ar ? "النموذج" : "Model"}</span>
          <strong>{capabilities.active.displayName}</strong>
        </div>
      </dl>
      <div className="creator-template-detail-cta">
        <Link
          className="creator-button creator-button-primary"
          to={`${qaMode ? "/qa/create" : "/create"}?template=${template.id}`}
        >
          <Sparkles aria-hidden="true" /> {ar ? "استخدم هذا القالب" : "Use this template"}
          <ArrowUpRight aria-hidden="true" />
        </Link>
        <Link className="creator-button creator-button-quiet" to="/templates">
          {ar ? "تصفح قالباً آخر" : "Browse another template"}
        </Link>
      </div>
    </aside>
  );
}
