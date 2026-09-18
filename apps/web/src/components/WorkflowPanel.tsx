import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ImageUploadZone } from "./ImageUploadZone";
import { ConfigPanel } from "./ConfigPanel";
import { ResultsPanel } from "./ResultsPanel";
import { ShareDialog } from "./ShareDialog";
import { ResultsSkeleton } from "./ResultsSkeleton";
import { StoryboardSkeleton } from "./StoryboardSkeleton";
import { AnalyzingSkeleton } from "./AnalyzingSkeleton";
import { SceneBreakdown, type SceneFrame, type ElementDirections } from "./SceneBreakdown";
import { ReferenceMediaPanel } from "./ReferenceMediaPanel";
import type { ReferenceMediaItem } from "./ReferenceItem";
import { ElementGrid, type ElementItem } from "./ElementGrid";
import { MentionTextarea } from "./MentionTextarea";
import { SceneMentionTextarea, type SceneMentionTextareaHandle } from "./SceneMentionTextarea";
import { extractVideoKeyframes, compressImageFile } from "@/lib/videoFrames";
import { hashBase64, getCachedAnalysis, setCachedAnalysis } from "@/lib/imageCache";
import { Sparkles, Loader2, ScanSearch, RotateCcw, RefreshCw, Info, Volume2, VolumeX, Zap, Clapperboard, ArrowRight, ArrowDown, ArrowLeft, HelpCircle, Pencil, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { PresetPickerPanel } from "./PresetPickerPanel";
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
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { trackGeneration } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { getContract, deriveWorkflowType, supportsTimelinePrompting, timelineMandatory } from "@/lib/modelContracts";
import { getModelControls } from "@/lib/director/videoModelControls";
import { writeHandoff } from "@/lib/director/handoff";
import { ingestImage, uploadAndSign, requireUserId, type Attachment } from "@/lib/director/ingest";
import { MODEL_GROUPS, getModelLabel } from "@/lib/models";
import { parseEdgeFnError, pickErrorKey } from "@/lib/edgeFnError";
import { detectAllIntents } from "@/lib/sceneIntent";
import { ModelPicker } from "./ModelPicker";



const ONBOARDING_DONE_KEY = "movprompt.firstGenerationDone";

// Max number of scene elements to include in the AI enhance request.
// Kept deterministic (sorted by @index) so model inputs stay consistent across calls.
const ENHANCE_SCENE_SUMMARY_MAX_ELEMENTS = 20;

type Phase = "upload" | "breakdown" | "generate";

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

interface WorkflowPanelProps {
  selectedModel: string;
  onSwitchModel?: (value: string) => void;
}

const phaseTransition = {
  initial: { opacity: 0, y: 14, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.98 },
  transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] as const },
};

