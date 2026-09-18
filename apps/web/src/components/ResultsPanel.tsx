import { Copy, Check, RefreshCw, Sparkles, ChevronDown, ClipboardCheck, Wand2, AlertTriangle, History as HistoryIcon, GitCompare, Repeat, Share2 } from "lucide-react";
import { getModelLabel } from "@/lib/models";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, forwardRef, useMemo } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import { getCharLimit } from "@/lib/modelLimits";
import { detectMissingDimensions, type FixChip } from "@/lib/promptHeuristics";
import { AutoFixChips, FeedbackBar, CritiqueDialog, type CritiqueResult, type CritiqueSuggestion, type ShotFeedback } from "./CritiquePanel";

interface ShotResult {
  shotName?: string;
  mainPrompt: string;
  negativePrompt: string;
  cameraSuggestions: string;
  modelNotes: string;
  suggestedAspectRatio?: string;
  suggestedDuration?: string;
  audioBlock?: string;
  cameraTags?: string;
  referenceGuidance?: string;
  shotStructure?: string;
  recommendedModel?: string;
  recommendedModelReason?: string;
}

interface GenerationSnapshot {
  id: string;
  results: ShotResult[];
  agentName: string | null;
  modelValue: string;
  modelLabel: string;
  workflowType: string;
  createdAt: number;
}

interface ShotCritiqueState {
  result: CritiqueResult | null;
  loading: boolean;
  error: string | null;
}

interface ResultsPanelProps {
  results: ShotResult[];
  onRegenerate: () => void;
  onRegenerateCompact?: () => void;
  isLoading: boolean;
  agentName?: string;
  modelLabel?: string;
  modelValue?: string;
  stitchHint?: boolean;
  elementsLegend?: { index: number; kind: "image" | "video" | "audio"; preview?: string }[];
  onSwitchModel?: (value: string) => void;
  history?: GenerationSnapshot[];
  onRestoreSnapshot?: (id: string) => void;
  isMultiShot?: boolean;
  regeneratingShotIdx?: number | null;
  onRegenerateShot?: (shotIdx: number) => void;
  // Quality & evaluation loop
  feedbackByShot?: Record<number, ShotFeedback>;
  onFeedbackChange?: (shotIdx: number, next: ShotFeedback) => void;
  critiqueByShot?: Record<number, ShotCritiqueState>;
  onRunCritique?: (shotIdx: number) => void;
  onApplyAddendum?: (shotIdx: number, addendum: string) => void;
  applyingAddendumByShot?: Record<number, string | null>;
  onShare?: () => void;
}

const CopyButton = ({ text }: { text: string }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={handleCopy} className="p-1.5 rounded-md hover:bg-accent/10 transition-colors text-muted-foreground hover:text-accent">
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </TooltipTrigger>
      <TooltipContent><p className="text-xs">{t("results.copySection.tooltip" as any)}</p></TooltipContent>
    </Tooltip>
  );
};

const ResultCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg p-3 sm:p-4 bg-secondary/50 border border-border">
    <div className="flex items-start justify-between gap-2 mb-2">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <CopyButton text={value} />
    </div>
    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{value}</p>
  </div>
);

const isMeaningful = (v?: string) => !!v && v.trim().length > 0 && v.trim().toLowerCase() !== "(none)";

// Parse a mainPrompt that uses [BRACKETED SECTION HEADERS] (Seedance shooting-script format)
// into discrete sections. Returns null if the text doesn't follow the format.
const parseScriptedPrompt = (text: string): { header: string; body: string }[] | null => {
  if (!text) return null;
  // Header line: starts the line, wrapped in [ ... ], may include — | timecodes
  const headerRe = /^\[([^\]\n]{2,160})\]\s*$/gm;
  const matches: { header: string; index: number; length: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(text)) !== null) {
    matches.push({ header: m[1].trim(), index: m.index, length: m[0].length });
  }
  if (matches.length < 3) return null; // need a real script with multiple sections
  const sections: { header: string; body: string }[] = [];
  // Optional preamble before first header
  if (matches[0].index > 0) {
    const pre = text.slice(0, matches[0].index).trim();
    if (pre.length > 0) sections.push({ header: "INTRO", body: pre });
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    sections.push({ header: matches[i].header, body: text.slice(start, end).trim() });
  }
  return sections;
};

