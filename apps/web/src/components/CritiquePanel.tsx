import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles, ThumbsUp, ThumbsDown, Wand2, Lightbulb, Camera, Move, Compass, Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/i18n/LanguageContext";
import type { FixChip } from "@/lib/promptHeuristics";

export type CritiqueDimension = "lens" | "lighting" | "movement" | "continuity" | "mood" | "detail";

export interface CritiqueSuggestion {
  dimension: CritiqueDimension;
  label: string;
  addendum: string;
}
export interface CritiqueResult {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: CritiqueSuggestion[];
}

export interface ShotFeedback {
  liked: boolean | null;
  reasons: string[];
  note: string;
}

const dimIcon: Record<CritiqueDimension, React.ComponentType<{ className?: string }>> = {
  lens: Camera,
  lighting: Lightbulb,
  movement: Move,
  continuity: Compass,
  mood: Palette,
  detail: Sparkles,
};

const REASON_KEYS = ["generic", "mood", "continuity", "action", "lighting", "movement"] as const;

/** Inline auto-fix chip row driven by client-side heuristics. */
export const AutoFixChips = ({
  chips,
  onApply,
  applyingDim,
  disabled,
}: {
  chips: FixChip[];
  onApply: (chip: FixChip) => void;
  applyingDim: string | null;
  disabled?: boolean;
}) => {
  const { t } = useLanguage();
  if (chips.length === 0) return null;
  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <Wand2 className="w-3.5 h-3.5 text-accent" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
          {t("results.autofix.title" as any)}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">{t("results.autofix.hint" as any)}</p>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => {
          const isApplying = applyingDim === c.dimension;
          return (
            <Tooltip key={c.dimension}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={disabled || isApplying}
                  onClick={() => onApply(c)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-card hover:bg-accent/10 hover:border-accent/60 px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isApplying ? (
                    <Loader2 className="w-3 h-3 animate-spin text-accent" />
                  ) : (
                    <Sparkles className="w-3 h-3 text-accent" />
                  )}
                  {t(`results.autofix.${c.label}` as any)}
                </button>
              </TooltipTrigger>
              <TooltipContent><p className="max-w-xs text-xs">{c.addendum}</p></TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};

/** Thumbs up/down + reason chips for a single shot. */
export const FeedbackBar = ({
  feedback,
  onChange,
}: {
  feedback: ShotFeedback;
  onChange: (next: ShotFeedback) => void;
}) => {
  const { t } = useLanguage();
  const liked = feedback.liked;
  const toggle = (next: boolean) => {
    if (liked === next) {
      onChange({ liked: null, reasons: [], note: "" });
    } else {
      onChange({ ...feedback, liked: next, reasons: next ? [] : feedback.reasons });
    }
  };
  const toggleReason = (key: string) => {
    const has = feedback.reasons.includes(key);
    onChange({
      ...feedback,
      reasons: has ? feedback.reasons.filter((r) => r !== key) : [...feedback.reasons, key],
    });
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => toggle(true)}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors ${
                liked === true
                  ? "border-green-500/60 bg-green-500/10 text-green-400"
                  : "border-border bg-card hover:bg-secondary text-muted-foreground"
              }`}
              aria-pressed={liked === true}
            >
              <ThumbsUp className="w-3.5 h-3.5" /> {t("results.feedback.up" as any)}
            </button>
          </TooltipTrigger>
          <TooltipContent><p className="max-w-xs text-xs">{t("results.feedback.upHint" as any)}</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => toggle(false)}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors ${
                liked === false
                  ? "border-destructive/60 bg-destructive/10 text-destructive"
                  : "border-border bg-card hover:bg-secondary text-muted-foreground"
              }`}
              aria-pressed={liked === false}
            >
              <ThumbsDown className="w-3.5 h-3.5" /> {t("results.feedback.down" as any)}
            </button>
          </TooltipTrigger>
          <TooltipContent><p className="max-w-xs text-xs">{t("results.feedback.downHint" as any)}</p></TooltipContent>
        </Tooltip>
        {(liked !== null || feedback.reasons.length > 0 || feedback.note) && (
          <button
            type="button"
            onClick={() => onChange({ liked: null, reasons: [], note: "" })}
            className="ms-auto text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            {t("results.feedback.clear" as any)}
          </button>
        )}
      </div>
      {liked === false && (
        <motion.div
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5"
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider text-destructive">
            {t("results.feedback.reasonsTitle" as any)}
          </div>
          <div className="flex flex-wrap gap-1">
            {REASON_KEYS.map((k) => {
              const active = feedback.reasons.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleReason(k)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
                    active
                      ? "border-destructive/60 bg-destructive/15 text-destructive"
                      : "border-border bg-card hover:bg-secondary text-muted-foreground"
                  }`}
                >
                  {active && <Check className="w-2.5 h-2.5" />}
                  {t(`results.feedback.reason.${k}` as any)}
                </button>
              );
            })}
          </div>
          <textarea
            value={feedback.note}
            onChange={(e) => onChange({ ...feedback, note: e.target.value.slice(0, 280) })}
            placeholder={t("results.feedback.notePlaceholder" as any)}
            rows={2}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-destructive/50 resize-none"
          />
          <p className="text-[10px] text-muted-foreground italic">
            {t("results.feedback.appliedNext" as any)}
          </p>
        </motion.div>
      )}
    </div>
  );
};

/** AI critique dialog: runs critique-prompt and lets user apply suggestion addenda. */
export const CritiqueDialog = ({
  open,
  onOpenChange,
  critique,
  loading,
  error,
  onRun,
  onApply,
  applyingAddendum,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  critique: CritiqueResult | null;
  loading: boolean;
  error: string | null;
  onRun: () => void;
  onApply: (s: CritiqueSuggestion) => void;
  applyingAddendum: string | null;
}) => {
  const { t } = useLanguage();

  const scoreColor = (s: number) =>
    s >= 90 ? "text-green-400 border-green-500/40 bg-green-500/10"
    : s >= 75 ? "text-primary border-primary/40 bg-primary/10"
    : s >= 60 ? "text-accent border-accent/40 bg-accent/10"
    : "text-destructive border-destructive/40 bg-destructive/10";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {t("results.critique.title" as any)}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("results.critique.subtitle" as any)}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t("results.critique.loading" as any)}</p>
          </div>
        )}

        {!loading && !critique && !error && (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-sm text-muted-foreground text-center">{t("results.critique.empty" as any)}</p>
            <Button onClick={onRun} className="gap-1.5">
              <Sparkles className="w-4 h-4" /> {t("results.critique.run" as any)}
            </Button>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-3 py-6">
            <p className="text-sm text-destructive">{t("results.critique.failed" as any)}</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={onRun}>{t("results.critique.rerun" as any)}</Button>
          </div>
        )}

        {!loading && critique && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-4">
              <div className={`flex flex-col items-center justify-center w-20 h-20 rounded-full border-2 ${scoreColor(critique.score)} font-display`}>
                <span className="text-2xl font-bold leading-none">{critique.score}</span>
                <span className="text-[9px] uppercase tracking-wider opacity-80 mt-0.5">/ 100</span>
              </div>
              <div className="flex-1 space-y-1.5">
                {critique.strengths.length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-green-400 mb-0.5">
                      {t("results.critique.strengths" as any)}
                    </div>
                    <ul className="text-xs text-foreground/85 space-y-0.5 list-disc list-inside">
                      {critique.strengths.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {critique.weaknesses.length > 0 && (
              <div className="rounded-md border border-destructive/20 bg-destructive/5 p-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-destructive mb-1">
                  {t("results.critique.weaknesses" as any)}
                </div>
                <ul className="text-xs text-foreground/85 space-y-0.5 list-disc list-inside">
                  {critique.weaknesses.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}

            {critique.suggestions.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5" /> {t("results.critique.suggestions" as any)}
                </div>
                {critique.suggestions.map((s, i) => {
                  const Icon = dimIcon[s.dimension] ?? Sparkles;
                  const isApplying = applyingAddendum === s.addendum;
                  return (
                    <div key={i} className="rounded-md border border-primary/20 bg-card p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-[10px] font-mono uppercase tracking-wider text-primary">
                            {t(`results.critique.dim.${s.dimension}` as any)}
                          </span>
                          <span className="text-sm font-medium text-foreground truncate">{s.label}</span>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isApplying}
                              onClick={() => onApply(s)}
                              className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10 h-7 text-xs shrink-0"
                            >
                              {isApplying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                              {t("results.critique.applyFix" as any)}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p className="max-w-xs text-xs">{t("results.critique.applyFixHint" as any)}</p></TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed">{s.addendum}</p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={onRun} className="text-xs gap-1.5">
                <Sparkles className="w-3 h-3" /> {t("results.critique.rerun" as any)}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