export const WorkflowPanel = ({ selectedModel, onSwitchModel }: WorkflowPanelProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [description, setDescription] = useState("");
  const [results, setResults] = useState<ShotResult[] | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [regeneratingShotIdx, setRegeneratingShotIdx] = useState<number | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [history, setHistory] = useState<Array<{
    id: string;
    results: ShotResult[];
    agentName: string | null;
    modelValue: string;
    modelLabel: string;
    workflowType: string;
    createdAt: number;
  }>>([]);

  // Quality & evaluation loop — per-shot state, reset whenever results object identity changes.
  type ShotFeedback = { liked: boolean | null; reasons: string[]; note: string };
  type ShotCritique = { result: any | null; loading: boolean; error: string | null };
  const [feedbackByShot, setFeedbackByShot] = useState<Record<number, ShotFeedback>>({});
  const [critiqueByShot, setCritiqueByShot] = useState<Record<number, ShotCritique>>({});
  const [applyingAddendumByShot, setApplyingAddendumByShot] = useState<Record<number, string | null>>({});

  const [phase, setPhase] = useState<Phase>("upload");
  const [sceneFrames, setSceneFrames] = useState<SceneFrame[]>([]);
  const [elementDirections, setElementDirections] = useState<ElementDirections>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analysisCancelledRef = useRef(false);
  const handleCancelAnalysis = () => {
    analysisCancelledRef.current = true;
    setIsAnalyzing(false);
  };
  const [referenceItems, setReferenceItems] = useState<ReferenceMediaItem[]>([]);
  const [elementItems, setElementItems] = useState<ElementItem[]>([]);
  const sceneMentionRef = useRef<SceneMentionTextareaHandle>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [manualOverrides, setManualOverrides] = useState<Record<string, boolean>>({});
  const [resetSnapshot, setResetSnapshot] = useState<ElementDirections | null>(null);
  const resetSnapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [pendingResetCount, setPendingResetCount] = useState(0);

  // Enhance my vision (AI rewrite of Describe)
  const [enhanceOpen, setEnhanceOpen] = useState(false);
  const [enhanceLoading, setEnhanceLoading] = useState(false);
  const [enhancedDraft, setEnhancedDraft] = useState<string | null>(null);
  const [enhanceUndoSnapshot, setEnhanceUndoSnapshot] = useState<string | null>(null);
  const enhanceUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearEnhanceUndo = useCallback(() => {
    if (enhanceUndoTimerRef.current) {
      clearTimeout(enhanceUndoTimerRef.current);
      enhanceUndoTimerRef.current = null;
    }
    setEnhanceUndoSnapshot(null);
  }, []);

  const handleUndoEnhance = useCallback(() => {
    if (enhanceUndoSnapshot === null) return;
    setDescription(enhanceUndoSnapshot);
    clearEnhanceUndo();
  }, [enhanceUndoSnapshot, clearEnhanceUndo]);

  useEffect(() => {
    return () => {
      if (enhanceUndoTimerRef.current) clearTimeout(enhanceUndoTimerRef.current);
    };
  }, []);

  // handleEnhanceClick / handleApplyEnhanced are defined after flatSceneElements below.

  const clearResetSnapshot = useCallback(() => {
    if (resetSnapshotTimerRef.current) {
      clearTimeout(resetSnapshotTimerRef.current);
      resetSnapshotTimerRef.current = null;
    }
    setResetSnapshot(null);
  }, []);

  const handleUndoReset = useCallback(() => {
    if (!resetSnapshot) return;
    setElementDirections(resetSnapshot);
    clearResetSnapshot();
  }, [resetSnapshot, clearResetSnapshot]);

  useEffect(() => {
    return () => {
      if (resetSnapshotTimerRef.current) clearTimeout(resetSnapshotTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== "breakdown" && phase !== "generate") {
      clearResetSnapshot();
      setConfirmResetOpen(false);
    }
  }, [phase, clearResetSnapshot]);
  const [hasGeneratedBefore, setHasGeneratedBefore] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(ONBOARDING_DONE_KEY) === "1";
  });

  // Measure the sticky bottom CTA so the scroll container can reserve enough
  // bottom padding — otherwise the last scene block hides under the bar and
  // the page feels "locked" at the end.
  const stickyBarRef = useRef<HTMLDivElement | null>(null);
  const [stickyBarHeight, setStickyBarHeight] = useState(0);
  useEffect(() => {
    const el = stickyBarRef.current;
    if (!el) {
      setStickyBarHeight(0);
      return;
    }
    const update = () => setStickyBarHeight(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [phase, isLoading, isAnalyzing]);




  // Flatten scene frames into a single 1-based indexed list (left-to-right, frame-by-frame).
  const flatSceneElements = useMemo(() => {
    const out: { index: number; category: string; description: string; id: string; frameIndex: number }[] = [];
    let n = 0;
    for (const frame of sceneFrames) {
      for (const el of frame.elements) {
        n += 1;
        out.push({ index: n, category: el.category, description: el.description, id: el.id, frameIndex: frame.frameIndex });
      }
    }
    return out;
  }, [sceneFrames]);

  const handleEnhanceClick = useCallback(async () => {
    if (description.trim().length < 10 || enhanceLoading) return;
    setEnhanceLoading(true);
    try {
      const sceneSummary = flatSceneElements.length > 0
        ? [...flatSceneElements]
            .sort((a, b) => a.index - b.index)
            .slice(0, ENHANCE_SCENE_SUMMARY_MAX_ELEMENTS)
            .map((el) => {
              const category = (el.category || "element").trim();
              const description = (el.description || "").trim();
              return description
                ? `@${el.index} ${category}: ${description}`
                : `@${el.index} ${category}`;
            })
            .join("; ")
        : undefined;

      const { data, error } = await supabase.functions.invoke("enhance-description", {
        body: { description, sceneSummary },
      });

      if (error) {
        const parsed = await parseEdgeFnError(error);
        const key = pickErrorKey(parsed);
        toast({
          title: t(key as any),
          description: parsed.serverMessage,
          variant: "destructive",
        });
        return;
      }
      if (data?.error || typeof data?.enhanced !== "string" || !data.enhanced.trim()) {
        toast({
          title: t("errors.aiUnknown" as any),
          description: data?.error,
          variant: "destructive",
        });
        return;
      }
      setEnhancedDraft(data.enhanced.trim());
      setEnhanceOpen(true);
    } catch (err) {
      console.error("Enhance error:", err);
      toast({ title: t("errors.aiUnknown" as any), variant: "destructive" });
    } finally {
      setEnhanceLoading(false);
    }
  }, [description, enhanceLoading, flatSceneElements, t, toast]);

  const handleApplyEnhanced = useCallback(() => {
    if (!enhancedDraft) return;
    setEnhanceUndoSnapshot(description);
    setDescription(enhancedDraft);
    setEnhanceOpen(false);
    setEnhancedDraft(null);
    if (enhanceUndoTimerRef.current) clearTimeout(enhanceUndoTimerRef.current);
    enhanceUndoTimerRef.current = setTimeout(() => {
      setEnhanceUndoSnapshot(null);
      enhanceUndoTimerRef.current = null;
    }, 8000);
  }, [enhancedDraft, description]);

  const performAutoReset = useCallback(() => {
    setElementDirections((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const el of flatSceneElements) {
        if (manualOverrides[el.id]) continue;
        const curr = prev[el.id];
        if (curr?.action !== "move") {
          next[el.id] = { action: "move", note: curr?.note || "" };
          changed = true;
        }
      }
      if (changed) {
        setResetSnapshot(prev);
        if (resetSnapshotTimerRef.current) clearTimeout(resetSnapshotTimerRef.current);
        resetSnapshotTimerRef.current = setTimeout(() => {
          setResetSnapshot(null);
          resetSnapshotTimerRef.current = null;
        }, 8000);
      }
      return changed ? next : prev;
    });
  }, [flatSceneElements, manualOverrides]);

  // Auto-assign Move/Lock based on verbs near @N mentions in the description.
  // Debounced 150ms. Skips elements the user has manually overridden.
  useEffect(() => {
    if (phase !== "breakdown") return;
    if (flatSceneElements.length === 0) return;
    if (description.trim() === "") {
      // Find elements that would be affected and have non-default state (lock or note).
      const atRisk = flatSceneElements.filter((el) => {
        if (manualOverrides[el.id]) return false;
        const dir = elementDirections[el.id];
        if (!dir) return false;
        return dir.action === "lock" || (dir.note ?? "") !== "";
      });
      if (atRisk.length === 0) {
        // Silent reset path (no notable changes — won't capture snapshot since nothing is non-default).
        performAutoReset();
        return;
      }
      // Prompt user before wiping non-default auto-assigned state.
      setPendingResetCount(atRisk.length);
      setConfirmResetOpen(true);
      return;
    }
    // User typed again — invalidate any pending undo snapshot or open confirm dialog.
    if (resetSnapshot) clearResetSnapshot();
    if (confirmResetOpen) setConfirmResetOpen(false);
    const timer = setTimeout(() => {
      const intents = detectAllIntents(description);
      setElementDirections((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const el of flatSceneElements) {
          if (manualOverrides[el.id]) continue;
          const target = intents[el.index] ?? "move";
          const curr = prev[el.id];
          if (curr?.action !== target) {
            next[el.id] = { action: target, note: curr?.note || "" };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [description, flatSceneElements, manualOverrides, phase, resetSnapshot, clearResetSnapshot, elementDirections, confirmResetOpen, performAutoReset]);

  const contract = useMemo(() => getContract(selectedModel), [selectedModel]);
  const [twoFrameMode, setTwoFrameMode] = useState(false);
  const [multiShotMode, setMultiShotMode] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [timelineEnabled, setTimelineEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem("movprompt.timelinePrompting") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("movprompt.timelinePrompting", timelineEnabled ? "1" : "0"); } catch { /* ignore */ }
  }, [timelineEnabled]);
  const supportsTimeline = useMemo(() => supportsTimelinePrompting(selectedModel), [selectedModel]);
  const timelineRequired = useMemo(() => timelineMandatory(selectedModel), [selectedModel]);
  // Force Timeline Prompting on whenever the user lands on a Seedance model.
  useEffect(() => {
    if (timelineRequired && !timelineEnabled) setTimelineEnabled(true);
  }, [timelineRequired, timelineEnabled]);

  // Per-model target video duration (informs the generated prompt's pacing).
  const modelControls = useMemo(() => getModelControls(selectedModel), [selectedModel]);
  const durationOptions = useMemo<Array<number | "auto">>(() => {
    const opts: Array<number | "auto"> = [];
    if (modelControls.durations?.length) {
      opts.push(...modelControls.durations);
    } else if (modelControls.durationMin && modelControls.durationMax) {
      const step = modelControls.durationStep ?? 1;
      for (let n = modelControls.durationMin; n <= modelControls.durationMax; n += step) opts.push(n);
    } else {
      opts.push(5, 10);
    }
    if (modelControls.durationAuto) opts.push("auto");
    return opts;
  }, [modelControls]);
  const [targetDuration, setTargetDuration] = useState<number | "auto">(() => {
    const fallback = (modelControls.defaults?.duration as number | "auto" | undefined) ?? 10;
    try {
      const saved = localStorage.getItem(`movprompt.targetDuration.${selectedModel}`);
      if (saved === "auto" && modelControls.durationAuto) return "auto";
      const n = saved ? Number(saved) : NaN;
      if (Number.isFinite(n) && durationOptions.includes(n as number)) return n;
    } catch { /* ignore */ }
    return fallback;
  });
  useEffect(() => {
    // Re-resolve when model changes — snap to nearest allowed.
    const fallback = (modelControls.defaults?.duration as number | "auto" | undefined) ?? 10;
    let next: number | "auto" = fallback;
    try {
      const saved = localStorage.getItem(`movprompt.targetDuration.${selectedModel}`);
      if (saved === "auto" && modelControls.durationAuto) next = "auto";
      else {
        const n = saved ? Number(saved) : NaN;
        if (Number.isFinite(n) && durationOptions.includes(n as number)) next = n;
      }
    } catch { /* ignore */ }
    if (next !== "auto" && !durationOptions.includes(next)) {
      // snap
      const nums = durationOptions.filter((d): d is number => typeof d === "number");
      if (nums.length) {
        next = nums.reduce((best, d) => Math.abs(d - (next as number)) < Math.abs(best - (next as number)) ? d : best, nums[0]);
      }
    }
    setTargetDuration(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel]);
  useEffect(() => {
    try { localStorage.setItem(`movprompt.targetDuration.${selectedModel}`, String(targetDuration)); } catch { /* ignore */ }
  }, [targetDuration, selectedModel]);

  // Per-model target aspect ratio. Surfaced as chips near the Generate CTA so
  // the user can override the AI-suggested framing before generation.
  const [targetAspectRatio, setTargetAspectRatio] = useState<string>(() => {
    const fallback = (modelControls.defaults?.aspect_ratio as string | undefined) ?? "16:9";
    try {
      const saved = localStorage.getItem(`movprompt.aspectRatio.${selectedModel}`);
      if (saved && (modelControls.aspectRatios ?? []).includes(saved)) return saved;
    } catch { /* ignore */ }
    return fallback;
  });
  useEffect(() => {
    const fallback = (modelControls.defaults?.aspect_ratio as string | undefined) ?? "16:9";
    let next = fallback;
    try {
      const saved = localStorage.getItem(`movprompt.aspectRatio.${selectedModel}`);
      if (saved && (modelControls.aspectRatios ?? []).includes(saved)) next = saved;
    } catch { /* ignore */ }
    const allowed = modelControls.aspectRatios ?? [fallback];
    if (!allowed.includes(next)) next = fallback;
    setTargetAspectRatio(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel]);
  useEffect(() => {
    try { localStorage.setItem(`movprompt.aspectRatio.${selectedModel}`, targetAspectRatio); } catch { /* ignore */ }
  }, [targetAspectRatio, selectedModel]);

  const activeSlots = contract.supportsTwoFrameToggle && twoFrameMode ? 2 : contract.slots;
  const workflowType = deriveWorkflowType(selectedModel, activeSlots, contract.supportsMultiShotToggle && multiShotMode);

  const handleImageSelect = useCallback((index: number, file: File) => {
    const preview = URL.createObjectURL(file);
    setImages((prev) => {
      const next = [...prev];
      next[index] = { file, preview };
      return next;
    });
    setResults(null);
    setPhase("upload");
    setSceneFrames([]);
    setElementDirections({});
    setHistory([]); setFeedbackByShot({}); setCritiqueByShot({});
  }, []);

  const handleImageRemove = useCallback((index: number) => {
    setImages((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
    setPhase("upload");
  }, []);

  const hasRequiredImages = contract.supportsElementReferences
    ? elementItems.length >= 1
    : images.filter(Boolean).length >= 1;

  // Compression is centralized in `lib/videoFrames.compressImageFile`, which
  // memoizes per-File so analyze → generate → re-roll reuses one base64 payload.
  const compressImage = compressImageFile;


  const handleAnalyze = async () => {
    if (!hasRequiredImages) return;
    // Always reset Timeline prompting to OFF when entering the breakdown phase —
    // the user must opt back in each time.
    setTimelineEnabled(false);
    // Element-only mode (no main frames): skip scene analysis and jump straight to breakdown phase.
    if (images.filter(Boolean).length === 0) {
      setSceneFrames([]);
      setElementDirections({});
      setPhase("breakdown");
      return;
    }
    if (!user) {
      toast({ title: t("wp.signInRequired"), description: t("wp.signInAnalyze"), variant: "destructive" });
      navigate("/auth");
      return;
    }
    analysisCancelledRef.current = false;
    setIsAnalyzing(true);
    try {
      const imageBase64s = await Promise.all(images.filter(Boolean).map((img) => compressImage(img.file)));

      // Session cache: re-analyzing the same uploads (e.g. after navigating
      // back) is instant and skips a full vision-model round-trip.
      const cacheKey = imageBase64s.map(hashBase64);
      const cached = getCachedAnalysis<{ frames: SceneFrame[] }>(cacheKey);
      const data = cached
        ? cached
        : await (async () => {
            const { data, error } = await supabase.functions.invoke("analyze-scene", {
              body: { images: imageBase64s },
            });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            setCachedAnalysis(cacheKey, { frames: data.frames || [] });
            return data;
          })();

      if (analysisCancelledRef.current) return;
      const frames: SceneFrame[] = data.frames || [];
      setSceneFrames(frames);

      const dirs: ElementDirections = {};
      for (const frame of frames) {
        for (const el of frame.elements) {
          dirs[el.id] = { action: "move", note: "" };
        }
      }
      setElementDirections(dirs);
      setManualOverrides({});
      setPhase("breakdown");
    } catch (err: any) {
      if (analysisCancelledRef.current) return;
      console.error("Analysis error:", err);
      toast({ title: t("wp.analysisFailed"), description: err.message || t("wp.somethingWrong"), variant: "destructive" });
    } finally {
      if (!analysisCancelledRef.current) setIsAnalyzing(false);
    }
  };

  const handleGenerate = async (opts?: { compact?: boolean; replaceShotIdx?: number; addendum?: string }) => {
    if (!hasRequiredImages) return;
    if (!user) {
      toast({ title: t("wp.signInRequired"), description: t("wp.signInGenerate"), variant: "destructive" });
      navigate("/auth");
      return;
    }
    const isShotRegen = typeof opts?.replaceShotIdx === "number" && results && results[opts.replaceShotIdx];
    const addendum = opts?.addendum?.trim() || undefined;
    if (isShotRegen) {
      setRegeneratingShotIdx(opts!.replaceShotIdx!);
      if (addendum) {
        setApplyingAddendumByShot((prev) => ({ ...prev, [opts!.replaceShotIdx!]: addendum }));
      }
    } else {
      setIsLoading(true);
      setResults(null);
      // Full regenerate clears per-shot critiques; feedback is preserved (it's intentional bias).
      setCritiqueByShot({});
    }

    // Resolve feedback to send: per-shot if regenerating one shot, else first-shot feedback as a hint.
    const feedbackPayload = (() => {
      const target = isShotRegen ? opts!.replaceShotIdx! : 0;
      const fb = feedbackByShot[target];
      if (!fb || (fb.liked === null && fb.reasons.length === 0 && !fb.note)) return undefined;
      return { liked: fb.liked, reasons: fb.reasons, note: fb.note || undefined };
    })();

    try {
      // Run all upload-prep stages truly in parallel — main images, references,
      // and @Element items used to chain sequentially (3 awaits). With per-File
      // memoization (lib/imageCache) re-runs become near-instant.
      const imagesP = Promise.all(images.filter(Boolean).map((img) => compressImage(img.file)));

      const referencesP = Promise.all(
        referenceItems.map(async (ref) => {
          if (ref.kind === "image") {
            const b64 = await compressImageFile(ref.file);
            return { kind: "image", role: ref.role, note: ref.note || undefined, filename: ref.file.name, images: [b64] };
          }
          if (ref.kind === "video") {
            try {
              const frames = await extractVideoKeyframes(ref.file, 3);
              return { kind: "video", role: ref.role, note: ref.note || undefined, filename: ref.file.name, images: frames };
            } catch (e) {
              console.error("Video keyframe extraction failed:", e);
              return { kind: "video", role: ref.role, note: ref.note || undefined, filename: ref.file.name, images: [] };
            }
          }
          return { kind: "audio", role: ref.role, note: ref.note || undefined, filename: ref.file.name };
        }),
      );

      const elementsP = contract.supportsElementReferences
        ? Promise.all(
            elementItems.map(async (el, idx) => {
              const base = { role: "style" as const, note: el.note || undefined, filename: el.file.name, index: idx + 1 };
              if (el.kind === "image") {
                const b64 = await compressImageFile(el.file);
                return { ...base, kind: "image", images: [b64] };
              }
              if (el.kind === "video") {
                try {
                  const frames = await extractVideoKeyframes(el.file, 3);
                  return { ...base, kind: "video", images: frames };
                } catch (e) {
                  console.error("Element video keyframe extraction failed:", e);
                  return { ...base, kind: "video", images: [] };
                }
              }
              return { ...base, kind: "audio" };
            }),
          )
        : Promise.resolve([] as any[]);

      const [imageBase64s, referencesPayload, elementsPayload] = await Promise.all([
        imagesP,
        referencesP,
        elementsP,
      ]);

      const sceneBreakdown = sceneFrames.length > 0
        ? sceneFrames.map((frame) => ({
            frameIndex: frame.frameIndex,
            frameLabel: frameLabels[frame.frameIndex] || `Frame ${frame.frameIndex + 1}`,
            elements: frame.elements.map((el) => ({
              category: el.category,
              description: el.description,
              action: elementDirections[el.id]?.action || "move",
              note: elementDirections[el.id]?.note || "",
            })),
          }))
        : undefined;

      // Resolve @N mentions from description against the flat scene element list
      const mentionedNumbers = Array.from(new Set(
        Array.from((description || "").matchAll(/(?:^|\s)@(\d+)\b/g))
          .map((m) => Number(m[1]))
          .filter((n) => Number.isInteger(n) && n >= 1 && n <= flatSceneElements.length),
      ));
      const elementMentions = mentionedNumbers
        .map((n) => flatSceneElements.find((el) => el.index === n))
        .filter((el): el is { index: number; category: string; description: string; id: string; frameIndex: number } => Boolean(el))
        .map(({ index, category, description }) => ({ index, category, description }));

      const { data, error } = await supabase.functions.invoke("generate-prompt", {
        body: {
          images: imageBase64s,
          workflowType,
          description,
          targetModel: selectedModel,
          sceneBreakdown,
          audioEnabled: contract.supportsAudio ? audioEnabled : undefined,
          references: referencesPayload.length > 0 ? referencesPayload : undefined,
          elements: elementsPayload.length > 0 ? elementsPayload : undefined,
          autoInjectElements: elementsPayload.length > 0 ? true : undefined,
          elementMentions: elementMentions.length > 0 ? elementMentions : undefined,
          multiShotCount: workflowType === "multishot" && contract.supportsMultiShotToggle
            ? Math.min(10, Math.max(contract.multiShotCount ?? 0, elementsPayload.length))
            : undefined,
          timelineEnabled: supportsTimeline ? timelineEnabled : undefined,
          targetDuration,
          targetAspectRatio,

          compactMode: opts?.compact === true ? true : undefined,
          addendum,
          feedback: feedbackPayload,
        },
      });

      if (error) {
        const parsed = await parseEdgeFnError(error);
        const key = pickErrorKey(parsed);
        toast({
          title: t(key as any),
          description: parsed.serverMessage || t("wp.somethingWrongRetry"),
          variant: "destructive",
        });
        return;
      }
      if (data?.error) {
        toast({
          title: t("wp.generationFailed"),
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      let finalResults: ShotResult[] = data.results;
      if (isShotRegen && results) {
        const idx = opts!.replaceShotIdx!;
        const newShot = data.results[idx] ?? data.results[0];
        finalResults = results.map((r, i) => (i === idx ? newShot : r));
        // Reset critique + clear feedback for the regenerated shot since the prompt changed.
        setCritiqueByShot((prev) => { const n = { ...prev }; delete n[idx]; return n; });
        setFeedbackByShot((prev) => { const n = { ...prev }; delete n[idx]; return n; });
      }
      setResults(finalResults);
      setAgentName(data.agentName ?? null);
      setPhase("generate");
      trackGeneration(workflowType, selectedModel);
      // Push snapshot to in-session history (cap 5)
      const modelLabelNow = MODEL_GROUPS.flatMap(g => g.models).find(m => m.value === selectedModel)?.label ?? selectedModel;
      setHistory((prev) => {
        const snap = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          results: finalResults,
          agentName: data.agentName ?? null,
          modelValue: selectedModel,
          modelLabel: modelLabelNow,
          workflowType,
          createdAt: Date.now(),
        };
        return [snap, ...prev].slice(0, 5);
      });
      try {
        localStorage.setItem(ONBOARDING_DONE_KEY, "1");
        setHasGeneratedBefore(true);
      } catch {}

      if (user) {
        supabase.from("prompt_history").insert({
          user_id: user.id,
          workflow_type: workflowType,
          target_model: selectedModel,
          results: data.results,
        }).select("id").single().then(async ({ data: row, error: histErr }) => {
          if (histErr || !row) {
            console.error("Failed to save history:", histErr);
            return;
          }
          try {
            const paths: string[] = [];
            const validImages = images.filter(Boolean);
            for (let i = 0; i < validImages.length; i++) {
              const filePath = `${user.id}/${row.id}/frame_${i}.jpg`;
              const { error: uploadErr } = await supabase.storage
                .from("generation-images")
                .upload(filePath, validImages[i].file, { contentType: "image/jpeg", upsert: true });
              if (uploadErr) {
                console.error("Image upload error:", uploadErr);
              } else {
                paths.push(filePath);
              }
            }
            if (paths.length > 0) {
              const { error: updateErr } = await supabase
                .from("prompt_history")
                .update({ image_paths: paths } as any)
                .eq("id", row.id);
              if (updateErr) console.error("History image_paths update failed:", updateErr);
            }
          } catch (e) {
            console.error("Image upload failed:", e);
          }
        });
      }
    } catch (err: any) {
      console.error("Generation error:", err);
      toast({ title: t("wp.generationFailed"), description: err.message || t("wp.somethingWrongRetry"), variant: "destructive" });
    } finally {
      setIsLoading(false);
      setRegeneratingShotIdx(null);
      if (typeof opts?.replaceShotIdx === "number") {
        setApplyingAddendumByShot((prev) => { const n = { ...prev }; delete n[opts.replaceShotIdx!]; return n; });
      }
    }
  };

  const handleRunCritique = useCallback(async (shotIdx: number) => {
    if (!results || !results[shotIdx]) return;
    setCritiqueByShot((prev) => ({ ...prev, [shotIdx]: { result: null, loading: true, error: null } }));
    try {
      const { data, error } = await supabase.functions.invoke("critique-prompt", {
        body: {
          result: results[shotIdx],
          targetModel: selectedModel,
          workflowType,
          description,
        },
      });
      if (error) {
        const parsed = await parseEdgeFnError(error);
        setCritiqueByShot((prev) => ({ ...prev, [shotIdx]: { result: null, loading: false, error: parsed.serverMessage || t("results.critique.failed" as any) } }));
        return;
      }
      if (data?.error || typeof data?.score !== "number") {
        setCritiqueByShot((prev) => ({ ...prev, [shotIdx]: { result: null, loading: false, error: data?.error || t("results.critique.failed" as any) } }));
        return;
      }
      setCritiqueByShot((prev) => ({ ...prev, [shotIdx]: { result: data, loading: false, error: null } }));
    } catch (err: any) {
      setCritiqueByShot((prev) => ({ ...prev, [shotIdx]: { result: null, loading: false, error: err?.message || "Unknown error" } }));
    }
  }, [results, selectedModel, workflowType, description, t]);

  const handleApplyAddendum = useCallback((shotIdx: number, addendum: string) => {
    handleGenerate({ replaceShotIdx: shotIdx, addendum });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, selectedModel, workflowType, description, feedbackByShot]);

  const handleFeedbackChange = useCallback((shotIdx: number, next: ShotFeedback) => {
    setFeedbackByShot((prev) => ({ ...prev, [shotIdx]: next }));
  }, []);

  // Slot labels from contract (translation keys)
  const slotLabels: string[] = (() => {
    if (activeSlots === 2) {
      return [t("frame.start"), t("frame.endOptional" as any)];
    }
    return contract.slotLabels.map((k) => t(k as any));
  })();

  // Frame labels for SceneBreakdown
  const frameLabels: string[] = (() => {
    if (workflowType === "twoframe") return [t("frame.start"), t("frame.end")];
    if (workflowType === "multishot") return [t("frame.concept")];
    return [t("frame.your")];
  })();

  const extrasHint = contract.extrasHintKey ? t(contract.extrasHintKey as any) : null;

  // ============ Reusable JSX blocks ============

  const workflowHeaderBlock = (
    <div className="flex items-center gap-1.5">
      <h2 className="text-base font-normal text-foreground">Choose your workflow</h2>
      {extrasHint && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Workflow help"
                className="inline-flex text-muted-foreground hover:text-foreground transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs text-xs">
              {extrasHint}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );

  // Inline compact audio toggle (rendered inside the collapsed model strip).
  // Show for audio-capable models. For "any" (Universal Prompt), show a neutral
  // state with explanatory tooltip since the actual audio capability depends on
  // which model the AI ultimately chooses.
  const isAnyModel = selectedModel === "any";
  const showAudioToggle = contract.supportsAudio || isAnyModel;
  const audioInlineToggle = showAudioToggle ? (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setAudioEnabled((v) => !v); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-pressed={audioEnabled}
          >
            {audioEnabled ? <Volume2 className="w-3.5 h-3.5 text-foreground" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                audioEnabled ? (isAnyModel ? "bg-muted-foreground/40" : "bg-primary") : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-background transition-transform ${
                  audioEnabled ? "translate-x-[14px]" : "translate-x-0.5"
                }`}
              />
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-xs">
          {isAnyModel
            ? "Audio output depends on which model the AI picks for your scene"
            : audioEnabled ? "Audio on" : "Audio off"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : null;

  const modeToggleBlock = (contract.supportsTwoFrameToggle || contract.supportsMultiShotToggle) && (() => {
    const both = contract.supportsTwoFrameToggle && contract.supportsMultiShotToggle;
    // Match the actual generated shot count: clamped to [contract.multiShotCount, 10]
    // and never below the number of element references provided.
    const baseMulti = contract.multiShotCount ?? 3;
    const multiCount = contract.supportsElementReferences
      ? Math.min(10, Math.max(baseMulti, elementItems.length, 2))
      : baseMulti;
    const multiLabel = (t("contract.toggle.multiShotN" as any) || "Multi-shot ({count})").replace("{count}", String(multiCount));

    const setMode = (mode: "single" | "twoframe" | "multishot") => {
      setTwoFrameMode(mode === "twoframe");
      setMultiShotMode(mode === "multishot");
      setImages([]);
      setResults(null);
      setHistory([]); setFeedbackByShot({}); setCritiqueByShot({});
      setPhase("upload");
    };
    const currentMode: "single" | "twoframe" | "multishot" =
      multiShotMode ? "multishot" : twoFrameMode ? "twoframe" : "single";

    const btn = (active: boolean) =>
      `flex-1 sm:flex-initial shrink-0 whitespace-nowrap rounded-full text-[13px] sm:text-sm leading-none transition-colors text-center ${
        active
          ? "bg-accent text-accent-foreground font-semibold shadow-[0_2px_10px_hsl(var(--accent)/0.25)]"
          : "bg-transparent text-muted-foreground hover:bg-accent/10 hover:text-foreground"
      }`;

    return (
      <div className="flex w-full sm:w-auto flex-nowrap sm:flex-wrap sm:justify-center items-stretch gap-1.5 sm:gap-2 rounded-full p-1 sm:p-0 bg-muted/40 sm:bg-transparent border sm:border-0 border-border/40">
        <button onClick={() => setMode("single")} className={`${btn(currentMode === "single")} px-3 sm:px-6 py-2.5 sm:py-3.5`}>
          {contract.supportsMultiShotToggle && !contract.supportsTwoFrameToggle
            ? t("contract.toggle.singleShot" as any)
            : t("contract.toggle.single" as any)}
        </button>
        {contract.supportsTwoFrameToggle && (
          <button onClick={() => setMode("twoframe")} className={`${btn(currentMode === "twoframe")} px-3 sm:px-6 py-2.5 sm:py-3.5`}>
            {t("contract.toggle.startEnd" as any)}
          </button>
        )}
        {contract.supportsMultiShotToggle && (
          <button
            onClick={() => setMode("multishot")}
            title={`Generates a ${multiCount}-shot storyboard with locked style across panels`}
            aria-label={`Multi-shot — ${multiCount} shots`}
            className={`${btn(currentMode === "multishot")} px-3 sm:px-6 py-2.5 sm:py-3.5`}
          >
            {multiLabel}
          </button>
        )}

      </div>
    );
  })();


  const uploadBlock = !contract.supportsElementReferences ? (
    activeSlots === 2 ? (
      <div className="flex flex-col sm:flex-row sm:items-stretch gap-4 sm:gap-4 w-full min-w-0">
        {[0, 1].map((i) => (
          <div key={i} className="flex-1 min-w-0 flex flex-col">
            <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-primary mb-2">
              {i === 0 ? t("upload.startFrame" as any) : `${t("upload.endFrame" as any)} (Optional)`}
            </span>
            <ImageUploadZone
              label={slotLabels[i] || `Frame ${i + 1}`}
              preview={images[i]?.preview || null}
              onImageSelect={(file) => handleImageSelect(i, file)}
              onImageRemove={() => handleImageRemove(i)}
              disabled={isAnalyzing}
            />
            {i === 0 && (
              <div
                className="flex sm:hidden items-center justify-center"
                style={{ marginTop: 8, marginBottom: -8 }}
                aria-hidden="true"
              >
                <ArrowDown size={32} className="text-primary animate-pulse-glow" />
              </div>
            )}
          </div>
        )).reduce<React.ReactNode[]>((acc, node, idx) => {
          acc.push(node);
          if (idx === 0) {
            acc.push(
              <div
                key="arrow"
                className="hidden sm:flex items-center justify-center self-center relative"
                style={{ width: 64, height: 32 }}
                aria-hidden="true"
              >
                <div
                  className="absolute left-0 right-0 top-1/2 -translate-y-1/2"
                  style={{ borderTop: "1px dashed hsl(var(--primary))", opacity: 0.6 }}
                />
                <div
                  className="relative inline-flex items-center justify-center rounded-full bg-background"
                  style={{ width: 32, height: 32, border: "1px dashed hsl(var(--primary))" }}
                >
                  <ArrowRight size={18} className="text-primary" />
                </div>
              </div>
            );
          }
          return acc;
        }, [])}
      </div>
    ) : (
      <div className="flex flex-col items-center gap-4 w-full">
        {Array.from({ length: activeSlots }).map((_, i) => (
          <div key={i} className="w-full max-w-[480px]">
            <ImageUploadZone
              label={slotLabels[i] || `Frame ${i + 1}`}
              preview={images[i]?.preview || null}
              onImageSelect={(file) => handleImageSelect(i, file)}
              onImageRemove={() => handleImageRemove(i)}
              disabled={isAnalyzing}
            />
          </div>
        ))}
      </div>
    )
  ) : (
    <ElementGrid items={elementItems} onChange={setElementItems} max={contract.maxElements ?? 10} />
  );

  const enhanceDisabled = description.trim().length < 10 || enhanceLoading;
  const enhanceRow = (phase === "breakdown" || phase === "generate") && (
    <div className="flex flex-col gap-2 -mt-2">
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleEnhanceClick}
          disabled={enhanceDisabled}
          title={description.trim().length < 10 ? t("enhance.tooltip.short" as any) : ""}
          aria-label={t("enhance.button" as any)}
          className="gap-1.5 h-8 px-2 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5"
        >
          {enhanceLoading ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("enhance.loading" as any)}</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5" /> {t("enhance.button" as any)}</>
          )}
        </Button>
      </div>
      {enhanceUndoSnapshot !== null && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground"
        >
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{t("enhance.applied" as any)}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleUndoEnhance}
            className="h-6 px-2 text-xs text-foreground hover:text-primary"
          >
            {t("enhance.undo" as any)}
          </Button>
        </motion.div>
      )}
      <AlertDialog
        open={enhanceOpen}
        onOpenChange={(open) => {
          setEnhanceOpen(open);
          if (!open) setEnhancedDraft(null);
        }}
      >
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("enhance.dialog.title" as any)}</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
            <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("enhance.dialog.original" as any)}
              </div>
              <div className="text-sm whitespace-pre-wrap text-foreground/80 leading-relaxed">
                {description}
              </div>
            </div>
            <div className="rounded-md border border-border bg-muted/40 p-3 space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("enhance.dialog.enhanced" as any)}
              </div>
              <div className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">
                {enhancedDraft ?? ""}
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setEnhanceOpen(false); setEnhancedDraft(null); }}>
              {t("enhance.cancel" as any)}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleApplyEnhanced}>
              {t("enhance.apply" as any)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  // Context-aware placeholder based on dominant scene category.
  const contextPlaceholder = useMemo(() => {
    if (flatSceneElements.length === 0) return t("config.placeholder");
    const counts: Record<string, number> = {};
    for (const el of flatSceneElements) counts[el.category] = (counts[el.category] || 0) + 1;
    const subj = counts["Subject"] || 0;
    const objs = counts["Objects"] || 0;
    const bg = counts["Background"] || 0;
    // Product packaging WITH characters (mascot/figure on packaging)
    if (objs >= 2 && subj >= 1) {
      return 'e.g. "The mascot animates, product details come into focus, bright commercial lighting, premium retail mood."';
    }
    // Product packaging WITHOUT characters
    if (objs >= 2 && subj <= 0) {
      return 'e.g. "Slow rotation, condensation forms on the surface, soft commercial lighting, premium advertising mood."';
    }
    // Portrait
    if (subj >= 1 && bg <= 1 && objs <= 1) {
      return 'e.g. "Slow push-in on the subject, rack focus on the eyes, golden hour key light from the left."';
    }
    // Landscape
    if (bg >= 1 && subj === 0) {
      return 'e.g. "Wide tracking shot, sun-flared silhouette walking the ridge, 70mm grain, cinematic letterbox."';
    }
    return t("config.placeholder");
  }, [flatSceneElements, t]);

  const descriptionBlock = (phase === "breakdown" || phase === "generate") && (
    <div className="space-y-2" data-tour="describe-textarea">
      {contract.supportsElementReferences ? (
        <MentionTextarea
          value={description}
          onChange={setDescription}
          elements={elementItems}
          placeholder={contextPlaceholder}
        />
      ) : sceneFrames.length > 0 ? (
        <SceneMentionTextarea
          ref={sceneMentionRef}
          value={description}
          onChange={setDescription}
          elements={flatSceneElements.map(({ index, category, description, frameIndex }) => ({
            index,
            category,
            description,
            frameLabel: frameLabels[frameIndex] || `Frame ${frameIndex + 1}`,
          }))}
          showFrameBadges={frameLabels.length > 1}
          placeholder={contextPlaceholder}
        />
      ) : (
        <ConfigPanel description={description} onDescriptionChange={setDescription} />
      )}
      {enhanceRow}
    </div>
  );

  // Inline CTA — lives directly under the Upload + Model cards so the
  // Analyze + Skip actions feel like the next step of the same flow,
  // not a detached bar pinned to the bottom of the page.
  const ctaRowBlock = phase === "upload" && !contract.supportsElementReferences && !hasRequiredImages ? (
    <div className="pt-2 space-y-3">
      <Button
        data-tour="analyze-button"
        size="lg"
        disabled
        aria-label="Upload an image to continue"
        className="w-full font-display font-medium bg-transparent border border-dashed border-border text-muted-foreground hover:bg-transparent hover:text-muted-foreground disabled:opacity-100"
      >
        Upload an image to continue
      </Button>
    </div>
  ) : phase === "upload" && contract.supportsElementReferences && !hasRequiredImages ? (
    <div className="pt-2 space-y-3">
      <Button
        data-tour="analyze-button"
        size="lg"
        disabled
        aria-label="Add at least one element reference to continue"
        className="w-full font-display font-medium bg-transparent border border-dashed border-border text-muted-foreground hover:bg-transparent hover:text-muted-foreground disabled:opacity-100"
      >
        Add an element reference to continue
      </Button>
    </div>
  ) : phase === "upload" && hasRequiredImages ? (
    <div className="pt-4 mt-2 border-t border-border/60">
      <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm p-4 space-y-2">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-tour="analyze-button"
                size="lg"
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                aria-label={isAnalyzing ? t("wp.analyzingScene") : t("wp.analyzeScene")}
                className="w-full font-display font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25"
              >
                {isAnalyzing ? (
                  <><Loader2 className="w-5 h-5 me-2 animate-spin" /> {t("wp.analyzingScene")}</>
                ) : (
                  <><Sparkles className="w-5 h-5 me-2" /> {t("wp.analyzeScene")}</>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
              {t("wp.analyzeTooltip" as any)}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="text-center text-[11px] text-muted-foreground/80">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Free — no credits charged for prompt generation
          </span>
        </div>
        <div className="flex justify-center pt-1">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => { setTimelineEnabled(false); setSceneFrames([]); setPhase("breakdown"); }}
                  disabled={isAnalyzing}
                  aria-label="Skip & Generate Now"
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:underline"
                >
                  Skip &amp; Generate Now <ArrowRight className="w-3 h-3 rtl:rotate-180" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                {t("wp.skipTooltip" as any)}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
    : (phase === "breakdown" || phase === "generate") ? (

    results ? (
      <div className="pt-6 mt-6 border-t border-border/60 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => {
            const el = document.querySelector('[data-tour="scene-elements"]') as HTMLElement | null;
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline focus:outline-none focus-visible:underline"
        >
          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
          {t("wp.editElements" as any)}
        </button>
      </div>
    ) : (
      <div className="pt-6 mt-6 border-t border-border/60 flex flex-col items-center gap-3">
        {(() => {
          const numericDurations = durationOptions.filter((d): d is number => typeof d === "number");
          const supportsAuto = modelControls.durationAuto === true;
          if (numericDurations.length === 0) return null;
          const min = numericDurations[0];
          const max = numericDurations[numericDurations.length - 1];

          // Fixed-duration model: render a small read-only label, no slider.
          if (numericDurations.length === 1) {
            return (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{t("wp.videoDuration" as any)}</span>
                <span className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-foreground/80">
                  {min}s · fixed
                </span>
              </div>
            );
          }

          // Range/auto durations are controlled by the cinema-console
          // scrubber in the sticky bottom bar — no duplicate slider here.
          return null;
        })()}
        {supportsTimeline && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => { if (!timelineRequired) setTimelineEnabled((v) => !v); }}
                  aria-pressed={timelineEnabled}
                  disabled={timelineRequired}
                  className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    timelineEnabled
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground"
                  } ${timelineRequired ? "cursor-not-allowed opacity-90" : ""}`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{timelineRequired ? "Timeline prompting · Required for Seedance" : "Timeline prompting"}</span>
                  <span
                    className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                      timelineEnabled ? "bg-accent" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-background transition-transform ${
                        timelineEnabled ? "translate-x-[14px]" : "translate-x-0.5"
                      }`}
                    />
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
                {timelineRequired
                  ? "Seedance always uses clock-pinned beats — Timeline Prompting is baked in and can't be turned off."
                  : "Break the scene into clock-pinned beats with camera, light, and audio per timestamp. Best for Seedance, Kling, and Veo."}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {/* Generate CTA lives in the sticky cinema console below — no duplicate here. */}
      </div>
    )
  ) : null;



  // On the breakdown/generate screen, collapse the model picker into a single-line strip.
  const isBreakdownLike = phase === "breakdown" || phase === "generate";
  const inferredModelLabel = getModelLabel(selectedModel);

  const modelBlock = isBreakdownLike ? (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 border border-border/60 bg-muted/40">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-display">
            Model
          </span>
          <span className="text-sm font-display font-medium text-foreground truncate">
            {inferredModelLabel}
          </span>
          {isAnyModel && (
            <span className="text-xs text-muted-foreground hidden sm:inline truncate">
              — Universal Prompt
            </span>
          )}
        </div>
        {audioInlineToggle}
        {audioInlineToggle && <span className="text-muted-foreground/40 text-xs shrink-0">|</span>}
        <button
          type="button"
          onClick={() => setPhase("upload")}
          className="text-xs font-medium hover:underline shrink-0"
          style={{ color: "#F5A524" }}
        >
          Change
        </button>
      </div>
      {contract.supportsAudio && !isAnyModel && (
        <p className="text-[12px] text-muted-foreground px-3">
          Native synced audio for {inferredModelLabel} (ambient sound + dialogue)
        </p>
      )}
    </div>
  ) : (
    <ModelPicker model={selectedModel} onModelChange={(v) => onSwitchModel?.(v)} />
  );

  const leftPanel = (
    <div className="space-y-4">
      <div className="space-y-4">
        {workflowHeaderBlock}
        {modeToggleBlock}
      </div>


      {modelBlock}
      <div>
        {uploadBlock}
      </div>
      {/* On breakdown/generate: textarea first, then Generate at the bottom. */}
      {isBreakdownLike && descriptionBlock}
      {ctaRowBlock}
      {/* On upload phase, description block (if any) renders after the CTA. */}
      {!isBreakdownLike && descriptionBlock}
    </div>
  );

  const startOverBtn = (phase === "breakdown" || phase === "generate") && (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => {
        setPhase("upload");
        setSceneFrames([]);
        setElementDirections({});
        setResults(null);
        setHistory([]); setFeedbackByShot({}); setCritiqueByShot({});
      }}
      aria-label={t("wp.startOver")}
      title={t("wp.startOver")}
      className="gap-1.5 px-2 sm:px-3 text-muted-foreground hover:text-foreground"
    >
      <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t("wp.startOver")}</span>
    </Button>
  );

  const canShowBack =
    !isAnalyzing &&
    !isLoading &&
    (phase === "breakdown" || (phase === "generate" && !results));

  const backBtn = canShowBack && (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => setPhase("upload")}
      aria-label={t("wp.back" as any)}
      title={t("wp.back" as any)}
      className="gap-1.5 px-2 sm:px-3 text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" /> <span className="hidden sm:inline">{t("wp.back" as any)}</span>
    </Button>
  );

  

  const analyzingRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isAnalyzing) return;
    if (!analyzingRef.current) return;
    const id = requestAnimationFrame(() => {
      analyzingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [isAnalyzing]);

  const resultsRef = useRef<HTMLDivElement>(null);
  const scrolledResultsKeyRef = useRef<unknown>(null);
  useEffect(() => {
    if (!results) {
      scrolledResultsKeyRef.current = null;
      return;
    }
    if (scrolledResultsKeyRef.current === results) return;
    if (!resultsRef.current) return;
    scrolledResultsKeyRef.current = results;
    const id = requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [results]);

  // Also scroll the loading skeleton into view the moment generation starts,
  // so users immediately see the "Director at work" UI instead of staring at the button.
  useEffect(() => {
    if (!isLoading || results) return;
    if (!resultsRef.current) return;
    const id = requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [isLoading, results]);

  const resultsBlock = (isLoading && !results) || results ? (
    <div ref={resultsRef} className="relative">
      <AnimatePresence mode="wait" initial={false}>
        {results ? (
          <motion.div
            key="results-panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <ResultsPanel
              results={results}
              onRegenerate={() => handleGenerate()}
              onRegenerateCompact={() => handleGenerate({ compact: true })}
              isLoading={isLoading}
              agentName={agentName ?? undefined}
              modelLabel={MODEL_GROUPS.flatMap(g => g.models).find(m => m.value === selectedModel)?.label ?? selectedModel}
              modelValue={selectedModel}
              stitchHint={workflowType === "multishot" && contract.supportsMultiShotToggle && (contract.multiShotCount ?? 0) > 1}
              elementsLegend={contract.supportsElementReferences && elementItems.length > 0
                ? elementItems.map((el, idx) => ({ index: idx + 1, kind: el.kind, preview: el.preview }))
                : undefined}
              onSwitchModel={selectedModel === "any" ? onSwitchModel : undefined}
              history={history}
              onRestoreSnapshot={(id) => {
                const snap = history.find((h) => h.id === id);
                if (!snap) return;
                setResults(snap.results);
                setAgentName(snap.agentName);
                toast({ title: t("results.history.restored" as any) });
              }}
              isMultiShot={workflowType === "multishot"}
              regeneratingShotIdx={regeneratingShotIdx}
              onRegenerateShot={workflowType === "multishot" ? (idx) => handleGenerate({ replaceShotIdx: idx }) : undefined}
              feedbackByShot={feedbackByShot}
              onFeedbackChange={handleFeedbackChange}
              critiqueByShot={critiqueByShot}
              onRunCritique={handleRunCritique}
              onApplyAddendum={handleApplyAddendum}
              applyingAddendumByShot={applyingAddendumByShot}
              onShare={user ? () => setShareDialogOpen(true) : undefined}
            />
            <ShareDialog
              open={shareDialogOpen}
              onOpenChange={setShareDialogOpen}
              payload={user && results ? {
                userId: user.id,
                workflowType,
                targetModel: selectedModel,
                agentName,
                results,
              } : null}
            />
          </motion.div>
        ) : (
          <motion.div
            key="results-skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {workflowType === "multishot" ? (
              <StoryboardSkeleton
                shotCount={Math.min(10, Math.max(contract.multiShotCount ?? 3, elementItems.length, 2))}
                modelLabel={MODEL_GROUPS.flatMap(g => g.models).find(m => m.value === selectedModel)?.label ?? selectedModel}
              />
            ) : (
              <ResultsSkeleton
                modelLabel={MODEL_GROUPS.flatMap(g => g.models).find(m => m.value === selectedModel)?.label ?? selectedModel}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  ) : null;

  const rightPanel = (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {(phase === "breakdown" || phase === "generate") && sceneFrames.length > 0 && (
          <motion.div key="breakdown-content" {...phaseTransition} className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {backBtn}
                {startOverBtn}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                aria-label={t("wp.reAnalyze")}
                title={t("wp.reAnalyze")}
                className="gap-1.5 px-2 sm:px-3 border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
              >
                <ScanSearch className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t("wp.reAnalyze")}</span>
              </Button>
            </div>

            {resultsBlock}

            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground/90">
              <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
              <span>{t("scene.reviewHint" as any)}</span>
            </div>

            {resetSnapshot && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground"
              >
                <div className="flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t("wp.badgesReset" as any)}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleUndoReset}
                  className="h-6 px-2 text-xs text-foreground hover:text-primary"
                >
                  {t("wp.undo" as any)}
                </Button>
              </motion.div>
            )}

            <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("wp.confirmReset.title" as any)}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {(t("wp.confirmReset.description" as any) as string).replace("{count}", String(pendingResetCount))}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setConfirmResetOpen(false)}>
                    {t("wp.confirmReset.cancel" as any)}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      performAutoReset();
                      setConfirmResetOpen(false);
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t("wp.confirmReset.confirm" as any)}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <SceneBreakdown
              frames={sceneFrames}
              frameLabels={frameLabels}
              framePreviews={images.map((img) => img?.preview || null)}
              directions={elementDirections}
              onDirectionsChange={setElementDirections}
              onInsertMention={(n) => sceneMentionRef.current?.insertMention(n)}
              onManualToggle={(id) => setManualOverrides((prev) => ({ ...prev, [id]: true }))}
            />
          </motion.div>
        )}
        {(phase === "breakdown" || phase === "generate") && sceneFrames.length === 0 && (isLoading || results || startOverBtn) && (
          <div key="startover-fallback" className="space-y-4">
            {startOverBtn && (
              <div className="flex items-center justify-start gap-1.5">
                {backBtn}
                {startOverBtn}
              </div>
            )}
            {phase === "generate" && !isLoading && !results && (
              <div className="flex items-start gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground/90">
                <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <span>{t("wp.skipNoFramesHint" as any)}</span>
              </div>
            )}
            {resultsBlock}
          </div>
        )}
      </AnimatePresence>

      {isAnalyzing && sceneFrames.length === 0 && (
        <div ref={analyzingRef}>
          <AnalyzingSkeleton
            framePreviews={images.map((img) => img?.preview || null)}
            onCancel={handleCancelAnalysis}
          />
        </div>
      )}

    </div>
  );

  const mobileStickyCta = (phase === "breakdown" || phase === "generate") && !isLoading && !isAnalyzing ? (
    <div ref={stickyBarRef} className="sticky-fade-top fixed inset-x-0 bottom-0 z-40 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] bg-background/95 backdrop-blur-md border-t border-border/60">
      <div className="max-w-[720px] mx-auto space-y-2.5">

      {(() => {
        const ars = modelControls.aspectRatios ?? [];
        const numericDurations = durationOptions.filter((d): d is number => typeof d === "number");
        const supportsAuto = modelControls.durationAuto === true;
        const showAR = ars.length > 1;
        const showDur = numericDurations.length > 1 || supportsAuto;
        if (!showAR && !showDur) return null;

        // Aspect ratio frame icon — actual rectangle scaled to the ratio
        const frameIcon = (ar: string, active: boolean) => {
          const [wStr, hStr] = ar.split(":");
          const w = Number(wStr) || 1;
          const h = Number(hStr) || 1;
          const max = 22;
          const scale = max / Math.max(w, h);
          const fw = Math.max(8, Math.round(w * scale));
          const fh = Math.max(8, Math.round(h * scale));
          return (
            <span
              aria-hidden="true"
              className={`inline-block rounded-[2px] border-2 transition-colors ${
                active
                  ? "border-accent bg-accent/20 shadow-[0_0_8px_hsl(var(--accent)/0.35)]"
                  : "border-muted-foreground/50 bg-muted/40 group-hover:border-muted-foreground"
              }`}
              style={{ width: `${fw}px`, height: `${fh}px` }}
            />
          );
        };

        const isAuto = targetDuration === "auto";
        const durMin = numericDurations[0];
        const activeDurNumeric = !isAuto && typeof targetDuration === "number" ? targetDuration : undefined;
        const activeIdx = activeDurNumeric !== undefined ? numericDurations.indexOf(activeDurNumeric) : -1;
        const pctFor = (val: number) =>
          numericDurations.length <= 1 ? 50 : (numericDurations.indexOf(val) / (numericDurations.length - 1)) * 100;
        const activePct = activeIdx >= 0 ? pctFor(activeDurNumeric as number) : 0;

        return (
          <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-md px-3 py-2 shadow-inner grid gap-x-5 gap-y-2 sm:grid-cols-[auto_1fr] items-center">
            {showAR && (
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground font-display shrink-0">Aspect</span>
                <div className="flex gap-0.5 bg-background/60 rounded-lg border border-border/50 p-0.5" role="group" aria-label="Aspect ratio">
                  {ars.map((ar) => {
                    const active = targetAspectRatio === ar;
                    return (
                      <button
                        key={ar}
                        type="button"
                        onClick={() => setTargetAspectRatio(ar)}
                        aria-pressed={active}
                        className={`group flex flex-col items-center justify-end gap-1 px-2 py-1.5 rounded-md border transition-all min-w-[38px] ${
                          active
                            ? "bg-accent/10 border-accent/50"
                            : "border-transparent hover:bg-foreground/5"
                        }`}
                      >
                        <span className="flex items-end justify-center h-[22px]">{frameIcon(ar, active)}</span>
                        <span className={`text-[10px] font-bold font-mono tracking-tight ${active ? "text-accent" : "text-muted-foreground group-hover:text-foreground"}`}>{ar}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {showDur && (
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground font-display shrink-0">Duration</span>
                <div className="relative flex-1 min-w-0">
                  <div className="relative h-12 w-full px-1">
                    {/* Track */}
                    <div className="absolute left-1 right-1 h-[2px] top-1/2 -translate-y-1/2 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-border via-border to-accent transition-all"
                        style={{ width: `${isAuto ? 100 : activePct}%` }}
                      />
                    </div>

                    {/* Tick marks + clickable values */}
                    <div className="absolute inset-x-1 inset-y-0 flex items-center justify-between">
                      {numericDurations.map((d, i) => {
                        const active = !isAuto && d === activeDurNumeric;
                        const isEdge = i === 0 || i === numericDurations.length - 1;
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setTargetDuration(d)}
                            aria-pressed={active}
                            aria-label={`${d} seconds`}
                            className="relative h-12 w-6 -mx-3 first:ml-0 last:mr-0 flex flex-col items-center justify-between py-1 group focus:outline-none"
                          >
                            <span className={`text-[9px] font-mono font-medium tabular-nums transition-colors ${
                              active ? "text-accent" : isEdge ? "text-muted-foreground/80" : "text-muted-foreground/50 group-hover:text-foreground"
                            }`}>{d}s</span>
                            <span className={`w-px transition-all ${
                              active ? "h-4 bg-accent shadow-[0_0_8px_hsl(var(--accent)/0.6)]" : isEdge ? "h-3 bg-muted-foreground/50" : "h-2 bg-border group-hover:bg-muted-foreground"
                            }`} />
                          </button>
                        );
                      })}
                    </div>

                    {/* Handle */}
                    {!isAuto && activeIdx >= 0 && numericDurations.length > 1 && (
                      <div
                        className="absolute top-1/2 pointer-events-none"
                        style={{ left: `calc(${activePct}% + 4px)`, transform: "translate(-50%, -50%)" }}
                      >
                        <div className="w-3 h-3 rounded-full bg-accent shadow-[0_0_12px_hsl(var(--accent)/0.7)] border-2 border-background" />
                      </div>
                    )}
                  </div>
                </div>
                {supportsAuto && (
                  <button
                    type="button"
                    onClick={() => setTargetDuration("auto")}
                    aria-pressed={isAuto}
                    className={`shrink-0 rounded-md border px-2.5 py-1 text-[10px] font-bold font-mono tracking-wide uppercase transition-colors ${
                      isAuto
                        ? "border-accent/50 bg-accent/10 text-accent"
                        : "border-border/60 bg-background/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Auto
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      <Button
        data-tour="generate-button"
        size="lg"
        onClick={() => handleGenerate()}
        disabled={isLoading}
        className="w-full font-display font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25"
      >
        {results ? (
          <><RefreshCw className="w-4 h-4 me-2" /> {t("wp.regeneratePrompt")}</>
        ) : (
          <><Sparkles className="w-4 h-4 me-2" /> {t("wp.generatePrompt")}</>
        )}
      </Button>
      <div className="text-center text-[11px] text-muted-foreground/80">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Free — no credits charged for prompt generation
        </span>
      </div>
      </div>
    </div>

  ) : null;

  // Show the right-side workspace card only when there's actually content
  // (results, loading, analyzing, scene breakdown). When idle, the screen is
  // a clean single column — no empty Examples panel, no empty bordered box.
  const hasRightContent =
    !!results ||
    isLoading ||
    isAnalyzing ||
    ((phase === "breakdown" || phase === "generate") && sceneFrames.length > 0);

  const stepInfo: { n: 1 | 2 | 3; label: string } = (() => {
    if (phase === "upload") return { n: 1, label: "Upload" };
    if (phase === "breakdown") return { n: 2, label: "Review scene" };
    return { n: 3, label: results ? "Prompt ready" : "Generate prompt" };
  })();

  return (
    <div className="w-full max-w-[720px] mx-auto px-4 sm:px-5 lg:px-0">
      <div className="space-y-5 sm:space-y-6" style={{ paddingBottom: stickyBarHeight > 0 ? stickyBarHeight + 24 : 112 }}>
        <div className="flex items-center justify-center gap-2 pt-1 sm:pt-2" aria-label={`Step ${stepInfo.n} of 3: ${stepInfo.label}`}>
          {[1, 2, 3].map((s) => {
            const active = stepInfo.n === s;
            const done = stepInfo.n > s;
            return (
              <div key={s} className="flex items-center gap-2">
                <span
                  className={`flex items-center justify-center w-5 h-5 sm:w-5 sm:h-5 rounded-full text-[10px] font-display font-bold transition-all ${
                    active
                      ? "bg-accent text-accent-foreground shadow-[0_0_12px_hsl(var(--accent)/0.45)]"
                      : done
                        ? "bg-accent/20 text-accent"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? "✓" : s}
                </span>
                {active && (
                  <span className="text-[10.5px] sm:text-[11px] uppercase tracking-[0.14em] font-display font-semibold text-foreground/90">
                    {stepInfo.label}
                  </span>
                )}
                {s < 3 && <span className="w-5 sm:w-6 h-px bg-border/80" aria-hidden="true" />}
              </div>
            );
          })}
        </div>

        <div
          style={{
            opacity: isAnalyzing ? 0.7 : 1,
            transition: "opacity 300ms ease",
          }}
        >
          {leftPanel}
        </div>

        {hasRightContent && (
          <div className="rounded-2xl border border-border bg-card/40 p-4 sm:p-6">
            {rightPanel}
          </div>
        )}
      </div>
      {mobileStickyCta}
    </div>
  );
};