const COMMON_FIX_CHIPS: FixChip[] = [
  { dimension: "mood", label: "mood", addendum: "Anchor the emotional tone with one specific mood word and tie one visual element (lighting, framing, or sound) to that emotion." },
  { dimension: "lighting", label: "lighting", addendum: "Add explicit lighting design: key light direction and quality (hard / soft), fill ratio, practicals, and color temperature." },
  { dimension: "lens", label: "lens", addendum: "Specify a concrete lens choice (focal length, prime/zoom) and a depth-of-field intent (shallow / deep)." },
  { dimension: "movement", label: "movement", addendum: "Add a specific named camera movement (slow dolly-in, lateral tracking, locked-off static) with pace and starting/ending framing." },
  { dimension: "action", label: "action", addendum: "Replace any vague action with one concrete, observable verb beat for the subject. Avoid 'cinematic moment' or 'unfolds'." },
];
const mergeWithCommonChips = (detected: FixChip[]): FixChip[] => {
  const map = new Map<string, FixChip>();
  detected.forEach((c) => map.set(c.dimension, c));
  for (const c of COMMON_FIX_CHIPS) {
    if (map.size >= 5) break;
    if (!map.has(c.dimension)) map.set(c.dimension, c);
  }
  return Array.from(map.values()).slice(0, 5);
};

const TECHNICAL_HEADERS = new Set(["NEGATIVE PROMPT", "AUDIO DIRECTION", "SHOT STRUCTURE", "CAMERA SUGGESTIONS", "INTRO"]);
const isTechnicalHeader = (h: string) => {
  const up = h.trim().toUpperCase();
  if (TECHNICAL_HEADERS.has(up)) return true;
  // Treat anything matching a known tech header as technical even with extra text
  return Array.from(TECHNICAL_HEADERS).some((k) => up.startsWith(k));
};
const formatNarrativeHeader = (h: string) =>
  h.trim().toUpperCase().replace(/\s*[—–-]\s*/g, " · ");

