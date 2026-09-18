import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Sparkles,
  Globe2,
  Loader2,
  Wand2,
  ChevronDown,
  Heart,
  Building2,
  MapPin,
  UserRound,
  X,
  Plus,
  Package,
  AppWindow,
  Download,
  Trash2,
  CheckCircle2,
  Lock,
  Copy,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmRightsDialog } from "@/components/marketing/ConfirmRightsDialog";
import { PresetPickerDialog } from "@/components/marketing/PresetPickerDialog";
import { AdTemplatePickerDialog } from "@/components/marketing/AdTemplatePickerDialog";
import type { AdTemplateRow } from "@/lib/adTemplates";
import { AccuracyBoostDialog } from "@/components/marketing/AccuracyBoostDialog";
import { DescribeAdMic } from "@/components/marketing/DescribeAdMic";
import { evaluateAccuracyRisk, shortTip, type AccuracyRiskResult } from "@/lib/marketing/accuracyRisk";
import {
  FORMATS,
  SETTINGS,
  composeStudioPrompt,
  type Subject,
  type StudioPreset,
} from "@/lib/marketingStudio";
import { useBrandKit, EMPTY_LOCATION, type LocationInput } from "@/lib/marketing/brandKit";
import { useBrandIdentity, hasBrandIdentity } from "@/lib/marketing/brandIdentity";
import { BrandIdentitySheet } from "@/components/marketing/BrandIdentitySheet";
import { BrandKitSheet } from "@/components/marketing/BrandKitSheet";
import { BrandPickerPopover } from "@/components/marketing/BrandPickerPopover";
import { CharacterPickerPopover } from "@/components/marketing/CharacterPickerPopover";
import { CharacterKitSheet } from "@/components/marketing/CharacterKitSheet";
import { useCharacterKit } from "@/lib/marketing/characterKit";
import {
  RenderSettingsPopover,
  RENDER_DEFAULTS,
  type RenderSettings,
} from "@/components/marketing/RenderSettingsPopover";

import { submitVideoJob, pollVideoJob, cancelVideoJob, writeAdScene, type VideoJob } from "@/lib/director/api";
import { estimateVideoCost, usePricing } from "@/lib/credits/pricing";
import { CostChip } from "@/components/credits/CostChip";
import { notifyInsufficientCredits } from "@/lib/credits/insufficient";
import { useCredits } from "@/hooks/useCredits";

const RIGHTS_KEY = "movprompt:rights-ack";
const ACCURACY_ACK_KEY = "movprompt:accuracy-ack";
const find = (list: StudioPreset[], id?: string) =>
  id ? list.find((p) => p.id === id) : undefined;


type UserAd = { id: string; video_url: string; created_at: string; liked: boolean; prompt?: string | null; metadata?: Record<string, any> | null };

