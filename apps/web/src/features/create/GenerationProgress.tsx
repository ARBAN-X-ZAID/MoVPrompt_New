import { useEffect, useState } from "react";
import type { RenderProcessingStage } from "@movprompt/contracts";
import { CircleAlert, Clock3, RefreshCw } from "lucide-react";

interface GenerationProgressProps {
  stage: RenderProcessingStage;
  startedAt: number | null;
  completedAt?: number | null;
  lastCheckedAt?: number | null;
  error?: string;
  arabic?: boolean;
  onRetry?: () => void;
  simulatedProgress?: number;
}

const STAGES: Record<RenderProcessingStage, [string, string]> = {
  preparing: ["Preparing your campaign", "جارٍ تجهيز الحملة"],
  rendering: ["Creating your video", "جارٍ إنشاء الفيديو"],
  securing_output: ["Saving your video securely", "جارٍ حفظ الفيديو بأمان"],
  quality_review: ["Checking video quality", "جارٍ فحص جودة الفيديو"],
  ready: ["Your video is ready", "الفيديو جاهز"],
  cancelling: ["Stopping generation", "جارٍ إيقاف التوليد"],
  failed: ["Video creation could not finish", "تعذر إكمال إنشاء الفيديو"],
  cancelled: ["Generation cancelled", "تم إلغاء التوليد"],
};

function duration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function estimate(stage: RenderProcessingStage, elapsed: number): number {
  if (stage === "ready") return 100;
  if (stage === "preparing") return Math.min(18, 5 + Math.floor(elapsed / 30 * 13));
  if (stage === "securing_output") return Math.min(90, 80 + Math.floor(elapsed / 300 * 10));
  if (stage === "quality_review") return Math.min(97, 92 + Math.floor(elapsed / 300 * 5));
  return Math.min(80, 20 + Math.floor(elapsed / 300 * 60));
}

export function GenerationProgress({ stage, startedAt, completedAt, lastCheckedAt, error = "", arabic = false, onRetry, simulatedProgress }: GenerationProgressProps) {
  const [now, setNow] = useState(Date.now);
  const terminal = ["ready", "failed", "cancelled"].includes(stage);
  const elapsed = Math.max(0, Math.floor(((completedAt ?? now) - (startedAt ?? now)) / 1000));
  const estimated = simulatedProgress ?? estimate(stage, elapsed);
  const [progress, setProgress] = useState(estimated);
  const tr = (en: string, ar: string) => arabic ? ar : en;

  useEffect(() => {
    setNow(Date.now());
    if (terminal) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [terminal, startedAt]);

  useEffect(() => {
    if (!error) setProgress(estimated);
  }, [estimated, error, startedAt]);

  const maximumMinutes = Math.ceil(Math.max(0, 300 - elapsed) / 60);
  const minimumMinutes = Math.ceil(Math.max(0, 120 - elapsed) / 60);
  const remaining = maximumMinutes === 0
    ? tr("Taking longer than usual", "يستغرق وقتاً أطول من المعتاد")
    : minimumMinutes > 0
      ? tr(`${minimumMinutes}–${maximumMinutes} min remaining`, `متبقي ${minimumMinutes}–${maximumMinutes} دقائق`)
      : tr(`Up to ${maximumMinutes} min remaining`, `متبقي حتى ${maximumMinutes} دقائق`);

  return (
    <div className="creator-render-progress" dir={arabic ? "rtl" : "ltr"}>
      <div className="creator-render-progress-heading">
        <span role="status">{STAGES[stage][arabic ? 1 : 0]}</span>
        <span className="creator-render-progress-percent">{tr("Estimated progress", "التقدم التقديري")} <strong>{progress}%</strong></span>
      </div>
      <div className="creator-generation-progress" role="progressbar" aria-label={tr("Estimated video creation progress", "تقدم إنشاء الفيديو التقديري")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${STAGES[stage][arabic ? 1 : 0]} · ${progress}% ${tr("estimated", "تقديري")}`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="creator-render-progress-timing">
        <div><Clock3 aria-hidden="true" /><span>{tr("Elapsed time", "الوقت المنقضي")}</span><strong dir="ltr">{duration(elapsed)}</strong></div>
        {!terminal && stage !== "cancelling" ? <div><span>{tr("Estimated time remaining", "الوقت المتبقي التقديري")}</span><strong>{remaining}</strong></div> : null}
      </div>
      {!terminal ? <p className="creator-render-progress-note">{tr("Progress and timing are estimates. Your video is ready only after generation, storage and quality checks finish.", "التقدم والوقت تقديريان. يصبح الفيديو جاهزاً بعد إكمال التوليد والحفظ وفحص الجودة.")}</p> : null}
      {!terminal && elapsed >= 300 && !error ? <p className="creator-render-progress-note">{tr("The queue or final checks may take longer. We are checking the saved job; you can return to Projects safely.", "قد يستغرق الانتظار أو الفحص النهائي وقتاً أطول. نتحقق من المهمة المحفوظة ويمكنك العودة إلى المشاريع بأمان.")}</p> : null}
      {lastCheckedAt && !terminal ? <small className="creator-render-progress-checked">{tr(`Last status check: ${Math.max(0, Math.floor((now - lastCheckedAt) / 1000))}s ago`, `آخر تحقق من الحالة: قبل ${Math.max(0, Math.floor((now - lastCheckedAt) / 1000))} ثانية`)}</small> : null}
      {error ? <div className="creator-render-progress-error" role="alert"><CircleAlert aria-hidden="true" /><span>{error}</span></div> : null}
      {error && !terminal && onRetry ? <button className="creator-button creator-button-secondary" type="button" onClick={onRetry}><RefreshCw aria-hidden="true" />{tr("Retry status check", "إعادة التحقق من الحالة")}</button> : null}
    </div>
  );
}
