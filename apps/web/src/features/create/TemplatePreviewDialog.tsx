import type { CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import type { CreatorTemplate } from "./types";
import { preloadedTemplatePreview, preloadTemplatePreview, whenTemplatePreviewReady } from "./templatePreviewPreload";

function openingFrame(template: CreatorTemplate | null) {
  const ratio = template?.aspectRatios.length === 1 ? template.aspectRatios[0] : "9:16";
  const [width, height] = (ratio ?? "9:16").split(":").map(Number);
  return { width: width || 9, height: height || 16 };
}

export function TemplatePreviewDialog({
  template,
  locale,
  onOpenChange,
  selectionEnabled = true,
}: {
  template: CreatorTemplate | null;
  locale: "en" | "ar";
  onOpenChange: (open: boolean) => void;
  selectionEnabled?: boolean;
}) {
  const [params] = useSearchParams();
  const ar = locale === "ar";
  const name = template ? (ar ? template.nameAr : template.name) : "";
  const source = template?.previewVideo ?? "";
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [readyToPlay, setReadyToPlay] = useState(false);
  const [frame, setFrame] = useState(() => openingFrame(template));
  const dialogStyle = {
    width: `min(calc(100vw - 1rem), calc((100dvh - 14rem) * ${frame.width} / ${frame.height} + 2.75rem), ${frame.width >= frame.height ? "56rem" : "27.5rem"})`,
  } satisfies CSSProperties;
  const frameStyle = { aspectRatio: `${frame.width} / ${frame.height}` } satisfies CSSProperties;
  useEffect(() => {
    setReadyToPlay(false);
    setFrame(openingFrame(template));
    if (!source) {
      setPlaybackUrl(null);
      return;
    }
    const cached = preloadedTemplatePreview(source);
    if (cached) {
      setPlaybackUrl(cached);
      return;
    }
    setPlaybackUrl(null);
    preloadTemplatePreview(source, { priority: true });
    const stop = whenTemplatePreviewReady(source, (url) => setPlaybackUrl(url ?? source));
    const timer = window.setTimeout(() => setPlaybackUrl((current) => current ?? source), 8000);
    return () => {
      stop();
      window.clearTimeout(timer);
    };
  }, [source, template]);

  return (
    <Dialog open={Boolean(template)} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={ar ? "إغلاق المعاينة" : "Close preview"}
        className="max-h-[calc(100dvh-1rem)] max-w-none overflow-y-auto gap-4 border-border/70 bg-background p-4 sm:p-5"
        style={dialogStyle}
        data-preview-ratio={`${frame.width}:${frame.height}`}
      >
        <DialogHeader className="pe-10 text-start">
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>
            {template?.managedPreview
              ? (ar ? "مثال معتمد لهذه النسخة من القالب. صورك ومعلوماتك المؤكدة توجه حملتك، وقد تختلف النتائج." : "An approved example for this template revision. Your photos and confirmed facts guide your campaign; results can vary.")
              : template?.id === "product-with-model-ad" && template.previewVideo
              ? (ar ? "معاينة مدتها 15 ثانية مع موسيقى. صور المنتج والموديل التي تختارها توجّه إعلانك؛ قد تختلف النتائج." : "15-second preview with music. Your selected product and model references guide your ad; results can vary.")
              : template?.previewVideo
              ? ar
                ? `${template.id === "jewelry-product-showcase" ? "معاينة متحركة مدتها 8 ثوانٍ من صورة المجوهرات الأصلية." : template.id === "luxury-gift-reveal" ? "مثال صامت مدته 8 ثوانٍ لفتح الهدية." : "مثال أصلي مدته 8 ثوانٍ."} مدد 15 و20 ثانية لها تسلسل أطول، وليست لها معاينات هنا. صورك ومعلوماتك المؤكدة توجّه الفيديو، وقد تختلف النتائج.`
                : `${template.id === "jewelry-product-showcase" ? "8-second animated preview made from the original jewelry photo." : template.id === "luxury-gift-reveal" ? "Silent 8-second example of the gift opening." : "Original 8-second example."} The 15- and 20-second versions use longer sequences; no longer previews are shown here. Your photos and confirmed facts guide the video; results can vary.`
              : ar
                ? "صورة ثابتة لتوضيح الاتجاه، وليست معاينة فيديو. اختر 8 أو 15 أو 20 ثانية؛ صورتك ومعلوماتك المؤكدة توجّه الفيديو النهائي."
                : "Static reference image, not a video preview. Choose 8, 15 or 20 seconds; your uploaded photo and confirmed facts guide the final video."}
          </DialogDescription>
        </DialogHeader>
        {[[template?.productSamplePhotos,ar?"أمثلة المنتج":"Product samples"],[template?.presenterSamplePhotos,ar?"أمثلة الشخصيات":"Presenter samples"]].map(([photos,label],group)=>Array.isArray(photos)&&photos.length>0&&<section key={group} className="space-y-2"><h3 className="text-sm font-medium">{String(label)}</h3><div className="flex flex-wrap gap-2">{photos.map((src,index)=><img key={String(src)} src={String(src)} alt={`${label} ${index+1}`} loading="lazy" className="h-20 w-20 rounded-md object-contain border"/>)}</div></section>)}
        {template?.previewVideo && (
          <div className="relative w-full overflow-hidden rounded-xl bg-black" style={frameStyle} data-preview-frame="">
            {template.poster && !readyToPlay ? <img src={template.poster} alt="" className="absolute inset-0 h-full w-full object-contain opacity-70" /> : null}
            {playbackUrl ? (
              <video
                key={playbackUrl}
                src={playbackUrl}
                poster={template.poster}
                autoPlay
                muted
                controls
                playsInline
                preload="auto"
                className="absolute inset-0 h-full w-full object-contain"
                aria-label={ar ? `معاينة فيديو لقالب ${name}` : `${name} video preview`}
                onLoadedMetadata={(event) => {
                  const { videoWidth, videoHeight } = event.currentTarget;
                  if (videoWidth > 0 && videoHeight > 0) setFrame({ width: videoWidth, height: videoHeight });
                }}
                onCanPlay={() => setReadyToPlay(true)}
              />
            ) : null}
            {!readyToPlay ? (
              <p className="absolute inset-0 m-auto flex h-fit w-fit items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm text-white" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {ar ? "جارٍ تحميل المعاينة" : "Loading preview"}
              </p>
            ) : null}
          </div>
        )}
        {template && !template.previewVideo && template.poster && (
          <img src={template.poster} alt={ar ? `اتجاه بصري لقالب ${name}` : `Visual direction for ${name}`} className="w-full rounded-xl bg-black object-contain" style={frameStyle} />
        )}
        {template && selectionEnabled && (
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:brightness-105"
            to={(() => {
              const next = new URLSearchParams();
              const draft = params.get("draft");
              const project = params.get("project");
              if (draft) next.set("draft", draft);
              if (project) next.set("project", project);
              next.set("template", template.id);
              return `/create?${next}`;
            })()}
          >
            {ar ? "استخدم هذا القالب" : "Use this template"}
          </Link>
        )}
      </DialogContent>
    </Dialog>
  );
}
