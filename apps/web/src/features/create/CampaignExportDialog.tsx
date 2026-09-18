import { useRef, useState } from "react";
import { CheckCircle2, Download, Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { CreatorAspectRatio, CreatorResolution } from "./types";

const EXPORT_PRESETS: Array<{ ratio: CreatorAspectRatio; title: string; titleAr: string }> = [
  { ratio: "9:16", title: "TikTok, Reels & Snapchat", titleAr: "تيك توك وريلز وسناب شات" },
  { ratio: "1:1", title: "Instagram feed", titleAr: "منشور إنستغرام" },
  { ratio: "4:5", title: "Instagram portrait", titleAr: "إنستغرام عمودي" },
  { ratio: "16:9", title: "YouTube & website", titleAr: "يوتيوب والموقع" },
];

export function CampaignExportDialog({ open, onOpenChange, arabic, currentRatio, selectedRatio, onSelectRatio, resolution, audio, hasVideo, previewOnly, onDownload, onGenerate }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  arabic: boolean;
  currentRatio: CreatorAspectRatio;
  selectedRatio: CreatorAspectRatio;
  onSelectRatio: (ratio: CreatorAspectRatio) => void;
  resolution: CreatorResolution;
  audio: boolean;
  hasVideo: boolean;
  previewOnly: boolean;
  onDownload: () => Promise<void> | void;
  onGenerate: (ratio: CreatorAspectRatio) => Promise<void> | void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const pendingRef = useRef(false);
  const tr = (en: string, ar: string) => arabic ? ar : en;
  const isCurrent = selectedRatio === currentRatio;

  const performAction = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(false);
    try {
      if (isCurrent) await onDownload();
      else await onGenerate(selectedRatio);
    } catch {
      setError(true);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The portal is outside CreatorShell, so it must carry its own theme scope. */}
      <DialogContent dir={arabic ? "rtl" : "ltr"} closeLabel={tr("Close", "إغلاق")} overlayClassName="creator-export-backdrop" className="creator-app creator-export-panel">
        <div className="creator-export-head">
          <DialogTitle>{tr("Export campaign", "تصدير الحملة")}</DialogTitle>
          <DialogDescription>{tr("Choose where this version will be published.", "اختر وين راح تنشر هذه النسخة.")}</DialogDescription>
        </div>
        <div className="creator-export-options">
          {EXPORT_PRESETS.map(preset => (
            <button key={preset.ratio} type="button" className={cn("creator-export-option", selectedRatio === preset.ratio && "is-selected")} aria-label={`${preset.ratio} ${arabic ? preset.titleAr : preset.title} · ${preset.ratio === currentRatio ? tr("Current video · Download", "النسخة المولّدة الحالية · تنزيل") : tr("New generated version · Separate quote", "نسخة توليد جديدة · تسعير منفصل")}`} aria-pressed={selectedRatio === preset.ratio} disabled={pending} onClick={() => { setError(false); onSelectRatio(preset.ratio); }}>
              <span className="creator-ratio-icon" dir="ltr">{preset.ratio}</span>
              <span className="creator-export-option-copy"><strong>{arabic ? preset.titleAr : preset.title}</strong><span>{preset.ratio === currentRatio ? tr("Current video · Download", "النسخة المولّدة الحالية · تنزيل") : tr("New generated version · Separate quote", "نسخة توليد جديدة · تسعير منفصل")}</span></span>
              {selectedRatio === preset.ratio && <CheckCircle2 className="creator-export-check" aria-hidden="true" />}
            </button>
          ))}
        </div>
        <div className="creator-summary-list creator-export-summary">
          <div className="creator-summary-row"><span>{tr("File", "الملف")}</span><strong>MP4 · H.264</strong></div>
          <div className="creator-summary-row"><span>{tr("Quality", "الجودة")}</span><strong>{resolution}</strong></div>
          <div className="creator-summary-row"><span>{tr("Audio", "الصوت")}</span><strong>{audio ? tr("Included", "مشمول") : tr("Muted", "مكتوم")}</strong></div>
        </div>
        {!isCurrent && <div className="creator-export-generation-note" role="note">
          <strong>{tr("This creates a new AI-generated version", "هذا ينشئ نسخة جديدة مولّدة بالذكاء الاصطناعي")}</strong>
          <span>{tr(`The ${selectedRatio} format is not a crop of your current video. MovPrompt will save a new version and request a separate confirmed quote before generation.`, `مقاس ${selectedRatio} ليس قصاً من الفيديو الحالي. سيحفظ MovPrompt نسخة جديدة ويطلب سعراً مؤكداً منفصلاً قبل التوليد.`)}</span>
        </div>}
        <div className="creator-export-footer">
          {error && <p role="alert" className="creator-export-error">{tr("Couldn’t complete this action. Your video remains saved. Please try again.", "تعذر إكمال الإجراء. الفيديو ما زال محفوظاً. حاول مرة ثانية.")}</p>}
          {previewOnly || !hasVideo ? <div className="creator-import-note" role="note"><strong>{tr("Preview only", "معاينة فقط")}</strong><span>{tr("A downloadable MP4 becomes available after your AI video is ready.", "يتوفر ملف MP4 للتنزيل بعد اكتمال توليد حقيقي بالذكاء الاصطناعي.")}</span></div> :
            <button className="creator-button creator-button-primary" type="button" disabled={pending} aria-busy={pending} onClick={() => void performAction()}>
              {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : isCurrent ? <Download aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
              {pending ? (isCurrent ? tr("Preparing download…", "جارٍ تجهيز التنزيل…") : tr("Preparing version…", "جارٍ تجهيز النسخة…")) : `${isCurrent ? tr("Download", "تنزيل") : tr("Get quote for", "احصل على سعر لنسخة")} ${selectedRatio}`}
            </button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
