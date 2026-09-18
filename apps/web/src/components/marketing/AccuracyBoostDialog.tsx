import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, AlertTriangle } from "lucide-react";
import type { AccuracyRiskResult } from "@/lib/marketing/accuracyRisk";

interface Props {
  open: boolean;
  result: AccuracyRiskResult | null;
  onCancel: () => void;
  onGenerateAnyway: (dontShowAgain: boolean) => void;
  onAddPhotos: () => void;
  onAddIdentity: () => void;
}

export function AccuracyBoostDialog({
  open,
  result,
  onCancel,
  onGenerateAnyway,
  onAddPhotos,
  onAddIdentity,
}: Props) {
  const [dontShow, setDontShow] = useState(false);
  if (!result) return null;

  const isHigh = result.level === "high";
  const Icon = isHigh ? AlertTriangle : Sparkles;
  const iconClass = isHigh ? "text-amber-400" : "text-cyan-400";

  const handleFix = () => {
    if (result.primaryFix === "add-identity") onAddIdentity();
    else onAddPhotos();
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-full bg-muted/30 p-2 ${iconClass}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <AlertDialogTitle>
                {isHigh ? "Boost product accuracy before generating?" : "One quick tip for a better ad"}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1">
                You can generate now with what you have — but the video will be closer to
                your real product if you address the points below.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <ul className="mt-1 space-y-3">
          {result.risks.map((r) => (
            <li
              key={r.code}
              className="rounded-lg border border-border/40 bg-muted/10 p-3 text-sm"
            >
              <div className="font-medium text-foreground">{r.title}</div>
              <div className="mt-0.5 text-muted-foreground text-[13px] leading-relaxed">
                {r.detail}
              </div>
            </li>
          ))}
        </ul>

        <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <Checkbox
            checked={dontShow}
            onCheckedChange={(c) => setDontShow(c === true)}
          />
          Don't show this again for this session
        </label>

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <button
            type="button"
            onClick={handleFix}
            className="inline-flex items-center justify-center rounded-md border border-border/60 bg-muted/30 px-4 h-9 text-sm font-medium hover:bg-muted/50 transition"
          >
            {result.primaryFix === "add-identity" ? "Set brand identity" : "Add references"}
          </button>
          <AlertDialogAction
            onClick={() => onGenerateAnyway(dontShow)}
            className="bg-[#F5A524] text-black hover:bg-[#F5A524]/90"
          >
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