export default function MarketingStudio() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const { kits, activeKits: brandKits, activeIds: brandActiveIds, toggleActive: toggleBrandActive, deleteKit: deleteBrand, reload: reloadBrands } = useBrandKit();
  const brandKit = brandKits[0] ?? null;
  const { identity: brandIdentity } = useBrandIdentity();
  const [brandIdentityOpen, setBrandIdentityOpen] = useState(false);
  const {
    kits: characterKits,
    activeKits: characterActiveKits,
    activeIds: characterActiveIds,
    toggleActive: toggleCharacterActive,
    deleteKit: deleteCharacter,
    reload: reloadCharacters,
  } = useCharacterKit();
  const characterKit = characterActiveKits[0] ?? null;
  const [subjectOverride, setSubjectOverride] = useState<Subject | null>(null);
  const subject: Subject = subjectOverride ?? brandKit?.subject ?? "product";
  useEffect(() => {
    if (brandKit?.subject) setSubjectOverride(brandKit.subject);
  }, [brandKit?.subject]);
  const [master, setMaster] = useState("");
  const [formatId, setFormatId] = useState<string | undefined>();
  const [customFormat, setCustomFormat] = useState<string>("");
  const [userNote, setUserNote] = useState<string>("");
  const [settingId, setSettingId] = useState<string | undefined>();
  const [customSetting, setCustomSetting] = useState<string>("");
  const [location, setLocation] = useState<LocationInput>(EMPTY_LOCATION);
  

  const [openPicker, setOpenPicker] = useState<"format" | "location" | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [appliedTemplate, setAppliedTemplate] = useState<{ id: string; name: string } | null>(null);
  const [placeMode, setPlaceMode] = useState<"preset" | "city" | "image">("preset");
  const [brandOpen, setBrandOpen] = useState(false);
  const [brandEditId, setBrandEditId] = useState<string | null>(null);
  const [characterOpen, setCharacterOpen] = useState(false);
  const [characterEditId, setCharacterEditId] = useState<string | null>(null);
  const [characterPickerOpen, setCharacterPickerOpen] = useState(false);
  const autoPromptedFormatRef = useRef<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [accuracyOpen, setAccuracyOpen] = useState(false);
  const [accuracyResult, setAccuracyResult] = useState<AccuracyRiskResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [renderSettings, setRenderSettings] = useState<RenderSettings>(RENDER_DEFAULTS);

  // Live cost estimate + wallet balance — used for pre-flight low-credits warning.
  const pricesTop = usePricing();
  const { balance: creditBalance, refresh: refreshCredits } = useCredits();
  const providerEstimate = location.imagePath ? "seedance-2.0" : "seedance-v1-pro";
  const estimatedCost = estimateVideoCost(pricesTop, providerEstimate, renderSettings.duration);
  const lowCredits = creditBalance !== null && creditBalance < estimatedCost;

  // Reset studio config when the last product is detached
  const prevBrandCountRef = useRef(brandActiveIds.length);
  useEffect(() => {
    const prev = prevBrandCountRef.current;
    const curr = brandActiveIds.length;
    if (prev > 0 && curr === 0) {
      setMaster("");
      setFormatId(undefined);
      setCustomFormat("");
      setUserNote("");
      setSettingId(undefined);
      setCustomSetting("");
      setLocation(EMPTY_LOCATION);
      setPlaceMode("preset");
      setSubjectOverride(null);
      setOpenPicker(null);
      for (const id of characterActiveIds) void toggleCharacterActive(id);
    }
    prevBrandCountRef.current = curr;
  }, [brandActiveIds.length, characterActiveIds, toggleCharacterActive]);

  const [userAds, setUserAds] = useState<UserAd[]>([]);
  const [pendingJobs, setPendingJobs] = useState<VideoJob[]>([]);
  const [deleteAdId, setDeleteAdId] = useState<string | null>(null);
  const [previewAd, setPreviewAd] = useState<UserAd | null>(null);
  const [cancelJobId, setCancelJobId] = useState<string | null>(null);
  const [userAdsLoaded, setUserAdsLoaded] = useState(false);
  const [flashChips, setFlashChips] = useState(false);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const galleryRef = useRef<HTMLElement | null>(null);
  const userNoteRef = useRef<HTMLTextAreaElement | null>(null);
  // Auto-resize the textarea when userNote changes programmatically
  // (voice dictation, Reuse pre-fill, etc.) — typing is handled by onInput.
  useEffect(() => {
    const el = userNoteRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [userNote]);
  const sessionJobIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [{ data: done }, { data: active }] = await Promise.all([
        supabase
          .from("video_jobs")
          .select("id,video_url,created_at,liked,prompt,metadata")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .is("session_id", null)
          .not("video_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("video_jobs")
          .select("id,status,provider,prompt,created_at")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .is("session_id", null)
          .in("status", ["queued", "processing"])
          .gte("created_at", since)
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      if (done) setUserAds(done.filter((d) => d.video_url) as UserAd[]);
      if (active && active.length > 0) {
        setPendingJobs(active as unknown as VideoJob[]);
      }
      setUserAdsLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const shouldRenderNothing = !loading && !user;

  const format = find(FORMATS, formatId);
  const setting = find(SETTINGS, settingId);
  const needsAvatar = format?.category === "avatar" && characterActiveIds.length === 0;
  const needsProduct = brandActiveIds.length === 0 && characterActiveIds.length === 0;
  const sceneLocked = !!format?.lockScene;

  // When a scene-locked format is picked, clear any scene/location selection
  // so it doesn't conflict with the baked-in scene from the format fragment.
  useEffect(() => {
    if (!sceneLocked) return;
    if (settingId) setSettingId(undefined);
    if (customSetting) setCustomSetting("");
    if (location.place || location.imagePath || location.imageUrl) setLocation(EMPTY_LOCATION);
    if (placeMode !== "preset") setPlaceMode("preset");
  }, [sceneLocked]); // eslint-disable-line react-hooks/exhaustive-deps

  // Elite preset is engineered for a 15s, 10-sequence runtime — auto-bump duration on pick.
  useEffect(() => {
    if (formatId === "elite-10seq") {
      setRenderSettings((prev) => (prev.duration === 15 ? prev : { ...prev, duration: 15 }));
    }
  }, [formatId]);

  // ── Like-driven personalization ──────────────────────────────
  // Count likes per formatId / settingId from the user's own ads to rank presets,
  // and surface the top-liked prompts as style references for the scene writer.
  const likeSignal = useMemo(() => {
    const formats: Record<string, number> = {};
    const settings: Record<string, number> = {};
    const likedPrompts: string[] = [];
    for (const ad of userAds) {
      if (!ad.liked) continue;
      const m = (ad.metadata ?? {}) as { formatId?: string; settingId?: string };
      if (m.formatId) formats[m.formatId] = (formats[m.formatId] ?? 0) + 1;
      if (m.settingId) settings[m.settingId] = (settings[m.settingId] ?? 0) + 1;
      if (typeof ad.prompt === "string" && ad.prompt.trim()) likedPrompts.push(ad.prompt.trim());
    }
    return { formats, settings, likedPrompts: likedPrompts.slice(0, 3) };
  }, [userAds]);

  const sortedCommercialFormats = useMemo(() => {
    const list = FORMATS.filter((f) => f.category === "commercial" || f.category === "avatar" || f.category === "ugc");
    return [...list].sort((a, b) => (likeSignal.formats[b.id] ?? 0) - (likeSignal.formats[a.id] ?? 0));
  }, [likeSignal.formats]);


  const sortedSettings = useMemo(() => {
    return [...SETTINGS].sort((a, b) => (likeSignal.settings[b.id] ?? 0) - (likeSignal.settings[a.id] ?? 0));
  }, [likeSignal.settings]);



  const hasInputs =
    master.trim().length > 0 ||
    !!formatId ||
    !!customFormat.trim() ||
    !!settingId ||
    !!customSetting.trim() ||
    !!brandKit?.name ||
    !!characterKit?.name ||
    !!location.place ||
    !!location.imagePath;
  const ready = !!(
    (formatId || customFormat.trim()) &&
    (sceneLocked || settingId || customSetting.trim() || location.place || location.imagePath)
  );

  // Avatar-format auto-prompt: when the user picks an avatar-category format
  // with no character attached, surface the picker (or jump straight to the
  // character editor if they have no saved characters). Only fires once per
  // format pick so we don't fight the user if they dismiss it.
  useEffect(() => {
    if (!formatId) {
      autoPromptedFormatRef.current = null;
      return;
    }
    if (format?.category !== "avatar") return;
    if (characterActiveIds.length > 0) return;
    if (autoPromptedFormatRef.current === formatId) return;
    autoPromptedFormatRef.current = formatId;
    if (characterKits.length === 0) {
      setCharacterEditId(null);
      setCharacterOpen(true);
    } else {
      setCharacterPickerOpen(true);
    }
  }, [formatId, format?.category, characterActiveIds.length, characterKits.length]);

  // Auto-write the describe box from the current Format/Hook/Setting + brand/avatar/location.
  // Re-runs on every trio change. Aborts in-flight requests when picks change again.
  const activeBrandKey = brandActiveIds.join(",");
  const activeCharacterKey = characterActiveIds.join(",");
  useEffect(() => {
    if (!ready) return;
    // Scene-locked formats (e.g. Nokhadha) bake their own scene into the
    // fragment — the edge function requires a location, so just seed the
    // master prompt with the fragment and skip the auto-draft call.
    if (sceneLocked && format?.fragment) {
      setMaster(format.fragment);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setDrafting(true);
      writeAdScene(
        {
          subject,
          format: format
            ? { label: format.label, fragment: format.fragment }
            : customFormat.trim()
              ? { custom: customFormat.trim() }
              : undefined,
          setting: setting
            ? { label: setting.label, fragment: setting.fragment }
            : customSetting.trim()
              ? { custom: customSetting.trim() }
              : undefined,
          brands: brandKits.map((b) => ({
            name: b.name,
            description: b.description,
            tagline: b.tagline,
            audience: b.audience,
            category: b.category,
            visual_parts: b.visual_parts,
            materials: b.materials,
            hero_colors: b.hero_colors,
            packaging: b.packaging,
            angle_labels: (b.references ?? [])
              .filter((r) => r.kind === "angle")
              .map((r) => r.label || "angle"),
          })),
          characters: characterActiveKits.map((c) => ({
            name: c.name,
            role: c.role,
            description: c.description,
            shot_type: c.shot_type,
          })),

          location:
            location.place || location.imagePath
              ? { place: location.place || undefined, hasImage: !!location.imagePath }
              : null,
          userNote: userNote.trim() || undefined,
          brandIdentity: brandIdentity ?? undefined,
          likedExamples: likeSignal.likedPrompts,
        },
        controller.signal,
      )
        .then((scene) => {
          if (controller.signal.aborted) return;
          if (scene) setMaster(scene);
        })
        .catch((err) => {
          if (controller.signal.aborted || err?.name === "AbortError") return;
          console.warn("write-ad-scene failed", err);
          void notifyInsufficientCredits(err).then((handled) => {
            if (!handled) toast.message("Couldn't draft the scene — type your own.");
          });
        })
        .finally(() => {
          if (!controller.signal.aborted) setDrafting(false);
        });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      setDrafting(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formatId,
    customFormat,
    settingId,
    customSetting,
    activeBrandKey,
    activeCharacterKey,
    location.place,
    location.imagePath,
    subject,
    userNote,
    brandIdentity,
  ]);

  const computeAccuracyRisk = (): AccuracyRiskResult =>
    evaluateAccuracyRisk({
      subject,
      brandKits: brandKits.map((b) => ({
        name: b.name,
        logo_url: b.logo_url,
        references: b.references,
      })),
      hasCharacterRef: characterActiveKits.some((c) => !!c.reference_url),
      hasLocationImage: !!location.imageUrl,
      hasBrandIdentity: hasBrandIdentity(brandIdentity),
    });

  const proceedToRights = () => {
    if (sessionStorage.getItem(RIGHTS_KEY) === "1") {
      void doGenerate();
      return;
    }
    setConfirmOpen(true);
  };

  const startGenerate = () => {
    if (!ready) {
      toast.error("Pick a format and scene first.");
      return;
    }
    // Pre-flight wallet check — avoid sending users through the rights modal
    // only to bounce on insufficient credits at submit time.
    if (creditBalance !== null && creditBalance < estimatedCost) {
      toast.error(
        `Not enough credits — you have ${creditBalance}, this render needs ${estimatedCost}.`,
        {
          action: {
            label: "Top up",
            onClick: () => navigate("/account/billing"),
          },
        }
      );
      void refreshCredits();
      return;
    }
    const risk = computeAccuracyRisk();
    const acked = sessionStorage.getItem(ACCURACY_ACK_KEY) === "1";
    if (!acked && (risk.level === "high" || risk.level === "medium") && risk.risks.length > 0) {
      setAccuracyResult(risk);
      setAccuracyOpen(true);
      return;
    }
    proceedToRights();
  };

  const doGenerate = async () => {
    setSubmitting(true);
    try {
      // Build the ordered ref list first so we can tag @ImageN in the prompt
      // in the exact order the URLs are sent to Seedance reference-to-video.
      const refSlots: Array<{ slot: "brand" | "brand-angle" | "character" | "location"; url: string }> = [];
      for (const b of brandKits) {
        if (b.logo_url) refSlots.push({ slot: "brand", url: b.logo_url });
        // Push this brand's angle refs immediately after its hero ref so
        // angle occurrences line up by brand order in the prompt composer.
        const angleRefs = (b.references ?? []).filter((r) => r.kind === "angle" && r.image_url);
        for (const r of angleRefs) {
          refSlots.push({ slot: "brand-angle", url: r.image_url! });
        }
      }
      for (const c of characterActiveKits) {
        if (c.reference_url) refSlots.push({ slot: "character", url: c.reference_url });
      }
      if (location.imageUrl) refSlots.push({ slot: "location", url: location.imageUrl });
      const referenceImages = refSlots.map((r) => r.url);
      const imageRefs = refSlots.map((r) => r.slot);

      const prompt = composeStudioPrompt({
        subject,
        master,
        formatId,
        settingId,
        customFormat: customFormat || undefined,
        customSetting: customSetting || undefined,
        brands: brandKits.map((b) => ({
          name: b.name,
          description: b.description,
          url: b.url,
          tagline: b.tagline,
          audience: b.audience,
          category: b.category,
          visual_parts: b.visual_parts,
          materials: b.materials,
          hero_colors: b.hero_colors,
          packaging: b.packaging,
          angle_labels: (b.references ?? [])
            .filter((r) => r.kind === "angle")
            .map((r) => r.label || "angle"),
        })),
        location: {
          place: location.place || undefined,
          hasImage: !!location.imagePath,
        },
        characters: characterActiveKits.map((c) => ({
          name: c.name,
          description: c.description,
          role: c.role,
          hasImage: !!c.reference_path,
          shot_type: c.shot_type,
        })),

        imageRefs,
        userNote: userNote.trim() || undefined,
        brandIdentity: brandIdentity ?? undefined,
        overlay: {
          mode: renderSettings.overlay_mode,
          logo: renderSettings.overlay_logo,
          headline: renderSettings.overlay_text?.headline?.trim() || undefined,
          cta: renderSettings.overlay_text?.cta?.trim() || undefined,
          price: renderSettings.overlay_text?.price?.trim() || undefined,
        },
      });
      // Provider routing:
      //   0 refs → seedance-v1-pro (text-only, fast/cheap)
      //   1+ refs → seedance-2.0 reference-to-video (identity lock across the clip;
      //             avoids using the product photo as the literal first frame, which
      //             produced a visible "product still" flash at the start of the video)
      const provider =
        referenceImages.length === 0 ? "seedance-v1-pro" : "seedance-2.0-ref";
      const job = await submitVideoJob(
        prompt,
        provider,
        null,
        {
          aspect_ratio: renderSettings.aspect_ratio,
          duration: renderSettings.duration,
          resolution: renderSettings.resolution,
          audio: true,
        },
        referenceImages,
        {
          metadata: {
            formatId: formatId ?? null,
            settingId: settingId ?? null,
            customFormat: customFormat.trim() || null,
            customSetting: customSetting.trim() || null,
            subject,
            place: location.place || null,
          },
        },
      );
      sessionJobIdsRef.current.add(job.id);
      setPendingJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
      toast.success("Generating your ad…");
      window.setTimeout(() => {
        galleryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch (e: any) {
      if (!(await notifyInsufficientCredits(e))) {
        toast.error(e?.message || "Could not start render");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Poll pending jobs until they finish
  useEffect(() => {
    if (pendingJobs.length === 0) return;
    let cancelled = false;
    const interval = window.setInterval(async () => {
      const snapshot = pendingJobs;
      for (const job of snapshot) {
        try {
          const updated = await pollVideoJob(job.id);
          if (cancelled) return;
          if (updated.video_url) {
            sessionJobIdsRef.current.delete(job.id);
            setPendingJobs((prev) => prev.filter((j) => j.id !== job.id));
            setUserAds((prev) => [
              {
                id: updated.id,
                video_url: updated.video_url!,
                created_at: new Date().toISOString(),
                liked: false,
                prompt: (updated as any).prompt ?? null,
              },
              ...prev.filter((a) => a.id !== updated.id),
            ]);
            toast.success("Your ad is ready");
          } else if (updated.status === "failed" || updated.error) {
            const startedThisSession = sessionJobIdsRef.current.has(job.id);
            sessionJobIdsRef.current.delete(job.id);
            setPendingJobs((prev) => prev.filter((j) => j.id !== job.id));
            if (startedThisSession) {
              toast.error(updated.error || "Render failed");
            }
          }
        } catch {
          // ignore transient errors, keep polling
        }
      }
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pendingJobs]);

  const handleCancelJob = (jobId: string) => {
    setCancelJobId(jobId);
  };

  const confirmCancelJob = async () => {
    const jobId = cancelJobId;
    if (!jobId) return;
    setCancelJobId(null);
    // optimistic remove
    setPendingJobs((prev) => prev.filter((j) => j.id !== jobId));
    try {
      await cancelVideoJob(jobId);
      toast.success("Generation canceled");
    } catch (e: any) {
      toast.error(e?.message || "Could not cancel — it may have already finished");
    }
  };

  const handleDownloadAd = async (ad: UserAd) => {
    try {
      const res = await fetch(ad.video_url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `movprompt-${ad.id.slice(0, 8)}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch (e: any) {
      toast.error(e?.message || "Could not download video");
    }
  };

  const handleToggleLike = async (ad: UserAd) => {
    const next = !ad.liked;
    setUserAds((prev) => prev.map((a) => (a.id === ad.id ? { ...a, liked: next } : a)));
    const { error } = await supabase
      .from("video_jobs")
      .update({ liked: next })
      .eq("id", ad.id);
    if (error) {
      setUserAds((prev) => prev.map((a) => (a.id === ad.id ? { ...a, liked: !next } : a)));
      toast.error("Couldn't update like");
    }
  };
  const handleReuseAd = (ad: UserAd) => {
    const m = (ad.metadata || {}) as {
      formatId?: string | null;
      settingId?: string | null;
      customFormat?: string | null;
      customSetting?: string | null;
      subject?: Subject;
      place?: string | null;
    };
    if (!m.formatId && !m.customFormat && !m.settingId && !m.customSetting && !m.place) {
      toast.error("This ad has no setup to reuse.");
      return;
    }
    if (m.subject) setSubjectOverride(m.subject);
    setFormatId(m.formatId ?? undefined);
    setSettingId(m.settingId ?? undefined);
    setCustomFormat(m.customFormat ?? "");
    setCustomSetting(m.customSetting ?? "");
    if (m.place) {
      setLocation({ ...EMPTY_LOCATION, place: m.place });
      setPlaceMode("city");
    } else {
      setLocation(EMPTY_LOCATION);
      setPlaceMode("preset");
    }
    if (ad.prompt) setUserNote(ad.prompt.slice(0, 280));
    setFlashChips(true);
    window.setTimeout(() => setFlashChips(false), 900);
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast.success("Setup loaded — tweak and regenerate.");
  };


  const confirmDeleteAd = async () => {
    const adId = deleteAdId;
    if (!adId) return;
    setDeleteAdId(null);
    const removed = userAds.find((a) => a.id === adId);
    setUserAds((prev) => prev.filter((a) => a.id !== adId));
    const { error } = await supabase
      .from("video_jobs")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", adId);
    if (error) {
      if (removed) setUserAds((prev) => [removed, ...prev]);
      toast.error("Couldn't delete ad");
      return;
    }
    toast.success("Ad deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          const { error: undoErr } = await supabase
            .from("video_jobs")
            .update({ deleted_at: null })
            .eq("id", adId);
          if (undoErr) {
            toast.error("Couldn't restore ad");
            return;
          }
          if (removed) setUserAds((prev) => [removed, ...prev.filter((a) => a.id !== adId)]);
        },
      },
    });
  };

  const adCount = userAds.length;
  const totalCount = adCount + pendingJobs.length;
  const mode: "empty" | "mixed" | "full" =
    totalCount === 0 ? "empty" : totalCount < 10 ? "mixed" : "full";


  const missingHint = !hasInputs
    ? needsProduct
      ? "Attach a product or avatar to start"
      : !formatId && !customFormat.trim()
        ? "Pick a format to continue"
        : "Add a scene or location"
    : "";
  const btnLabel = submitting
    ? "Generating..."
    : !hasInputs
      ? missingHint
      : "Generate ad";

  if (shouldRenderNothing) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background">
        <Helmet>
          <title>Ads Studio — MovPrompt</title>
          <meta
            name="description"
            content="Turn any product or app into a video ad. Attach your product, pick a format and scene — render in one click with Seedance 2.0."
          />
        </Helmet>

        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[560px] h-[320px] bg-[hsl(35_90%_55%)]/12 rounded-full blur-[140px]" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(0_0%_100%/0.4) 1px, transparent 1px), linear-gradient(90deg, hsl(0_0%_100%/0.4) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>

        <TopNav />

        <div className="relative z-10 container max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="text-center mb-5">
            <h1 className="font-display text-[28px] sm:text-[36px] tracking-tight uppercase leading-[1]">
              Turn any product
              <br /> into a video ad
            </h1>
            <p className="text-muted-foreground mt-3 max-w-lg mx-auto text-sm leading-snug">
              Attach a product or avatar, pick a format and scene. We compose the prompt and render your ad.
            </p>
          </div>

          {/* Composer with sidebar */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch max-w-5xl mx-auto w-full">
            {/* Subject sidebar */}
            <div className="flex sm:flex-col gap-1.5 shrink-0 sm:justify-center sm:self-stretch">
              {([
                { id: "product", label: "Product", icon: Package, tip: "Physical or packaged goods" },
                { id: "app", label: "App", icon: AppWindow, tip: "Mobile or web product" },
              ] as const).map(({ id, label, icon: Icon, tip }) => {
                const active = subject === id;
                return (
                  <Tooltip key={id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setSubjectOverride(id)}
                        aria-pressed={active}
                        className={cn(
                          "flex-1 sm:flex-none w-full sm:w-16 h-11 sm:h-16 rounded-xl sm:rounded-2xl border flex flex-row sm:flex-col items-center justify-center gap-1.5 sm:gap-1 text-[11px] font-medium transition-all",
                          active
                            ? "border-[#F5A524]/50 bg-[#F5A524]/10 text-foreground shadow-[0_0_18px_hsl(35_90%_55%/0.18)]"
                            : "border-border/60 bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-border",
                        )}
                      >
                        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                        {label}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">{tip}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

          <div ref={composerRef} className="flex-1 min-w-0 rounded-3xl border border-border/60 bg-[hsl(240_5%_8%)] p-3 sm:p-4 scroll-mt-20 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {brandKits.map((bk, i) => (
                <HoverCard key={bk.id} openDelay={150} closeDelay={80}>
                  <HoverCardTrigger asChild>
                    <div className="inline-flex items-center gap-1.5 h-9 pl-1 pr-1 rounded-full border border-[#F5A524]/40 bg-[#F5A524]/10 text-xs cursor-default">
                      <div className="w-7 h-7 rounded-full bg-white/5 overflow-hidden flex items-center justify-center shrink-0">
                        {bk.logo_url ? (
                          <img src={bk.logo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <span className="font-medium text-foreground truncate max-w-[140px] px-1">
                        {bk.name || (subject === "app" ? "App" : "Product")}
                      </span>
                      {brandKits.length > 1 && i === 0 && (
                        <span className="text-[9px] uppercase tracking-wider text-[#F5A524] font-semibold pr-0.5">Hero</span>
                      )}
                      <button
                        type="button"
                        onClick={() => bk.id && void toggleBrandActive(bk.id)}
                        className="w-6 h-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-background/60 flex items-center justify-center shrink-0"
                        aria-label="Detach product"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent side="top" align="start" sideOffset={8} className="w-64 p-2">
                    <div className="flex items-center justify-center rounded-md bg-black/40 overflow-hidden" style={{ maxHeight: "18rem" }}>
                      {bk.logo_url ? (
                        <img src={bk.logo_url} alt={bk.name || "Brand"} className="max-h-72 w-auto object-contain" />
                      ) : (
                        <Building2 className="w-10 h-10 text-muted-foreground my-8" />
                      )}
                    </div>
                    <p className="mt-2 text-xs font-medium text-foreground truncate px-1">
                      {bk.name || (subject === "app" ? "App" : "Product")}
                    </p>
                  </HoverCardContent>
                </HoverCard>
              ))}
              {brandActiveIds.length < 2 && (
                <BrandPickerPopover
                  kits={kits}
                  activeIds={brandActiveIds}
                  max={2}
                  onSelect={(id) => void toggleBrandActive(id)}
                  onNew={() => { setBrandEditId(null); setBrandOpen(true); }}
                  onEdit={(id) => { setBrandEditId(id); setBrandOpen(true); }}
                  onDelete={(id) => void deleteBrand(id)}
                  trigger={
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-xs transition-colors",
                        needsProduct && !needsAvatar
                          ? "border-[#F5A524] bg-[#F5A524]/15 text-foreground animate-pulse"
                          : "border-dashed border-border/60 bg-secondary/30 text-muted-foreground hover:border-[#F5A524]/50 hover:text-foreground",
                      )}
                      title={needsProduct && !needsAvatar ? "Attach a product to anchor your ad" : undefined}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <Plus className="w-3 h-3" />
                      {brandActiveIds.length === 0 ? (subject === "app" ? "App" : "Product") : "Add"}
                    </button>
                  }
                />
              )}
              {characterActiveKits.map((ck, i) => (
                <HoverCard key={ck.id} openDelay={150} closeDelay={80}>
                  <HoverCardTrigger asChild>
                    <div className="inline-flex items-center gap-1.5 h-9 pl-1 pr-1 rounded-full border border-[#F5A524]/40 bg-[#F5A524]/10 text-xs cursor-default">
                      <div className="w-7 h-7 rounded-full bg-white/5 overflow-hidden flex items-center justify-center shrink-0">
                        {ck.reference_url ? (
                          <img src={ck.reference_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <UserRound className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <span className="font-medium text-foreground truncate max-w-[140px] px-1">
                        {ck.name || "Avatar"}
                      </span>
                      {characterActiveKits.length > 1 && i === 0 && (
                        <span className="text-[9px] uppercase tracking-wider text-[#F5A524] font-semibold pr-0.5">Lead</span>
                      )}
                      <button
                        type="button"
                        onClick={() => ck.id && void toggleCharacterActive(ck.id)}
                        className="w-6 h-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-background/60 flex items-center justify-center shrink-0"
                        aria-label="Detach character"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent side="top" align="start" sideOffset={8} className="w-64 p-2">
                    <div className="flex items-center justify-center rounded-md bg-black/40 overflow-hidden" style={{ maxHeight: "18rem" }}>
                      {ck.reference_url ? (
                        <img src={ck.reference_url} alt={ck.name || "Avatar"} className="max-h-72 w-auto object-contain" />
                      ) : (
                        <UserRound className="w-10 h-10 text-muted-foreground my-8" />
                      )}
                    </div>
                    <p className="mt-2 text-xs font-medium text-foreground truncate px-1">
                      {ck.name || "Avatar"}
                    </p>
                  </HoverCardContent>
                </HoverCard>
              ))}
              {characterActiveIds.length < 3 && (
                <CharacterPickerPopover
                  kits={characterKits}
                  activeIds={characterActiveIds}
                  max={3}
                  open={characterPickerOpen}
                  onOpenChange={setCharacterPickerOpen}
                  onSelect={(id) => void toggleCharacterActive(id)}
                  onNew={() => { setCharacterEditId(null); setCharacterOpen(true); }}
                  onEdit={(id) => { setCharacterEditId(id); setCharacterOpen(true); }}
                  onDelete={(id) => void deleteCharacter(id)}
                  trigger={
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-xs transition-colors ${
                        needsAvatar
                          ? "border-[#F5A524] bg-[#F5A524]/15 text-foreground animate-pulse"
                          : "border-dashed border-border/60 bg-secondary/30 text-muted-foreground hover:border-[#F5A524]/50 hover:text-foreground"
                      }`}
                      title={needsAvatar ? "This format needs an avatar — attach one to lock the face" : undefined}
                    >
                      <UserRound className="w-3.5 h-3.5" />
                      <Plus className="w-3 h-3" />
                      {needsAvatar
                        ? "Attach avatar"
                        : characterActiveIds.length === 0 ? "Avatar" : "Add"}
                    </button>
                  }

                />
              )}
            </div>

            <div className="flex items-start gap-1 min-h-11 w-full rounded-2xl bg-[hsl(240_5%_6%)] px-3 py-2">
              <textarea
                ref={userNoteRef}
                value={userNote}
                onChange={(e) => setUserNote(e.target.value.slice(0, 280))}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 140) + "px";
                }}
                placeholder="Describe your ad…"
                maxLength={280}
                rows={1}
                aria-label="Describe your ad"
                className="flex-1 bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground/70 resize-none overflow-hidden leading-6 py-0.5"
              />
              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                <DescribeAdMic value={userNote} onChange={setUserNote} maxLength={280} />
                {userNote.trim() && (
                  <button
                    type="button"
                    onClick={() => setUserNote("")}
                    className="w-6 h-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-background/60 flex items-center justify-center"
                    aria-label="Clear description"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {!userNote.trim() && (() => {
              const examples =
                format?.category === "avatar" || characterActiveIds.length > 0
                  ? [
                      "POV trying it on for the first time",
                      "Founder talking-head testimonial",
                      "Reaction shot — eyes light up",
                      "Voiceover walkthrough, casual tone",
                    ]
                  : subject === "app"
                  ? [
                      "Tap-through of the killer feature",
                      "Before / after split screen",
                      "Phone-in-hand demo, thumb scrolling",
                      "UI close-up with caption pops",
                    ]
                  : [
                      "Slow-mo unboxing on a clean surface",
                      "360° hero spin with rim light",
                      "Macro detail shot, shallow depth",
                      "Product drops into frame, splash",
                    ];
              return (
                <div className="flex flex-wrap items-center gap-1.5 -mt-1 pl-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium pr-1">
                    Try
                  </span>
                  {examples.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setUserNote(ex)}
                      className="text-[11px] px-2.5 h-7 rounded-full border border-border/40 bg-muted/15 text-muted-foreground hover:text-foreground hover:border-[hsl(190_90%_50%)]/50 hover:bg-[hsl(190_90%_50%)]/10 transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              );
            })()}

            <div className="flex flex-wrap items-center gap-2">

              <PresetChip
                icon={<Sparkles className="w-3.5 h-3.5" />}
                label="Template"
                value={appliedTemplate?.name}
                tooltip="Seed the composer from a saved ad template"
                onClick={() => setTemplatePickerOpen(true)}
                flash={flashChips}
              />


              <PresetChip
                icon={<Sparkles className="w-3.5 h-3.5" />}
                label="Format"
                value={
                  format?.label ||
                  (customFormat.trim()
                    ? `Custom: ${customFormat.trim().slice(0, 24)}${customFormat.trim().length > 24 ? "…" : ""}`
                    : undefined)
                }
                tooltip="The visual style of your ad"
                onClick={() => setOpenPicker("format")}
                flash={flashChips}
              />
              <PresetChip
                icon={<Globe2 className="w-3.5 h-3.5" />}
                label="Scene"
                value={(() => {
                  if (sceneLocked) return "Baked into format";
                  if (placeMode === "image" && location.imagePath) return "Reference image";
                  if (placeMode === "city" && location.place) return location.place;
                  const sceneLabel =
                    setting?.label ||
                    (customSetting.trim()
                      ? `Custom: ${customSetting.trim().slice(0, 28)}${customSetting.trim().length > 28 ? "…" : ""}`
                      : undefined);
                  if (sceneLabel) {
                    const locSuffix = location.place ? ` · ${location.place}` : location.imagePath ? " · Ref image" : "";
                    return `${sceneLabel}${locSuffix}`;
                  }
                  if (location.imagePath) return "Reference image";
                  if (location.place) return location.place;
                  return undefined;
                })()}
                tooltip={
                  sceneLocked
                    ? `${format?.label} bakes in its own scene — no location pick needed`
                    : "Where the ad takes place — preset scene, real city, or reference image"
                }
                disabled={sceneLocked}
                locked={sceneLocked}
                lockedReason={`${format?.label || "This format"} bakes in its own scene — no location pick needed.`}
                onClick={() => {
                  // Pre-select mode based on current state
                  if (location.imagePath) setPlaceMode("image");
                  else if (location.place) setPlaceMode("city");
                  else setPlaceMode("preset");
                  setOpenPicker("location");
                }}
                flash={flashChips}
              />


              <RenderSettingsPopover value={renderSettings} onChange={setRenderSettings} />
              {(() => {
                const applied = hasBrandIdentity(brandIdentity);
                const swatches = [
                  brandIdentity?.primary_color,
                  ...(brandIdentity?.supporting_colors ?? []),
                ].filter(Boolean).slice(0, 3) as string[];
                const filledCount = applied
                  ? [
                      brandIdentity?.logo_path,
                      brandIdentity?.primary_color,
                      brandIdentity?.typography_vibe,
                      brandIdentity?.tagline,
                      brandIdentity?.mood_notes,
                      brandIdentity?.lighting_style,
                    ].filter(Boolean).length
                  : 0;
                const btn = (
                  <button
                    type="button"
                    onClick={() => setBrandIdentityOpen(true)}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-9 pl-1.5 pr-3 rounded-full border text-xs transition-colors",
                      applied
                        ? "border-[#F5A524]/50 bg-[#F5A524]/10 text-foreground"
                        : "border-dashed border-border/60 bg-secondary/30 text-muted-foreground hover:text-foreground hover:border-[#F5A524]/50 pl-3",
                    )}
                  >
                    {applied && brandIdentity?.logo_url ? (
                      <span className="w-6 h-6 rounded-full bg-white/5 overflow-hidden flex items-center justify-center shrink-0 border border-border/40">
                        <img src={brandIdentity.logo_url} alt="" className="w-full h-full object-cover" />
                      </span>
                    ) : applied && swatches.length > 0 ? (
                      <span className="flex items-center -space-x-1">
                        {swatches.map((c, i) => (
                          <span
                            key={i}
                            className="w-3.5 h-3.5 rounded-full border border-border/60"
                            style={{ background: c, zIndex: 10 - i }}
                          />
                        ))}
                      </span>
                    ) : null}
                    <span className="font-medium">Brand kit</span>
                    {applied ? (
                      <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-[#F5A524] font-semibold">
                        <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} />
                        {filledCount}/6
                      </span>
                    ) : (
                      <Plus className="w-3 h-3 opacity-70" />
                    )}
                  </button>
                );
                if (!applied) {
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>{btn}</TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px] text-xs">
                        Add logo, colors, typography, and tone for on-brand renders.
                      </TooltipContent>
                    </Tooltip>
                  );
                }
                return (
                  <HoverCard openDelay={150} closeDelay={80}>
                    <HoverCardTrigger asChild>{btn}</HoverCardTrigger>
                    <HoverCardContent side="top" align="start" sideOffset={8} className="w-72 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        {brandIdentity?.logo_url ? (
                          <span className="w-10 h-10 rounded-md bg-black/40 overflow-hidden flex items-center justify-center shrink-0 border border-border/40">
                            <img src={brandIdentity.logo_url} alt="" className="w-full h-full object-contain" />
                          </span>
                        ) : (
                          <span className="w-10 h-10 rounded-md bg-muted/30 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-foreground">Brand kit applied</div>
                          <div className="text-[10px] text-muted-foreground">{filledCount} of 6 fields set</div>
                        </div>
                      </div>
                      {swatches.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-2">
                          {swatches.map((c, i) => (
                            <span key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <span className="w-3 h-3 rounded-full border border-border/40" style={{ background: c }} />
                              <span className="font-mono">{c}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {brandIdentity?.tagline && (
                        <div className="text-[11px] text-foreground/90 italic line-clamp-2">"{brandIdentity.tagline}"</div>
                      )}
                      {(brandIdentity?.typography_vibe || brandIdentity?.lighting_style || brandIdentity?.finish_vibe) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {brandIdentity?.typography_vibe && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/30 text-muted-foreground">{brandIdentity.typography_vibe}</span>
                          )}
                          {brandIdentity?.lighting_style && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/30 text-muted-foreground">{brandIdentity.lighting_style}</span>
                          )}
                          {brandIdentity?.finish_vibe && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/30 text-muted-foreground">{brandIdentity.finish_vibe}</span>
                          )}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setBrandIdentityOpen(true)}
                        className="mt-3 w-full h-7 rounded-md border border-border/50 bg-muted/20 text-[11px] text-foreground/80 hover:text-foreground hover:border-[#F5A524]/50"
                      >
                        Edit brand kit
                      </button>
                    </HoverCardContent>
                  </HoverCard>
                );
              })()}

              <div className="ml-auto flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">
                      <CostChip amount={estimatedCost} prefix="≈" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px] text-xs">
                    <div className="font-medium text-foreground">Estimated cost: {estimatedCost} credits</div>
                    <div className="text-muted-foreground mt-0.5">
                      {renderSettings.duration}s · {renderSettings.resolution}
                    </div>
                    {creditBalance !== null && (
                      <div className={cn(
                        "mt-1 text-[10px]",
                        lowCredits ? "text-[#F87171]" : "text-muted-foreground/70",
                      )}>
                        Wallet: {creditBalance} credits {lowCredits && "— top up to render"}
                      </div>
                    )}
                    <div className="text-muted-foreground/70 mt-1 text-[10px]">
                      Final cost may vary slightly. Deducted only on successful render.
                    </div>
                  </TooltipContent>
                </Tooltip>
                {lowCredits && (
                  <button
                    type="button"
                    onClick={() => navigate("/account/billing")}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-[#F87171]/50 bg-[#F87171]/10 text-[11px] text-[#F87171] hover:bg-[#F87171]/20 transition-colors"
                    title={`You have ${creditBalance} credits, this render needs ${estimatedCost}`}
                  >
                    Low credits — Top up
                  </button>
                )}
                 <Tooltip>
                   <TooltipTrigger asChild>
                     <span className={cn(!hasInputs && "cursor-help")}>
                       <Button
                         size="sm"
                         disabled={!hasInputs || submitting || drafting}
                         onClick={startGenerate}
                         className={cn(
                           "rounded-full px-4 h-9 font-semibold text-xs transition-all",
                           hasInputs
                             ? "bg-[#F5A524] text-black hover:bg-[#F5A524]/90 shadow-lg shadow-[#F5A524]/25"
                             : "bg-muted text-muted-foreground hover:bg-muted pointer-events-none",
                         )}
                       >
                         {submitting ? (
                           <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                         ) : hasInputs ? (
                           <Wand2 className="w-3.5 h-3.5 mr-1.5" />
                         ) : null}
                         {btnLabel}
                       </Button>
                     </span>
                   </TooltipTrigger>
                   {!hasInputs && (
                     <TooltipContent side="top" className="max-w-[240px] text-xs">
                       {missingHint}. Then pick a format and scene to render.
                     </TooltipContent>
                   )}
                 </Tooltip>
               </div>
             </div>

            {ready && (
              <div className="mt-2 rounded-xl border border-border/30 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
                <span className="text-foreground/80 font-medium">Renders as:</span>{" "}
                {format?.label || "Custom format"} · {setting?.label || customSetting.trim() || location.place || "Reference image"} · {renderSettings.aspect_ratio} · {renderSettings.duration}s · {renderSettings.resolution} · {renderSettings.overlay_mode === "none" ? "clean (no overlay)" : `overlay: ${renderSettings.overlay_mode.replace("_", "-")}${renderSettings.overlay_logo ? " + logo" : ""}`} · audio on
              </div>
            )}

            {ready && (() => {
              const risk = computeAccuracyRisk();
              const tip = shortTip(risk);
              if (!tip) return null;
              return (
                <button
                  type="button"
                  onClick={() => { setAccuracyResult(risk); setAccuracyOpen(true); }}
                  className="mt-2 text-[11px] text-amber-400/90 hover:text-amber-300 underline-offset-2 hover:underline text-left"
                >
                  {tip}
                </button>
              );
            })()}
          </div>
          </div>

          {/* Ads gallery */}
          <section ref={galleryRef} className="mt-8 scroll-mt-20 max-w-5xl mx-auto">
            {mode === "empty" && userAdsLoaded && (
              <div className="rounded-2xl border border-dashed border-border/50 bg-secondary/20 px-6 py-10 text-center">
                <h2 className="text-base font-semibold text-foreground">No ads yet</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Attach a product or avatar above, pick a format, and hit Generate.
                </p>
              </div>
            )}

            {mode === "mixed" && (
              <div>
                <SectionHeader
                  title="Your recent ads"
                  subtitle={
                    pendingJobs.length > 0
                      ? "Your ad is rendering — it'll appear here in a moment."
                      : "Pick up where you left off — or remix one of yours."
                  }
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {pendingJobs.map((job) => (
                    <PendingAdCard key={job.id} onCancel={() => handleCancelJob(job.id)} />
                  ))}
                  {userAds.map((ad) => (
                    <UserAdCard
                      key={ad.id}
                      ad={ad}
                      onClick={() => setPreviewAd(ad)}
                      onDownload={() => handleDownloadAd(ad)}
                      onReuse={() => handleReuseAd(ad)}
                      onToggleLike={() => handleToggleLike(ad)}
                      onDelete={() => setDeleteAdId(ad.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {mode === "full" && (
              <>
                <SectionHeader
                  title="Your ads"
                  subtitle={
                    pendingJobs.length > 0
                      ? "Your ad is rendering — it'll appear here in a moment."
                      : "Tap one to revisit it in your Library."
                  }
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {pendingJobs.map((job) => (
                    <PendingAdCard key={job.id} onCancel={() => handleCancelJob(job.id)} />
                  ))}
                  {userAds.map((ad) => (
                    <UserAdCard
                      key={ad.id}
                      ad={ad}
                      onClick={() => setPreviewAd(ad)}
                      onDownload={() => handleDownloadAd(ad)}
                      onReuse={() => handleReuseAd(ad)}
                      onToggleLike={() => handleToggleLike(ad)}
                      onDelete={() => setDeleteAdId(ad.id)}
                    />
                  ))}
                </div>

              </>
            )}
          </section>
        </div>

        <PresetPickerDialog
          open={openPicker === "format"}
          onOpenChange={(o) => !o && setOpenPicker(null)}
          title="Pick the format that hits"
          subtitle="Polished brand formats — pick the commercial style that fits your product."
          presets={sortedCommercialFormats}
          selectedId={formatId}
          onSelect={setFormatId}
          searchPlaceholder="Search formats…"
          customLabel="Custom format"
          customValue={customFormat}
          onCustomChange={setCustomFormat}
          categories={[
            { id: "commercial", label: "Commercial", tooltip: "Polished brand formats" },
            { id: "ugc", label: "UGC", tooltip: "Raw, social-first formats — selfie, tutorial, day-to-night" },
            { id: "avatar", label: "Avatar", tooltip: "Avatar-driven formats — face-lock onto your uploaded character" },
          ]}

        />
        <PresetPickerDialog
          open={openPicker === "location"}
          onOpenChange={(o) => !o && setOpenPicker(null)}
          title="Pick the scene"
          subtitle="Where does the ad take place? Choose a preset scene, a real city, or a reference photo — one mode wins to keep the prompt clean."
          presets={sortedSettings}
          selectedId={settingId}
          onSelect={setSettingId}
          searchPlaceholder="Search scenes… (try 'rooftop' or 'cafe')"
          customLabel="Custom scene"
          categories={[
            { id: "realistic", label: "Real", tooltip: "Real-world settings — bedrooms, kitchens, streets" },
            { id: "unrealistic", label: "Stylized", tooltip: "Stylized scenes — surreal, dramatic, cinematic" },
          ]}
          locationValue={location}
          onLocationChange={setLocation}
          customValue={customSetting}
          onCustomChange={setCustomSetting}
          placeMode={placeMode}
          onPlaceModeChange={(m) => {
            setPlaceMode(m);
            if (m !== "preset") {
              setSettingId(undefined);
              setCustomSetting("");
            }
          }}
        />

        <CharacterKitSheet
          open={characterOpen}
          onOpenChange={(o) => {
            setCharacterOpen(o);
            if (!o) setCharacterEditId(null);
          }}
          kitId={characterEditId}
          onSaved={() => { void reloadCharacters(); }}
        />

        <BrandKitSheet
          open={brandOpen}
          onOpenChange={(o) => {
            setBrandOpen(o);
            if (!o) setBrandEditId(null);
          }}
          kitId={brandEditId}
          onSaved={() => { void reloadBrands(); }}
        />

        <BrandIdentitySheet open={brandIdentityOpen} onOpenChange={setBrandIdentityOpen} />

        <AdTemplatePickerDialog
          open={templatePickerOpen}
          onOpenChange={setTemplatePickerOpen}
          onSelect={(t: AdTemplateRow) => {
            const tj = t.template_json;
            setAppliedTemplate({ id: t.id, name: t.name });
            setFormatId(undefined);
            setCustomFormat(t.name);
            const shotLines = (tj.shots ?? [])
              .slice(0, 6)
              .map((s) => `${s.index}. ${s.beat}: ${s.description}`)
              .join("\n");
            const note = [
              tj.tagline,
              tj.goal ? `Goal: ${tj.goal}` : "",
              tj.pacing ? `Pacing: ${tj.pacing}` : "",
              tj.camera_language?.movement ? `Camera: ${tj.camera_language.movement}` : "",
              tj.lighting ? `Lighting: ${tj.lighting}` : "",
              shotLines ? `Shots:\n${shotLines}` : "",
            ]
              .filter(Boolean)
              .join("\n");
            setUserNote(note);
            setRenderSettings((prev) => ({
              ...prev,
              aspect_ratio: tj.aspect_ratio || prev.aspect_ratio,
              duration: tj.duration_seconds || prev.duration,
            }));
            toast.success(`Applied "${t.name}"`);
          }}
        />




        <ConfirmRightsDialog
          open={confirmOpen}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={(dontShow) => {
            if (dontShow) sessionStorage.setItem(RIGHTS_KEY, "1");
            setConfirmOpen(false);
            void doGenerate();
          }}
        />

        <AccuracyBoostDialog
          open={accuracyOpen}
          result={accuracyResult}
          onCancel={() => setAccuracyOpen(false)}
          onGenerateAnyway={(dontShow) => {
            if (dontShow) sessionStorage.setItem(ACCURACY_ACK_KEY, "1");
            setAccuracyOpen(false);
            proceedToRights();
          }}
          onAddPhotos={() => {
            setAccuracyOpen(false);
            const target = brandKits.find(
              (b) => !b.logo_url || (b.references ?? []).filter((r) => r.kind === "angle").length === 0,
            ) ?? brandKits[0];
            setBrandEditId(target?.id ?? null);
            setBrandOpen(true);
          }}
          onAddIdentity={() => {
            setAccuracyOpen(false);
            setBrandIdentityOpen(true);
          }}
        />

        <AlertDialog open={cancelJobId !== null} onOpenChange={(o) => !o && setCancelJobId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this generation?</AlertDialogTitle>
              <AlertDialogDescription>
                You won't be charged for canceled jobs, but any in-progress work will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep generating</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmCancelJob}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Cancel generation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteAdId !== null} onOpenChange={(o) => !o && setDeleteAdId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this ad?</AlertDialogTitle>
              <AlertDialogDescription>
                The ad will be removed from your library. You can undo from the toast for a few seconds.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteAd}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={previewAd !== null} onOpenChange={(o) => !o && setPreviewAd(null)}>
          <DialogContent className="max-w-[95vw] w-auto p-0 bg-black border-border/40 overflow-hidden">
            {previewAd && (
              <div className="flex flex-col">
                <video
                  src={previewAd.video_url}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="max-w-[95vw] max-h-[85vh] w-auto h-auto object-contain bg-black"
                />
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-black/80 text-white">
                  <span className="text-xs opacity-70">
                    {new Date(previewAd.created_at).toLocaleString()}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleLike(previewAd)}
                      aria-label={previewAd.liked ? "Unlike" : "Like"}
                      className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center transition"
                    >
                      <Heart className="h-4 w-4" fill={previewAd.liked ? "currentColor" : "none"} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadAd(previewAd)}
                      aria-label="Download"
                      className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center transition"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function PresetChip({
  icon,
  label,
  value,
  tooltip,
  onClick,
  flash,
  disabled,
  locked,
  lockedReason,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  tooltip: string;
  onClick: () => void;
  flash?: boolean;
  disabled?: boolean;
  locked?: boolean;
  lockedReason?: string;
}) {
  const handleClick = () => {
    if (locked) {
      toast(lockedReason || tooltip, { icon: "🔒", duration: 3500 });
      return;
    }
    if (disabled) return;
    onClick();
  };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled && !locked}
          aria-disabled={locked || disabled}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 h-9 text-xs transition-all duration-300",
            locked
              ? "border-[hsl(35_90%_55%)]/30 bg-[hsl(35_90%_55%)]/[0.06] text-foreground/70 cursor-help"
              : disabled
              ? "border-border/30 bg-muted/10 text-muted-foreground/60 cursor-not-allowed opacity-70"
              : value
              ? "border-[hsl(0_72%_55%)]/50 bg-[hsl(0_72%_55%)]/10 text-foreground"
              : "border-border/40 bg-muted/20 text-muted-foreground hover:text-foreground hover:border-border",
            !disabled && !locked && flash && value &&
              "border-[hsl(35_90%_55%)] bg-[hsl(35_90%_55%)]/20 text-foreground shadow-[0_0_18px_hsl(35_90%_55%/0.5)] scale-[1.04]",
          )}
        >
          {icon}
          <span className="font-medium">
            {value ? `${label}: ${value}` : label}
          </span>
          {locked ? (
            <Lock className="w-3 h-3 opacity-70 text-[hsl(35_90%_55%)]" />
          ) : !disabled ? (
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          ) : null}
        </button>
      </TooltipTrigger>
      <TooltipContent>{locked ? (lockedReason || tooltip) : tooltip}</TooltipContent>
    </Tooltip>
  );
}

function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
      <div>
        <h2 className="font-display text-xl sm:text-2xl tracking-tight uppercase">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}


function ToggleTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1 text-xs rounded-full transition-colors",
        active
          ? "bg-background text-foreground border border-border/60"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}


function UserAdCard({
  ad,
  onClick,
  onDownload,
  onReuse,
  onToggleLike,
  onDelete,
}: {
  ad: UserAd;
  onClick: () => void;
  onDownload?: () => void;
  onReuse?: () => void;
  onToggleLike?: () => void;
  onDelete?: () => void;
}) {
  const stop = (fn?: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn?.();
  };
  const videoRef = useRef<HTMLVideoElement>(null);
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const playVideo = () => {
    videoRef.current?.play().catch(() => {});
  };
  const pauseVideo = () => {
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0.1;
    }
  };
  // `#t=0.1` nudges the browser to paint the first frame as a poster on metadata load.
  const posterSrc = ad.video_url ? `${ad.video_url}${ad.video_url.includes("#") ? "" : "#t=0.1"}` : "";
  const shortPrompt = (ad.prompt || "").trim().slice(0, 90);
  return (
    <article
      onClick={onClick}
      onMouseEnter={playVideo}
      onMouseLeave={pauseVideo}
      onFocus={playVideo}
      onBlur={pauseVideo}
      className="group relative overflow-hidden rounded-2xl border border-border/40 bg-muted/10 cursor-pointer transition-all hover:border-[hsl(35_90%_55%)]/60 hover:shadow-[0_0_24px_hsl(35_90%_55%/0.25)]"
    >
      <div className="aspect-[3/4] overflow-hidden relative bg-gradient-to-br from-[hsl(240_8%_10%)] via-[hsl(240_6%_7%)] to-[hsl(240_8%_10%)]">
        {!broken ? (
          <>
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-muted-foreground/40 animate-spin" />
              </div>
            )}
            <video
              ref={videoRef}
              src={posterSrc}
              muted
              loop
              playsInline
              preload="metadata"
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                if (v.currentTime < 0.05) {
                  try { v.currentTime = 0.1; } catch { /* noop */ }
                }
                setLoaded(true);
              }}
              onError={() => setBroken(true)}
              className={cn(
                "w-full h-full object-cover transition-all duration-500 group-hover:scale-105",
                loaded ? "opacity-100" : "opacity-0",
              )}
            />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-muted-foreground/60" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
              Render unavailable
            </span>
            {shortPrompt && (
              <span className="text-[11px] text-muted-foreground/80 line-clamp-3 leading-snug">
                {shortPrompt}{ad.prompt && ad.prompt.length > 90 ? "…" : ""}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        {onReuse && !broken && (
          <button
            type="button"
            onClick={stop(onReuse)}
            aria-label="Reuse setup"
            title="Reuse this setup in the composer"
            className="h-8 px-2.5 rounded-full bg-black/55 backdrop-blur border border-white/10 grid place-items-center text-white hover:bg-black/75 hover:border-[hsl(35_90%_55%)]/60 hover:text-[hsl(35_90%_55%)] transition"
          >
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider">
              <Copy className="h-3 w-3" />
              Reuse
            </span>
          </button>
        )}
        {onToggleLike && (
          <button
            type="button"
            onClick={stop(onToggleLike)}
            aria-label={ad.liked ? "Unlike" : "Like"}
            className="h-8 w-8 rounded-full bg-black/55 backdrop-blur border border-white/10 grid place-items-center text-white hover:bg-black/75 hover:border-[hsl(35_90%_55%)]/60 hover:text-[hsl(35_90%_55%)] transition"
          >
            <Heart className="h-4 w-4" fill={ad.liked ? "currentColor" : "none"} />
          </button>
        )}
        {onDownload && (
          <button
            type="button"
            onClick={stop(onDownload)}
            aria-label="Download"
            className="h-8 w-8 rounded-full bg-black/55 backdrop-blur border border-white/10 grid place-items-center text-white hover:bg-black/75 hover:border-[hsl(190_90%_50%)]/60 hover:text-[hsl(190_90%_50%)] transition"
          >
            <Download className="h-4 w-4" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={stop(onDelete)}
            aria-label="Delete"
            className="h-8 w-8 rounded-full bg-black/55 backdrop-blur border border-white/10 grid place-items-center text-white hover:bg-destructive/80 hover:border-destructive transition"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-white">
        <span className="text-xs opacity-80">
          {new Date(ad.created_at).toLocaleDateString()}
        </span>
      </div>
    </article>
  );
}

function PendingAdCard({ onCancel }: { onCancel?: () => void }) {
  return (
    <article
      aria-busy="true"
      className="group relative overflow-hidden rounded-2xl border border-[hsl(35_90%_55%)]/60 bg-muted/10 shadow-[0_0_24px_hsl(35_90%_55%/0.25)]"
    >
      <div className="aspect-[3/4] relative bg-gradient-to-br from-muted/25 via-muted/10 to-muted/25 animate-pulse">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
          <Loader2 className="w-6 h-6 text-[hsl(35_90%_55%)] animate-spin" />
          <span className="text-xs uppercase tracking-[0.18em] text-foreground/80 font-semibold">
            Generating…
          </span>
          <span className="text-[10.5px] text-muted-foreground">Rendering — usually 1–3 minutes</span>
        </div>
      </div>
      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[hsl(35_90%_55%)]/90 backdrop-blur text-[10px] uppercase tracking-wide text-black font-semibold">
        Generating
      </div>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel generation"
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur text-white/90 hover:text-white hover:bg-black/80 flex items-center justify-center transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </article>
  );
}
