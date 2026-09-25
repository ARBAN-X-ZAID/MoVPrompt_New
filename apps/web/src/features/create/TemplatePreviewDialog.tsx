import { Link } from "react-router-dom";
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

export function TemplatePreviewDialog({
  template,
  locale,
  onOpenChange,
}: {
  template: CreatorTemplate | null;
  locale: "en" | "ar";
  onOpenChange: (open: boolean) => void;
}) {
  const ar = locale === "ar";
  const name = template ? (ar ? template.nameAr : template.name) : "";
  const source = template?.previewVideo ?? "";
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [readyToPlay, setReadyToPlay] = useState(false);
  useEffect(() => {
    setReadyToPlay(false);
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
  }, [source]);

  return (
    <Dialog open={Boolean(template)} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={ar ? "إغلاق المعاينة" : "Close preview"}
        className="max-w-4xl gap-4 border-border/70 bg-background p-4 sm:p-6"
      >
        <DialogHeader className="pe-10 text-start">
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>
            {ar
              ? "مثال على الاتجاه البصري. تُستخدم صورتك ومعلوماتك المؤكدة لتوليد فيديو جديد وقد تختلف الحركة والتفاصيل."
              : "Example visual direction. Your image and confirmed facts guide a new AI generation; movement and details can vary."}
          </DialogDescription>
        </DialogHeader>
        {template?.previewVideo && (
          <div className="relative grid max-h-[68dvh] min-h-[260px] place-items-center overflow-hidden rounded-xl bg-black">
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
                className="relative max-h-[68dvh] w-full object-contain"
                aria-label={ar ? `معاينة فيديو لقالب ${name}` : `${name} video preview`}
                onCanPlay={() => setReadyToPlay(true)}
              />
            ) : null}
            {!readyToPlay ? (
              <p className="relative flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm text-white" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {ar ? "جارٍ تحميل المعاينة" : "Loading preview"}
              </p>
            ) : null}
          </div>
        )}
        {template && (
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:brightness-105"
            to={`/create?template=${encodeURIComponent(template.id)}`}
          >
            {ar ? "استخدم هذا القالب" : "Use this template"}
          </Link>
        )}
      </DialogContent>
    </Dialog>
  );
}