const ScriptedPrompt = ({ sections }: { sections: { header: string; body: string }[] }) => {
  // Default: narrative scenes expanded, technical sections collapsed
  const [openMap, setOpenMap] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(sections.map((s, i) => [i, !isTechnicalHeader(s.header)]))
  );
  const toggle = (i: number) => setOpenMap((p) => ({ ...p, [i]: !p[i] }));
  return (
    <div className="space-y-2">
      {sections.map((s, i) => {
        const tech = isTechnicalHeader(s.header);
        return (
          <Collapsible key={i} open={!!openMap[i]} onOpenChange={() => toggle(i)}>
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 bg-background/60 hover:bg-muted border border-accent/20 hover:border-accent/40 transition-colors group cursor-pointer">
              {tech ? (
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-accent font-mono text-start">
                  [{s.header}]
                </span>
              ) : (
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent text-start">
                  {formatNarrativeHeader(s.header)}
                </span>
              )}
              <div className="flex items-center gap-1.5 shrink-0">
                <CopyButton text={s.body} />
                <ChevronDown className={`w-4 h-4 text-accent transition-transform ${openMap[i] ? "rotate-180" : ""}`} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap px-3 pt-2 pb-1">{s.body}</p>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
};

const MainPromptHero = ({ value, result, modelLabel, modelValue, onSwitchModel, onRegenerateCompact, isRegenerating }: { value: string; result: ShotResult; modelLabel?: string; modelValue?: string; onSwitchModel?: (value: string) => void; onRegenerateCompact?: () => void; isRegenerating?: boolean }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const buildFullPrompt = () => {
    let out = value;
    if (isMeaningful(result.negativePrompt)) out += `\n\n[NEGATIVE PROMPT]\n${result.negativePrompt}`;
    if (isMeaningful(result.audioBlock)) out += `\n\n[AUDIO DIRECTION]\n${result.audioBlock}`;
    if (isMeaningful(result.shotStructure)) out += `\n\n[SHOT STRUCTURE]\n${result.shotStructure}`;
    if (isMeaningful(result.cameraSuggestions)) out += `\n\n[CAMERA SUGGESTIONS]\n${result.cameraSuggestions}`;
    return out;
  };
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildFullPrompt());
      setCopied(true);
      toast.success(t("results.copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("results.failedCopy"));
    }
  };
  const parsed = parseScriptedPrompt(value);
  const appended: { header: string; body: string }[] = [];
  if (isMeaningful(result.negativePrompt)) appended.push({ header: "NEGATIVE PROMPT", body: result.negativePrompt });
  if (isMeaningful(result.audioBlock)) appended.push({ header: "AUDIO DIRECTION", body: result.audioBlock! });
  if (isMeaningful(result.shotStructure)) appended.push({ header: "SHOT STRUCTURE", body: result.shotStructure! });
  if (isMeaningful(result.cameraSuggestions)) appended.push({ header: "CAMERA SUGGESTIONS", body: result.cameraSuggestions });
  const totalSections = (parsed?.length ?? 0) + appended.length;
  return (
    <div className="relative rounded-xl p-4 sm:p-5 bg-accent/10 border border-accent/30">
      {result.recommendedModel && (
        <div className="mb-3 rounded-lg border-s-4 border-primary bg-primary/5 border border-primary/30 px-3 py-2.5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <Wand2 className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-[11px] font-bold font-display uppercase tracking-wider text-primary">
                  {t("results.directorPick")}: {getModelLabel(result.recommendedModel)}
                </span>
              </div>
              {modelValue === "any" && (
                <p className="text-[11px] text-muted-foreground mb-1 italic">
                  You picked Universal — this prompt works on any model. The Director suggests starting here for the best result.
                </p>
              )}
              {result.recommendedModelReason && (
                <p className="text-xs text-foreground/85 leading-relaxed">{result.recommendedModelReason}</p>
              )}
            </div>
            {onSwitchModel && modelValue !== result.recommendedModel && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onSwitchModel(result.recommendedModel!);
                  toast.success(t("results.switchedToast"));
                }}
                className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary shrink-0"
              >
                <Wand2 className="w-3 h-3" /> {t("results.useThisModel")}
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" /> {t("results.mainPrompt")}
          {totalSections > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/15 text-primary">
              {totalSections} sections
            </span>
          )}
        </span>
      </div>
      {parsed ? (
        <div className="mb-3">
          <ScriptedPrompt sections={[...parsed, ...appended]} />
        </div>
      ) : (
        <>
          <p className="text-sm sm:text-base text-foreground leading-relaxed whitespace-pre-wrap mb-3">{value}</p>
          {appended.length > 0 && (
            <div className="mb-3">
              <ScriptedPrompt sections={appended} />
            </div>
          )}
        </>
      )}
      {(() => {
        const limit = modelValue ? getCharLimit(modelValue) : undefined;
        const len = value.length;
        const over = !!limit && len > limit;
        if (!limit) return <p className="text-xs text-muted-foreground italic mb-3">{t("results.pasteHint")}</p>;
        const ratio = len / limit;
        const counterColor = ratio > 0.95
          ? "text-destructive font-semibold"
          : ratio >= 0.8
            ? "text-accent font-medium"
            : "text-muted-foreground";
        return (
          <div className="mb-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
              <span className={`font-mono inline-flex items-center gap-1.5 ${counterColor}`}>
                {over && <AlertTriangle className="w-3.5 h-3.5" />}
                {len.toLocaleString()} / {limit.toLocaleString()} {t("results.chars")}
              </span>
              <span className="text-muted-foreground italic">{t("results.pasteHint")}</span>
            </div>
            {over && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 flex items-start justify-between gap-2 flex-wrap">
                <p className="text-xs text-foreground/90 leading-relaxed flex-1 min-w-[12rem]">
                  {t("results.overLimit")}
                </p>
                {onRegenerateCompact && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onRegenerateCompact}
                    disabled={isRegenerating}
                    className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
                    {t("results.regenerateCompact")}
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })()}
      <Button
        onClick={handleCopy}
        size="lg"
        className={`w-full gap-2 font-semibold ${copied ? "bg-green-500/90 hover:bg-green-500/90" : ""}`}
      >
        {copied ? <Check className="w-4 h-4" /> : <ClipboardCheck className="w-4 h-4" />}
        {copied
          ? t("results.copied")
          : modelLabel
            ? `${t("results.copyIntoModel")} ${modelLabel}`
            : t("results.copyMainPrompt")}
      </Button>
    </div>
  );
};

const SectionToggle = ({ label, count, open }: { label: string; count?: number; open: boolean }) => (
  <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 bg-secondary/30 hover:bg-muted border border-border transition-colors group cursor-pointer">
    <span className="text-sm font-medium text-foreground flex items-center gap-2">
      {label}
      {typeof count === "number" && count > 0 && (
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{count}</span>
      )}
    </span>
    <ChevronDown className={`w-4 h-4 text-accent transition-transform ${open ? "rotate-180" : ""}`} />
  </CollapsibleTrigger>
);

export const ResultsPanel = forwardRef<HTMLDivElement, ResultsPanelProps>(({ results, onRegenerate, onRegenerateCompact, isLoading, agentName, modelLabel, modelValue, stitchHint, elementsLegend, onSwitchModel, history, onRestoreSnapshot, isMultiShot, regeneratingShotIdx, onRegenerateShot, feedbackByShot, onFeedbackChange, critiqueByShot, onRunCritique, onApplyAddendum, applyingAddendumByShot, onShare }, ref) => {
  const { t } = useLanguage();
  const [allCopied, setAllCopied] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareLeftId, setCompareLeftId] = useState<string | null>(null);
  const [compareRightId, setCompareRightId] = useState<string | null>(null);

  const formatRelative = (ts: number) => {
    const diff = Math.max(0, Date.now() - ts);
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ${t("results.history.ago" as any)}`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${t("results.history.ago" as any)}`;
    const h = Math.floor(m / 60);
    return `${h}h ${t("results.history.ago" as any)}`;
  };

  const openCompare = () => {
    if (!history || history.length < 2) return;
    setCompareLeftId(history[1].id);
    setCompareRightId(history[0].id);
    setCompareOpen(true);
  };
  const leftSnap = history?.find((h) => h.id === compareLeftId) ?? null;
  const rightSnap = history?.find((h) => h.id === compareRightId) ?? null;

  const handleCopyAll = async () => {
    const allText = results.map((r, i) => {
      const prefix = r.shotName ? `--- ${r.shotName} ---\n` : results.length > 1 ? `--- ${t("library.shot")} ${i + 1} ---\n` : "";
      let block = `${prefix}${t("results.mainPrompt")}:\n${r.mainPrompt}\n\n${t("results.negativePrompt")}:\n${r.negativePrompt}\n\n${t("results.cameraSuggestions")}:\n${r.cameraSuggestions}\n\n${t("results.modelNotes")}:\n${r.modelNotes}`;
      if (isMeaningful(r.audioBlock)) block += `\n\n${t("results.audioBlock")}:\n${r.audioBlock}`;
      if (isMeaningful(r.cameraTags)) block += `\n\n${t("results.cameraTags")}:\n${r.cameraTags}`;
      if (isMeaningful(r.referenceGuidance)) block += `\n\n${t("results.referenceGuidance")}:\n${r.referenceGuidance}`;
      if (isMeaningful(r.shotStructure)) block += `\n\n${t("results.shotStructure")}:\n${r.shotStructure}`;
      return block;
    }).join("\n\n");
    try {
      await navigator.clipboard.writeText(allText);
      setAllCopied(true);
      toast.success(t("results.copied"));
      setTimeout(() => setAllCopied(false), 2000);
    } catch {
      toast.error(t("results.failedCopy"));
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <motion.div ref={ref} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-base sm:text-lg font-semibold">{t("results.title")}</h3>
            {agentName && (
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" /> {t("results.generatedBy")} {agentName}
              </span>
            )}
          </div>
          <div className="flex gap-1.5 sm:gap-2 flex-wrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleCopyAll} className={`px-2 sm:px-3 ${allCopied ? "border-green-500/50 text-green-400" : ""}`}>
                  {allCopied ? <Check className="w-3.5 h-3.5 sm:me-1.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 sm:me-1.5" />}
                  <span className="hidden sm:inline">{allCopied ? t("results.copied") : t("results.copyFullPackage")}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent><p className="max-w-xs">{t("results.copyFullPackageHint")}</p></TooltipContent>
            </Tooltip>

            {history && history.length > 0 && onRestoreSnapshot && (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="px-2 sm:px-3">
                        <HistoryIcon className="w-3.5 h-3.5 sm:me-1.5" />
                        <span className="hidden sm:inline">{t("results.history.label" as any)}</span>
                        <span className="ms-1 text-[10px] font-mono px-1 rounded bg-muted text-muted-foreground">{history.length}</span>
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent><p className="max-w-xs">{t("results.history.hint" as any)}</p></TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                    {t("results.history.title" as any)}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {history.map((snap, i) => (
                    <DropdownMenuItem
                      key={snap.id}
                      onClick={() => onRestoreSnapshot(snap.id)}
                      className="flex flex-col items-start gap-0.5 py-2"
                    >
                      <div className="flex items-center justify-between w-full gap-2">
                        <span className="text-sm font-medium">
                          {i === 0 ? t("results.history.current" as any) : `${t("results.history.version" as any)} ${history.length - i}`}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">{formatRelative(snap.createdAt)}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate w-full">
                        {snap.modelLabel} · {snap.results.length} {snap.results.length === 1 ? t("library.shot") : t("library.shots" as any)}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {history && history.length >= 2 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={openCompare} className="px-2 sm:px-3">
                    <GitCompare className="w-3.5 h-3.5 sm:me-1.5" />
                    <span className="hidden sm:inline">{t("results.compare.label" as any)}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p className="max-w-xs">{t("results.compare.hint" as any)}</p></TooltipContent>
              </Tooltip>
            )}

            {onShare && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={onShare} className="px-2 sm:px-3">
                    <Share2 className="w-3.5 h-3.5 sm:me-1.5" />
                    <span className="hidden sm:inline">{t("results.share.label" as any) || "Share"}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p className="max-w-xs">{t("results.share.hint" as any) || "Create a public link to these prompts"}</p></TooltipContent>
              </Tooltip>
            )}

            <Button variant="outline" size="sm" onClick={onRegenerate} disabled={isLoading} className="px-2 sm:px-3">
              <RefreshCw className={`w-3.5 h-3.5 sm:me-1.5 ${isLoading ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">{t("results.regenerate")}</span>
            </Button>
          </div>
        </div>

        {stitchHint && (
          <div className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-foreground/90 flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
            <span>{t("results.multishotStitchHint")}</span>
          </div>
        )}

        {elementsLegend && elementsLegend.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("elements.legend" as any)}
            </div>
            <div className="flex flex-wrap gap-2">
              {elementsLegend.map((el) => (
                <div key={el.index} className="flex items-center gap-1.5 rounded-md border border-border bg-card px-1.5 py-1">
                  <span className="text-[10px] font-mono font-bold text-foreground">@Element {el.index}</span>
                  <div className="w-6 h-6 rounded overflow-hidden bg-secondary flex items-center justify-center">
                    {el.kind === "image" && el.preview && <img src={el.preview} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                    {el.kind === "video" && el.preview && <video src={el.preview} preload="metadata" className="w-full h-full object-cover" muted />}
                    {el.kind === "audio" && <span className="text-[9px]">🔊</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {results.map((result, idx) => {
          const refinements: { label: string; value: string }[] = [];
          if (isMeaningful(result.cameraTags)) refinements.push({ label: t("results.cameraTags"), value: result.cameraTags! });
          if (isMeaningful(result.referenceGuidance)) refinements.push({ label: t("results.referenceGuidance"), value: result.referenceGuidance! });

          return <ShotCard
            key={idx}
            result={result}
            idx={idx}
            total={results.length}
            refinements={refinements}
            modelLabel={modelLabel}
            modelValue={modelValue}
            onSwitchModel={idx === 0 ? onSwitchModel : undefined}
            onRegenerateCompact={onRegenerateCompact}
            isRegenerating={isLoading}
            onRegenerateShot={isMultiShot && results.length > 1 && onRegenerateShot ? () => onRegenerateShot(idx) : undefined}
            isThisShotRegenerating={regeneratingShotIdx === idx}
            feedback={feedbackByShot?.[idx] ?? { liked: null, reasons: [], note: "" }}
            onFeedbackChange={onFeedbackChange ? (next) => onFeedbackChange(idx, next) : undefined}
            critique={critiqueByShot?.[idx] ?? null}
            onRunCritique={onRunCritique ? () => onRunCritique(idx) : undefined}
            onApplyAddendum={onApplyAddendum ? (text) => onApplyAddendum(idx, text) : undefined}
            applyingAddendum={applyingAddendumByShot?.[idx] ?? null}
          />;
        })}
      </motion.div>

      {/* Compare dialog */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-primary" />
              {t("results.compare.title" as any)}
            </DialogTitle>
          </DialogHeader>
          {history && history.length >= 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {[
                { side: "left" as const, snap: leftSnap, setId: setCompareLeftId, id: compareLeftId },
                { side: "right" as const, snap: rightSnap, setId: setCompareRightId, id: compareRightId },
              ].map(({ side, snap, setId, id }) => (
                <div key={side} className="space-y-2 min-w-0">
                  <Select value={id ?? undefined} onValueChange={setId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={t("results.compare.pick" as any)} />
                    </SelectTrigger>
                    <SelectContent>
                      {history.map((h, i) => (
                        <SelectItem key={h.id} value={h.id}>
                          {i === 0 ? t("results.history.current" as any) : `${t("results.history.version" as any)} ${history.length - i}`}
                          {" · "}{h.modelLabel}
                          {" · "}{formatRelative(h.createdAt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {snap ? (
                    <div className="space-y-2">
                      {snap.results.map((r, ri) => (
                        <div key={ri} className="rounded-md border border-border bg-card p-2.5">
                          <div className="flex items-center justify-between mb-1.5 gap-2">
                            <span className="text-[10px] uppercase tracking-wider text-accent font-display">
                              {r.shotName || `${t("library.shot")} ${ri + 1}`}
                            </span>
                            <CopyButton text={r.mainPrompt} />
                          </div>
                          <p className="text-[12px] leading-relaxed whitespace-pre-wrap text-foreground/90">
                            {r.mainPrompt}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic p-3">—</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
});

const ShotCard = ({
  result,
  idx,
  total,
  refinements,
  modelLabel,
  modelValue,
  onSwitchModel,
  onRegenerateCompact,
  isRegenerating,
  onRegenerateShot,
  isThisShotRegenerating,
  feedback,
  onFeedbackChange,
  critique,
  onRunCritique,
  onApplyAddendum,
  applyingAddendum,
}: {
  result: ShotResult;
  idx: number;
  total: number;
  refinements: { label: string; value: string }[];
  modelLabel?: string;
  modelValue?: string;
  onSwitchModel?: (value: string) => void;
  onRegenerateCompact?: () => void;
  isRegenerating?: boolean;
  onRegenerateShot?: () => void;
  isThisShotRegenerating?: boolean;
  feedback: ShotFeedback;
  onFeedbackChange?: (next: ShotFeedback) => void;
  critique: ShotCritiqueState | null;
  onRunCritique?: () => void;
  onApplyAddendum?: (addendum: string) => void;
  applyingAddendum: string | null;
}) => {
  const { t } = useLanguage();
  const [refinementsOpen, setRefinementsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [critiqueOpen, setCritiqueOpen] = useState(false);

  const fixChips: FixChip[] = useMemo(
    () =>
      detectMissingDimensions({
        mainPrompt: result.mainPrompt,
        cameraSuggestions: result.cameraSuggestions,
        cameraTags: result.cameraTags,
        shotStructure: result.shotStructure,
      }),
    [result.mainPrompt, result.cameraSuggestions, result.cameraTags, result.shotStructure],
  );

  const handleApplyFix = (addendum: string) => {
    if (!onApplyAddendum) return;
    onApplyAddendum(addendum);
  };
  const handleOpenCritique = () => {
    setCritiqueOpen(true);
    if (!critique?.result && !critique?.loading && onRunCritique) onRunCritique();
  };

  return (
    <Card className={`bg-card border-border relative ${isThisShotRegenerating ? "opacity-70" : ""}`}>
      {isThisShotRegenerating && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/40 backdrop-blur-[1px] pointer-events-none">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs text-foreground shadow">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            {t("results.shotRegen.inProgress" as any)}
          </div>
        </div>
      )}
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2 flex-wrap">
          {total > 1 && (
            <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
              {idx + 1}/{total}
            </span>
          )}
          <span className="text-accent flex-1">{result.shotName || `${t("library.shot")} ${idx + 1}`}</span>
          {onRunCritique && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenCritique}
                  disabled={isThisShotRegenerating}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                >
                  <Sparkles className="w-3.5 h-3.5 sm:me-1" />
                  <span className="hidden sm:inline">{t("results.critique.button" as any)}</span>
                  {critique?.result && (
                    <span className="ms-1 text-[10px] font-mono px-1 rounded bg-primary/15 text-primary">
                      {critique.result.score}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent><p className="max-w-xs">{t("results.critique.hint" as any)}</p></TooltipContent>
            </Tooltip>
          )}
          {onRegenerateShot && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRegenerateShot}
                  disabled={isRegenerating || isThisShotRegenerating}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                >
                  <Repeat className={`w-3.5 h-3.5 sm:me-1 ${isThisShotRegenerating ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">{t("results.shotRegen.label" as any)}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent><p className="max-w-xs">{t("results.shotRegen.hint" as any)}</p></TooltipContent>
            </Tooltip>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {(result.suggestedAspectRatio || result.suggestedDuration) && (
            <div className="flex items-center gap-3 flex-wrap">
              {result.suggestedAspectRatio && (
                <span className="text-xs font-mono bg-muted/50 text-muted-foreground border border-border px-2.5 py-1 rounded-md inline-flex items-center gap-1 leading-none">
                  <span className="text-[11px]">📐</span>{result.suggestedAspectRatio}
                </span>
              )}
              {result.suggestedDuration && (
                <span className="text-xs font-mono bg-accent/10 text-accent border border-accent/20 px-2.5 py-1 rounded-md inline-flex items-center gap-1 leading-none">
                  <span className="text-[11px]">⏱</span>{result.suggestedDuration}
                </span>
              )}
            </div>
          )}

          <MainPromptHero value={result.mainPrompt} result={result} modelLabel={modelLabel} modelValue={modelValue} onSwitchModel={onSwitchModel} onRegenerateCompact={onRegenerateCompact} isRegenerating={isRegenerating} />

          {refinements.length > 0 && (
            <Collapsible open={refinementsOpen} onOpenChange={setRefinementsOpen}>
              <SectionToggle label={t("results.optionalRefinements")} count={refinements.length} open={refinementsOpen} />
              <CollapsibleContent className="pt-3 grid gap-3">
                {refinements.map((r) => (
                  <ResultCard key={r.label} label={r.label} value={r.value} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
            <SectionToggle label={t("results.directorsNotes")} count={1} open={notesOpen} />
            <CollapsibleContent className="pt-3 grid gap-3">
              <ResultCard label={t("results.modelNotes")} value={result.modelNotes} />
            </CollapsibleContent>
          </Collapsible>

          {onApplyAddendum && (
            fixChips.length < 2 ? (
              <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                    {t("results.quickFixes.title" as any)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">{t("results.quickFixes.complete" as any)}</p>
              </div>
            ) : (
              <AutoFixChips
                chips={mergeWithCommonChips(fixChips)}
                onApply={(c) => handleApplyFix(c.addendum)}
                applyingDim={applyingAddendum && mergeWithCommonChips(fixChips).find((c) => c.addendum === applyingAddendum)?.dimension || null}
                disabled={isRegenerating || isThisShotRegenerating}
              />
            )
          )}

          {onFeedbackChange && (
            <div className="space-y-1.5">
              <p className="text-[13px] text-muted-foreground">{t("results.feedbackPrompt" as any)}</p>
              <FeedbackBar feedback={feedback} onChange={onFeedbackChange} />
            </div>
          )}
        </div>
      </CardContent>

      {onRunCritique && (
        <CritiqueDialog
          open={critiqueOpen}
          onOpenChange={setCritiqueOpen}
          critique={critique?.result ?? null}
          loading={!!critique?.loading}
          error={critique?.error ?? null}
          onRun={onRunCritique}
          onApply={(s) => {
            setCritiqueOpen(false);
            handleApplyFix(s.addendum);
          }}
          applyingAddendum={applyingAddendum}
        />
      )}
    </Card>
  );
};

ResultsPanel.displayName = "ResultsPanel";
