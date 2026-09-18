import { useCallback, useEffect, useRef, useState } from "react";
import {
  Aperture,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Expand,
  Focus,
  Frame,
  ImagePlus,
  Loader2,
  Maximize2,
  Mic2,
  Move3D,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Upload,
  WandSparkles,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import { isFeatureEnabled } from "@/config/features";
import {
  advancedCampaignRecipe,
  buildAdvancedGenerationConfiguration,
  buildAdvancedProjectConfiguration,
  providerCanvasRatio,
  type AdvancedReferenceConfiguration,
  type AdvancedStudioConfigurationInput,
} from "@/features/create/advancedStudioConfig";
import { persistPortableAdvancedProject } from "@/features/create/advancedProjectStore";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { PortableApiError, portableCreatorApi } from "@/lib/api/portableApiClient";
import { startCreatorGeneration } from "@/lib/director/api";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { AuthGateDialog } from "@/features/create/AuthGateDialog";
import { CreatorShell } from "@/features/create/CreatorShell";
import { GUEST_DRAFT_TTL_MS, type ApprovedCapability, type CreationDraft, type GenerationQuote } from "@/features/create/contracts";
import { claimGuestImage } from "@/features/create/creatorAssets";
import { deleteGuestDraft, getGuestAsset, getGuestDraft, putGuestAsset, saveGuestDraft } from "@/features/create/guestDraftStore";
import { normalizeCreatorResolution, type CreatorAspectRatio, type CreatorResolution } from "@/features/create/types";
import { automaticQuoteRetryDelay } from "@/features/create/quoteRecovery";

type DirectorOption<T extends string> = { id: T; label: string; icon: LucideIcon };
type ReferenceAsset = {
  id: string;
  name: string;
  url: string;
  assetKey?: string;
  objectKey?: string;
  mimeType?: string;
  role: "Style" | "Lighting" | "Setting" | "Motion";
};

type StudioQuote = Omit<GenerationQuote, "quoteId"> & {
  quoteId: string | null;
  estimateOnly?: boolean;
};

const CAMERA_OPTIONS: Array<DirectorOption<"push-in" | "orbit" | "handheld" | "static">> = [
  { id: "push-in", label: "Push in", icon: Focus },
  { id: "orbit", label: "Orbit", icon: RotateCcw },
  { id: "handheld", label: "Handheld", icon: Waves },
  { id: "static", label: "Static", icon: Camera },
];

const SHOT_OPTIONS: Array<DirectorOption<"macro" | "close" | "medium" | "wide">> = [
  { id: "macro", label: "Macro", icon: Aperture },
  { id: "close", label: "Close", icon: Focus },
  { id: "medium", label: "Medium", icon: Frame },
  { id: "wide", label: "Wide", icon: Expand },
];

const LIGHTING_OPTIONS = ["Studio rim", "Soft daylight", "Golden hour", "Night contrast"] as const;
const FIDELITY_OPTIONS = ["Exact", "Strong", "Flexible"] as const;
const MOTION_OPTIONS = ["Calm", "Natural", "Dynamic"] as const;
const RATIOS: CreatorAspectRatio[] = ["9:16", "1:1", "4:5", "16:9"];
const DIRECTION_PRESETS = [
  { label: "Hero", instruction: "Centered product hero composition with deliberate negative space and a premium commercial finish." },
  { label: "Creator", instruction: "Natural creator-led framing with credible human scale, direct eye line and product-forward blocking." },
  { label: "Lifestyle", instruction: "Contextual lifestyle composition with a believable Kuwait setting and restrained editorial movement." },
  { label: "Macro", instruction: "Tactile macro detail study that preserves exact product materials, label and proportions." },
] as const;
const REFERENCE_ROLES: ReferenceAsset["role"][] = ["Style", "Lighting", "Setting", "Motion"];

function readSetting<T>(draft: CreationDraft | null, key: string, fallback: T): T {
  return (draft?.advanced?.renderSettings?.[key] as T | undefined) ?? fallback;
}

export default function AdvancedStudio() {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const arabicUi = locale === "ar";
  const tr = useCallback(
    (english: string, arabic: string) => arabicUi ? arabic : english,
    [arabicUi],
  );
  const portablePlatform = isFeatureEnabled("portableAuth");
  const developmentFreeGeneration = import.meta.env.DEV && isFeatureEnabled("developmentFreeGeneration");
  const cameraLabel = (id: (typeof CAMERA_OPTIONS)[number]["id"], fallback: string) => arabicUi
    ? ({ "push-in": "اقتراب", orbit: "دوران", handheld: "يدوي", static: "ثابت" } as const)[id]
    : fallback;
  const shotLabel = (id: (typeof SHOT_OPTIONS)[number]["id"], fallback: string) => arabicUi
    ? ({ macro: "ماكرو", close: "قريبة", medium: "متوسطة", wide: "واسعة" } as const)[id]
    : fallback;
  const motionLabel = (value: (typeof MOTION_OPTIONS)[number]) => arabicUi
    ? ({ Calm: "هادئ", Natural: "طبيعي", Dynamic: "حيوي" } as const)[value]
    : value;
  const lightingLabel = (value: (typeof LIGHTING_OPTIONS)[number]) => arabicUi
    ? ({ "Studio rim": "إضاءة استوديو جانبية", "Soft daylight": "ضوء نهار ناعم", "Golden hour": "الساعة الذهبية", "Night contrast": "تباين ليلي" } as const)[value]
    : value;
  const fidelityLabel = (value: (typeof FIDELITY_OPTIONS)[number]) => arabicUi
    ? ({ Exact: "مطابقة تامة", Strong: "مطابقة قوية", Flexible: "مرنة" } as const)[value]
    : value;
  const directionLabel = (index: number) => arabicUi
    ? (["بطولي", "صانع محتوى", "أسلوب حياة", "ماكرو"][index] ?? DIRECTION_PRESETS[index]?.label ?? "")
    : DIRECTION_PRESETS[index]?.label ?? "";
  const referenceRoleLabel = (role: ReferenceAsset["role"]) => arabicUi
    ? ({ Style: "أسلوب", Lighting: "إضاءة", Setting: "مكان", Motion: "حركة" } as const)[role]
    : role;
  const [searchParams] = useSearchParams();
  const requestedDraft = searchParams.get("draft");
  const fromTemplate = searchParams.get("from") === "template";
  const resume = searchParams.get("resume") === "generate";
  const [draftId] = useState(() => requestedDraft || crypto.randomUUID());
  const [versionId] = useState(() => crypto.randomUUID());
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(8);
  const [ratio, setRatio] = useState<CreatorAspectRatio>("9:16");
  const [resolution, setResolution] = useState<CreatorResolution>("720p");
  const [capability, setCapability] = useState<ApprovedCapability>("video.cinematic");
  const [cameraMove, setCameraMove] = useState<(typeof CAMERA_OPTIONS)[number]["id"]>("push-in");
  const [shotType, setShotType] = useState<(typeof SHOT_OPTIONS)[number]["id"]>("macro");
  const [motion, setMotion] = useState<(typeof MOTION_OPTIONS)[number]>("Natural");
  const [lighting, setLighting] = useState<(typeof LIGHTING_OPTIONS)[number]>("Studio rim");
  const [fidelity, setFidelity] = useState<(typeof FIDELITY_OPTIONS)[number]>("Exact");
  const [audio, setAudio] = useState(true);
  const [rights, setRights] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sourceDraft, setSourceDraft] = useState<CreationDraft | null>(null);
  const [references, setReferences] = useState<ReferenceAsset[]>([]);
  const [selectedDirection, setSelectedDirection] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(!requestedDraft);
  const resumed = useRef(false);
  const generateRef = useRef<() => Promise<void>>(async () => undefined);
  const previewRef = useRef<HTMLElement | null>(null);
  const [quote, setQuote] = useState<StudioQuote | null>(null);
  const [quoteLoaded, setQuoteLoaded] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [quoteFailure, setQuoteFailure] = useState<{ retryable: boolean; requestId?: string } | null>(null);
  const [quoteRetry, setQuoteRetry] = useState(0);
  const quoteAutoRetryCount = useRef(0);
  const [priceNotice, setPriceNotice] = useState("");
  const [cloudProjectId, setCloudProjectId] = useState<string | null>(null);

  const productImage = sourceDraft?.product.images[0]?.url ?? null;
  const projectName = sourceDraft?.product.name
    ? `${sourceDraft.product.name} ${tr("Campaign", "حملة")}`
    : tr("Untitled direction", "اتجاه بدون عنوان");
  const templatePath = requestedDraft ? `/create?draft=${encodeURIComponent(draftId)}` : "/create";
  // Direction cards describe prompt presets. Until a real product is attached,
  // they must not masquerade stock campaign artwork as the user's output.
  const directionImages = DIRECTION_PRESETS.map(() => productImage);
  const directionLabels = DIRECTION_PRESETS.map((item) => item.label);
  const selectedDirectionSpec = DIRECTION_PRESETS[selectedDirection] ?? DIRECTION_PRESETS[0];

  const directorPrompt = useCallback(() => [
    prompt.trim(),
    `Visual direction: ${selectedDirectionSpec.label}. ${selectedDirectionSpec.instruction}`,
    `Camera: ${cameraMove}. Shot: ${shotType}. Motion: ${motion.toLowerCase()}. Lighting: ${lighting}.`,
    `Product fidelity: ${fidelity}. ${fidelity === "Exact" ? "Keep the supplied product shape, label, colours and proportions unchanged." : "Respect the supplied product identity."}`,
  ].filter(Boolean).join("\n\n"), [cameraMove, fidelity, lighting, motion, prompt, selectedDirectionSpec, shotType]);

  const studioConfigurationInput = useCallback((
    resolvedPrompt: string,
    resolvedReferences: ReferenceAsset[] = references,
    resolvedSource: CreationDraft | null = sourceDraft,
  ): AdvancedStudioConfigurationInput => {
    const productReferences: AdvancedReferenceConfiguration[] = (resolvedSource?.product.images ?? []).flatMap((image) =>
      image.storagePath
        ? [{
            id: image.id,
            name: image.name,
            role: "Style" as const,
            objectKey: image.storagePath,
            mimeType: /\.webp$/i.test(image.name) ? "image/webp" : /\.png$/i.test(image.name) ? "image/png" : "image/jpeg",
          }]
        : [],
    );
    return {
      prompt: resolvedPrompt,
      capability,
      duration,
      ratio,
      resolution,
      audio,
      cameraMove,
      shotType,
      motion,
      lighting,
      fidelity,
      selectedDirection,
      selectedDirectionLabel: selectedDirectionSpec.label,
      ...(resolvedSource?.templateVersionId
        ? { sourceTemplateVersionId: resolvedSource.templateVersionId }
        : {}),
      references: [
        ...productReferences,
        ...resolvedReferences.map((reference) => ({
          id: reference.id,
          name: reference.name,
          role: reference.role,
          ...(reference.objectKey ? { objectKey: reference.objectKey } : {}),
          ...(reference.mimeType ? { mimeType: reference.mimeType } : {}),
        })),
      ],
    };
  }, [audio, cameraMove, capability, duration, fidelity, lighting, motion, ratio, references, resolution, selectedDirection, selectedDirectionSpec.label, shotType, sourceDraft]);

  useEffect(() => {
    let active = true;
    let automaticRetryTimer: number | null = null;
    setQuoteLoaded(false);
    setQuoteError("");
    setQuoteFailure(null);
    const timer = window.setTimeout(() => {
      const quotePromise = portablePlatform
        ? portableCreatorApi.generationQuote({
            capability,
            configuration: buildAdvancedGenerationConfiguration(
              studioConfigurationInput("Advanced video direction price estimate."),
            ),
          })
        : supabase.functions.invoke("generation-quote", { body: { capability, duration_seconds: duration } })
            .then(({ data, error }) => {
              if (error || !data?.quoteId) throw error ?? new Error("generation_quote_unavailable");
              return data as StudioQuote;
            });
      void quotePromise.then((nextQuote) => {
        if (!active) return;
        quoteAutoRetryCount.current = 0;
        setQuote(nextQuote);
      }).catch((error: unknown) => {
        if (!active) return;
        setQuote(null);
        const portableError = error instanceof PortableApiError ? error : null;
        const retryable = portableError?.retryable ?? true;
        const retryDelay = automaticQuoteRetryDelay(quoteAutoRetryCount.current, retryable);
        const shouldRetryAutomatically = retryDelay !== null;
        const message = portableError?.code === "worker_unavailable"
          ? tr("Generation is temporarily paused. Your direction is saved.", "التوليد متوقف مؤقتاً. اتجاهك محفوظ.")
          : portableError?.code === "pricing_unavailable"
            ? developmentFreeGeneration
              ? tr("The local generation service is not ready. Try again.", "خدمة التوليد المحلية غير جاهزة. حاول مرة ثانية.")
              : tr("We couldn’t confirm the current price. Try again.", "ما قدرنا نؤكد السعر الحالي. حاول مرة ثانية.")
            : tr("Video generation is temporarily unavailable.", "توليد الفيديو غير متوفر مؤقتاً.");
        setQuoteError(shouldRetryAutomatically
          ? `${message} ${tr("Retrying automatically…", "جارٍ إعادة المحاولة تلقائياً…")}`
          : message);
        setQuoteFailure({
          retryable,
          ...(portableError?.requestId ? { requestId: portableError.requestId } : {}),
        });
        if (retryDelay !== null) {
          quoteAutoRetryCount.current += 1;
          automaticRetryTimer = window.setTimeout(() => {
            if (active) setQuoteRetry((value) => value + 1);
          }, retryDelay);
        }
      }).finally(() => {
        if (active) setQuoteLoaded(true);
      });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
      if (automaticRetryTimer !== null) window.clearTimeout(automaticRetryTimer);
    };
  }, [capability, developmentFreeGeneration, duration, portablePlatform, quoteRetry, studioConfigurationInput, tr, user?.id]);

  const retryQuote = useCallback(() => {
    quoteAutoRetryCount.current = 0;
    setQuoteRetry((value) => value + 1);
  }, []);

  useEffect(() => setPriceNotice(""), [audio, capability, duration, ratio, resolution]);

  useEffect(() => {
    if (!requestedDraft) return;
    void getGuestDraft(requestedDraft).then(async (draft) => {
      if (!draft) {
        setHydrated(true);
        return;
      }
      setSourceDraft(draft);
      setPrompt(draft.advanced?.prompt || "");
      setCapability(draft.advanced?.capability || "video.cinematic");
      setDuration(Number(readSetting(draft, "duration", 8)));
      setRatio(readSetting(draft, "ratio", draft.campaign.aspectRatio));
      setResolution(normalizeCreatorResolution(readSetting(draft, "resolution", draft.campaign.resolution)));
      setCameraMove(readSetting(draft, "camera", "push-in"));
      setShotType(readSetting(draft, "shot", "macro"));
      setMotion(readSetting(draft, "motion", "Natural"));
      setLighting(readSetting(draft, "lighting", "Studio rim"));
      setFidelity(readSetting(draft, "fidelity", "Exact"));
      setSelectedDirection(Math.min(3, Math.max(0, Number(readSetting(draft, "direction", 0)))));
      setAudio(readSetting(draft, "audio", draft.campaign.audio));
      setRights(Boolean(draft.rightsAttestation?.confirmed));
      setPendingId(draft.pendingGenerationId || null);
      setCloudProjectId(readSetting<string | null>(draft, "cloudProjectId", null));
      const referenceMetadata = readSetting<Array<{
        key: string;
        id?: string;
        name?: string;
        role?: ReferenceAsset["role"];
        objectKey?: string;
        mimeType?: string;
      }>>(draft, "referenceMetadata", []);
      const hydratedReferences = await Promise.all((draft.advanced?.references || []).slice(0, 4).map(async (reference, index) => {
        const stored = await getGuestAsset(reference);
        const metadata = referenceMetadata.find((item) => item.key === reference);
        const role = metadata?.role && REFERENCE_ROLES.includes(metadata.role)
          ? metadata.role
          : (index === 0 ? "Style" : index === 1 ? "Lighting" : "Setting") as ReferenceAsset["role"];
        return stored
          ? {
              id: metadata?.id || reference,
              name: metadata?.name || stored.name,
              url: URL.createObjectURL(stored.blob),
              assetKey: reference,
              mimeType: metadata?.mimeType || stored.mimeType,
              role,
            }
          : {
              id: metadata?.id || reference,
              name: metadata?.name || `Reference ${index + 1}`,
              url: reference,
              ...(metadata?.objectKey ? { objectKey: metadata.objectKey } : {}),
              ...(metadata?.mimeType ? { mimeType: metadata.mimeType } : {}),
              role,
            };
      }));
      setReferences(hydratedReferences.filter((reference) => /^blob:|^https?:|^\//.test(reference.url)));
      setHydrated(true);
    }).catch(() => setHydrated(true));
  }, [requestedDraft]);

  const makeDraft = useCallback((status: CreationDraft["status"]): CreationDraft => {
    const now = new Date();
    const product = sourceDraft?.product ?? { sourceType: null, sourceUrl: "", name: "Advanced video", description: "", price: "", brand: "", images: [] };
    const campaign = advancedCampaignRecipe(sourceDraft, ratio, resolution, audio);
    return {
      id: draftId,
      mode: "advanced",
      status,
      templateVersionId: sourceDraft?.templateVersionId,
      product,
      assetKeys: [...(sourceDraft?.assetKeys ?? []), ...references.flatMap((reference) => reference.assetKey ? [reference.assetKey] : [])],
      campaign,
      advanced: {
        capability,
        prompt,
        references: references.map((reference) => reference.assetKey || reference.objectKey || reference.url),
        renderSettings: {
          duration,
          ratio,
          resolution,
          camera: cameraMove,
          shot: shotType,
          motion,
          lighting,
          fidelity,
          audio,
          direction: selectedDirection,
          ...(cloudProjectId ? { cloudProjectId } : {}),
          referenceMetadata: references.map((reference) => ({
            key: reference.assetKey || reference.objectKey || reference.url,
            id: reference.id,
            name: reference.name,
            role: reference.role,
            ...(reference.objectKey ? { objectKey: reference.objectKey } : {}),
            ...(reference.mimeType ? { mimeType: reference.mimeType } : {}),
          })),
        },
      },
      rightsAttestation: { confirmed: rights, confirmedAt: rights ? now.toISOString() : undefined, version: "2026-08-11" },
      pendingGenerationId: pendingId || undefined,
      returnPath: `/advanced?draft=${draftId}`,
      createdAt: sourceDraft?.createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + GUEST_DRAFT_TTL_MS).toISOString(),
    };
  }, [audio, cameraMove, capability, cloudProjectId, draftId, duration, fidelity, lighting, motion, pendingId, prompt, ratio, references, resolution, rights, selectedDirection, shotType, sourceDraft]);

  useEffect(() => {
    if (!hydrated || (!prompt.trim() && !sourceDraft?.product.images.length && !references.length)) return;
    const timer = window.setTimeout(() => { void saveGuestDraft(makeDraft("editing")); }, 400);
    return () => window.clearTimeout(timer);
  }, [hydrated, makeDraft, prompt, references.length, sourceDraft?.product.images.length]);

  const cycleReferenceRole = (id: string) => {
    setReferences((current) => current.map((reference) => {
      if (reference.id !== id) return reference;
      const index = REFERENCE_ROLES.indexOf(reference.role);
      return { ...reference, role: REFERENCE_ROLES[(index + 1) % REFERENCE_ROLES.length]! };
    }));
  };

  const improveDirection = () => {
    const product = sourceDraft?.product.name || "the product";
    const improved = `A premium ${shotType} product shot of ${product}. ${cameraMove === "push-in" ? "Slow cinematic push-in" : `${cameraMove} camera movement`}, ${motion.toLowerCase()} pacing, ${lighting.toLowerCase()} lighting. Keep the product label, shape and colours exact.`;
    setPrompt(improved);
    toast.success(tr("Direction prepared. You can edit every word before generating.", "تم تجهيز الاتجاه. تقدر تعدّل كل كلمة قبل التوليد."));
  };

  const addReferences = async (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files).slice(0, Math.max(0, 4 - references.length));
    try {
      const next = await Promise.all(selected.map(async (file, index) => {
        if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) throw new Error(tr("Use JPG, PNG or WebP images up to 12 MB.", "استخدم صور JPG أو PNG أو WebP بحجم أقصى 12 ميجابايت."));
        const assetKey = await putGuestAsset(draftId, file);
        return { id: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file), assetKey, mimeType: file.type, role: (index === 0 ? "Style" : "Lighting") as ReferenceAsset["role"] };
      }));
      setReferences((current) => [...current, ...next].slice(0, 4));
      toast.success(arabicUi ? `تمت إضافة ${next.length} من المراجع البصرية.` : `${next.length} visual reference${next.length === 1 ? "" : "s"} added.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("The references could not be added.", "تعذرت إضافة المراجع."));
    }
  };

  const claimPortableAssets = async (
    projectId: string,
    currentSource: CreationDraft | null,
    currentReferences: ReferenceAsset[],
  ) => {
    let uploaded = false;
    const productImages = await Promise.all((currentSource?.product.images ?? []).map(async (image) => {
      if (!image.assetKey || image.storagePath) return image;
      const stored = await getGuestAsset(image.assetKey);
      if (!stored) {
        throw new Error(tr(
          `The local copy of ${image.name} is no longer available. Add it again to continue.`,
          `النسخة المحلية من ${image.name} لم تعد متاحة. أضفها مرة ثانية للمتابعة.`,
        ));
      }
      const claimed = await claimGuestImage({
        userId: user!.id,
        projectId,
        assetId: image.id,
        name: stored.name,
        blob: stored.blob,
        contentType: stored.mimeType,
        kind: "product",
      });
      uploaded = true;
      return {
        ...image,
        id: claimed.assetId,
        storagePath: claimed.storagePath,
        checksum: claimed.checksum,
        url: claimed.url,
        assetKey: undefined,
      };
    }));
    const securedSource = currentSource
      ? { ...currentSource, product: { ...currentSource.product, images: productImages } }
      : currentSource;
    const securedReferences = await Promise.all(currentReferences.map(async (reference) => {
      if (!reference.assetKey || reference.objectKey) return reference;
      const stored = await getGuestAsset(reference.assetKey);
      if (!stored) {
        throw new Error(tr(
          `The local copy of ${reference.name} is no longer available. Add it again to continue.`,
          `النسخة المحلية من ${reference.name} لم تعد متاحة. أضفها مرة ثانية للمتابعة.`,
        ));
      }
      const claimed = await claimGuestImage({
        userId: user!.id,
        projectId,
        assetId: reference.id,
        name: stored.name,
        blob: stored.blob,
        contentType: stored.mimeType,
        kind: "reference",
      });
      uploaded = true;
      return {
        ...reference,
        id: claimed.assetId,
        objectKey: claimed.storagePath,
        mimeType: stored.mimeType,
        url: claimed.url,
        assetKey: undefined,
      };
    }));
    return { source: securedSource, references: securedReferences, uploaded };
  };

  const generate = async () => {
    if (!prompt.trim()) {
      toast.error(tr("Describe the shot or choose Improve direction first.", "اكتب وصف اللقطة أو اختر تحسين الاتجاه أولاً."));
      return;
    }
    if (!rights) {
      toast.error(tr("Confirm that you have permission to use these assets.", "أكد أن عندك صلاحية استخدام هذه المواد."));
      return;
    }
    if (!quoteLoaded || !quote) {
      toast.error(quoteError || (developmentFreeGeneration
        ? tr("The local generation service is still loading. Try again in a moment.", "جارٍ تحميل خدمة التوليد المحلية. حاول بعد لحظات.")
        : tr("Live pricing is still loading. Try again in a moment.", "جارٍ تحميل السعر المباشر. حاول بعد لحظات.")));
      return;
    }
    const operationId = pendingId || crypto.randomUUID();
    setPendingId(operationId);
    if (!user) {
      await saveGuestDraft({ ...makeDraft("auth_required"), pendingGenerationId: operationId });
      setAuthOpen(true);
      return;
    }
    setSubmitting(true);
    try {
      const title = sourceDraft?.product.name || prompt.slice(0, 64) || "Advanced video";
      if (portablePlatform) {
        const saveVersion = async (
          currentDraftId: string,
          currentSource: CreationDraft | null,
          currentReferences: ReferenceAsset[],
          operationSuffix: string,
        ) => persistPortableAdvancedProject({
          draftId: currentDraftId,
          title,
          ...(currentSource?.templateVersionId
            ? { sourceTemplateVersionId: currentSource.templateVersionId }
            : {}),
          configuration: buildAdvancedProjectConfiguration(
            studioConfigurationInput(directorPrompt(), currentReferences, currentSource),
          ),
          productRecipe: currentSource?.product ?? {},
          campaignRecipe: advancedCampaignRecipe(currentSource, ratio, resolution, audio),
          operationId: `${operationId}:${operationSuffix}`,
        });

        const hasLocalAssets = Boolean(
          sourceDraft?.product.images.some((image) => image.assetKey && !image.storagePath)
          || references.some((reference) => reference.assetKey && !reference.objectKey),
        );
        let saved = await saveVersion(cloudProjectId || draftId, sourceDraft, references, hasLocalAssets ? "claim" : "final");
        setCloudProjectId(saved.project.id);
        const secured = await claimPortableAssets(saved.project.id, sourceDraft, references);
        if (secured.uploaded) {
          saved = await saveVersion(saved.project.id, secured.source, secured.references, "final");
          setSourceDraft(secured.source);
          setReferences(secured.references);
        }
        if (
          capability === "video.product_fidelity"
          && secured.source?.product.images.length
          && !secured.source.product.images.some((image) => image.storagePath)
        ) {
          throw new Error(tr(
            "Product-fidelity generation needs a securely uploaded product image. Download the selected image and upload it to continue.",
            "توليد مطابقة المنتج يحتاج صورة منتج مرفوعة بشكل آمن. نزّل الصورة المختارة وارفعها للمتابعة.",
          ));
        }
        const authoritativeQuote = await portableCreatorApi.generationQuote({
          capability,
          projectVersionId: saved.version.id,
        });
        if (!authoritativeQuote.quoteId) {
          throw new Error(developmentFreeGeneration
            ? tr("The local generation session could not be saved.", "تعذر حفظ جلسة التوليد المحلية.")
            : tr("The confirmed generation price could not be saved.", "تعذر حفظ سعر التوليد المؤكد."));
        }
        if (authoritativeQuote.credits !== quote.credits) {
          setQuote({
            quoteId: authoritativeQuote.quoteId,
            capability: authoritativeQuote.capability,
            credits: authoritativeQuote.credits,
            entitlementEligible: authoritativeQuote.entitlementEligible,
            expiresAt: authoritativeQuote.expiresAt,
            breakdown: authoritativeQuote.breakdown,
            estimateOnly: authoritativeQuote.estimateOnly,
          });
          setPriceNotice(developmentFreeGeneration
            ? tr("The generation settings changed. Select Generate direction again.", "تغيّرت إعدادات التوليد. اختر توليد الاتجاه مرة ثانية.")
            : tr(
              `The price changed from ${quote.credits} to ${authoritativeQuote.credits} credits. Review it, then select Generate direction again.`,
              `تغيّر السعر من ${quote.credits} إلى ${authoritativeQuote.credits} رصيد. راجعه، ثم اختر توليد الاتجاه مرة ثانية.`,
            ));
          setSubmitting(false);
          return;
        }
        const run = await portableCreatorApi.startRender({
          projectId: saved.project.id,
          projectVersionId: saved.version.id,
          quoteId: authoritativeQuote.quoteId,
          rightsAttested: true,
        }, operationId);
        try {
          await deleteGuestDraft(draftId);
        } catch {
          toast.warning(tr(
            "Your render started, but the browser copy of this draft could not be cleared.",
            "بدأ التوليد، لكن تعذر حذف نسخة المسودة من المتصفح.",
          ));
        }
        toast.success(tr("Direction queued. You can follow it in your project.", "تم وضع الاتجاه في قائمة التوليد. تقدر تتابعه في مشروعك."));
        window.location.assign(`/projects/${encodeURIComponent(saved.project.id)}?run=${encodeURIComponent(run.id)}`);
        return;
      }

      const now = new Date().toISOString();
      const { error: projectError } = await supabase.from("creator_projects").upsert({ id: draftId, user_id: user.id, title, mode: "advanced", status: "ready", updated_at: now });
      if (projectError) throw projectError;
      const configuration = { id: draftId, versionId, mode: "advanced", prompt: directorPrompt(), capability, duration, ratio, providerRatio: providerCanvasRatio(ratio), resolution, audio, references: references.map((reference) => reference.assetKey || reference.objectKey || reference.url), cameraMove, shotType, motion, lighting, fidelity, selectedDirection, sourceTemplateVersionId: sourceDraft?.templateVersionId, rightsAttestation: { confirmed: true, confirmedAt: now } };
      const { error: versionError } = await supabase.from("creator_project_versions").upsert({ id: versionId, project_id: draftId, user_id: user.id, mode: "advanced", version_number: 1, configuration: configuration as unknown as Json, product_recipe: (sourceDraft?.product ?? {}) as unknown as Json, campaign_recipe: ({ ...(sourceDraft?.campaign ?? {}), aspectRatio: ratio, audio, resolution }) as unknown as Json });
      if (versionError) throw versionError;
      await supabase.from("creator_projects").update({ current_accepted_version_id: versionId }).eq("id", draftId).eq("user_id", user.id);
      const referenceImages = [...(sourceDraft?.product.images.map((image) => image.url) ?? []), ...references.map((reference) => reference.url)];
      if (!quote.quoteId) throw new Error(developmentFreeGeneration ? "The local generation service is unavailable." : "The confirmed generation price is unavailable.");
      const generation = await startCreatorGeneration({ projectId: draftId, projectVersionId: versionId, quoteId: quote.quoteId, idempotencyKey: operationId, mode: "advanced", prompt: directorPrompt(), capability: capability as "video.cinematic" | "video.product_fidelity", options: { duration, aspect_ratio: providerCanvasRatio(ratio), resolution, audio }, referenceImages, rightsAttested: true, metadata: { advanced_flow: true, requested_aspect_ratio: ratio, provider_aspect_ratio: providerCanvasRatio(ratio), resolution, camera_move: cameraMove, shot_type: shotType, motion, lighting, product_fidelity: fidelity, visual_direction: selectedDirectionSpec.label, source_template_version_id: sourceDraft?.templateVersionId } });
      toast.success(tr("Direction queued. You can follow it in Projects.", "تم وضع الاتجاه في قائمة التوليد. تقدر تتابعه في المشاريع."));
      window.location.assign(`/projects?run=${encodeURIComponent(generation.runId)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("The render could not be started.", "تعذر بدء التوليد."));
      setSubmitting(false);
    }
  };
  generateRef.current = generate;

  useEffect(() => {
    if (!user || !resume || !pendingId || !prompt || !rights || resumed.current) return;
    resumed.current = true;
    void generateRef.current();
  }, [pendingId, prompt, resume, rights, user]);

  if (!hydrated) {
    return <CreatorShell><div className="advanced-loading" role="status"><Loader2 className="animate-spin" aria-hidden="true" /><span>{tr("Restoring your studio…", "جارٍ استعادة الاستوديو…")}</span></div></CreatorShell>;
  }

  return (
    <CreatorShell studio={{ title: projectName, templatePath }}>
      <Seo title={`${projectName} · ${tr("Advanced Studio", "الاستوديو المتقدم")} · MovPrompt`} description={tr("Direct an AI video with visual references, camera controls and product-safe generation.", "وجّه فيديو بالذكاء الاصطناعي باستخدام مراجع بصرية وتحكم بالكاميرا مع حماية شكل المنتج.")} path="/advanced" noindex />
      <h1 className="sr-only">{tr("Advanced Studio", "الاستوديو المتقدم")}</h1>
      <div className="advanced-studio">
        {fromTemplate && sourceDraft && (
          <div className="advanced-handoff" role="status">
            <CheckCircle2 aria-hidden="true" />
            <span><strong>{tr("Template moved into Advanced", "تم نقل القالب إلى الوضع المتقدم")}</strong><small>{tr("Product, campaign and brand settings are preserved.", "تم الحفاظ على إعدادات المنتج والحملة والعلامة.")}</small></span>
            <Link to={templatePath}><ArrowLeft aria-hidden="true" /> {tr("Return to Template", "العودة إلى القالب")}</Link>
          </div>
        )}

        <aside className="advanced-assets" aria-label={tr("Project assets", "مواد المشروع")}>
          <div className="advanced-column-head"><h2>{tr("Assets", "المواد")}</h2></div>
          <section className="advanced-asset-section" aria-labelledby="advanced-product-title">
            <div className="advanced-section-label"><h2 id="advanced-product-title">{tr("Product", "المنتج")}</h2><ChevronRight aria-hidden="true" /></div>
            {productImage ? (
              <div className="advanced-product-asset">
                <span className="advanced-asset-check"><Check aria-hidden="true" /></span>
                <img src={productImage} alt={sourceDraft?.product.name || tr("Product reference", "مرجع المنتج")} />
                <span><strong>{sourceDraft?.product.name || tr("Imported product", "المنتج المستورد")}</strong><small>{sourceDraft?.product.brand || tr("Primary product", "المنتج الرئيسي")}</small><small>{sourceDraft?.product.images[0]?.name || tr("Product reference", "مرجع المنتج")}</small></span>
              </div>
            ) : (
              <div className="advanced-product-empty" role="status">
                <ImagePlus aria-hidden="true" />
                <span><strong>{tr("No product attached", "ما تمت إضافة منتج")}</strong><small>{tr("Add the real product before generating.", "أضف المنتج الحقيقي قبل التوليد.")}</small></span>
                <Link to="/create">{tr("Add in Template Mode", "أضف في وضع القوالب")}</Link>
              </div>
            )}
          </section>

          <section className="advanced-asset-section" aria-labelledby="advanced-references-title">
            <div className="advanced-section-label"><span><h2 id="advanced-references-title">{tr("Visual references", "المراجع البصرية")}</h2><small>{tr("Guide style, lighting or setting.", "وجّه الأسلوب أو الإضاءة أو المكان.")}</small></span><i>{references.length}</i></div>
            <div className="advanced-reference-grid">
              {references.map((reference) => (
                <button key={reference.id} type="button" className="advanced-reference" title={`${referenceRoleLabel(reference.role)}: ${reference.name}`} onClick={() => cycleReferenceRole(reference.id)} aria-label={tr(`${reference.name}. Role: ${reference.role}. Activate to change role.`, `${reference.name}. الدور: ${referenceRoleLabel(reference.role)}. اضغط لتغيير الدور.`)}>
                  <img src={reference.url} alt={tr(`${reference.role} reference: ${reference.name}`, `مرجع ${referenceRoleLabel(reference.role)}: ${reference.name}`)} />
                  <span>{referenceRoleLabel(reference.role)}</span>
                </button>
              ))}
              {!references.length && (["Style", "Lighting", "Setting"] as const).map((role) => (
                <div key={role} className="advanced-reference is-suggestion" aria-hidden="true">
                  <ImagePlus />
                  <span>{tr(`${referenceRoleLabel(role)} slot`, `خانة ${referenceRoleLabel(role)}`)}</span>
                </div>
              ))}
            </div>
            <label className="advanced-add-media"><Upload aria-hidden="true" /><span>{tr("Add media", "إضافة مادة")}</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label={tr("Add visual references", "إضافة مراجع بصرية")} onChange={(event) => void addReferences(event.target.files)} /></label>
          </section>

          <div className="advanced-rail-row" role="status"><span>{productImage ? <ShieldCheck aria-hidden="true" /> : <ImagePlus aria-hidden="true" />} {productImage ? (sourceDraft?.product.brand ? `${tr("Brand", "العلامة")}: ${sourceDraft.product.brand}` : tr("Product reference attached", "تم إرفاق مرجع المنتج")) : tr("Add a product image to protect its identity", "أضف صورة المنتج لحماية هويته")}</span></div>
          {sourceDraft?.campaign.cta && <div className="advanced-rail-row" role="status"><span><Sparkles aria-hidden="true" /> {tr("CTA", "الدعوة للإجراء")}: {sourceDraft.campaign.cta}</span></div>}
        </aside>

        <section className="advanced-main" aria-label={tr("Creative direction workspace", "مساحة توجيه الإبداع")}>
          <section ref={previewRef} className="advanced-preview" aria-label={tr("Direction preview", "معاينة الاتجاه")}>
            <div className="advanced-preview-badge">{ratio}</div>
            <button className="advanced-preview-expand" type="button" aria-label={tr("Open full-screen preview", "فتح المعاينة بكامل الشاشة")} onClick={() => void previewRef.current?.requestFullscreen?.()}><Maximize2 aria-hidden="true" /></button>
            <div className="advanced-preview-media" data-ratio={ratio}>
              {productImage ? (
                <img src={productImage} alt={tr(`${sourceDraft?.product.name || "Product"} reference with ${directionLabels[selectedDirection]} selected`, `مرجع ${sourceDraft?.product.name || "المنتج"} مع اختيار اتجاه ${directionLabel(selectedDirection)}`)} />
              ) : (
                <div className="advanced-preview-empty" role="status"><ImagePlus aria-hidden="true" /><strong>{tr("Your direction preview starts here", "تبدأ معاينة اتجاهك هنا")}</strong><span>{tr("Add a product or reference, or write a prompt. No sample output is shown.", "أضف منتجاً أو مرجعاً، أو اكتب توجيهاً. لا نعرض نتيجة تجريبية.")}</span></div>
              )}
            </div>
            <div className="advanced-player" role="group" aria-label={tr("Direction preview details", "تفاصيل معاينة الاتجاه")}><span>{directionLabel(selectedDirection)} · {productImage ? tr("product reference", "مرجع المنتج") : tr("direction setup", "إعداد الاتجاه")}</span><span>{productImage ? tr("Not generated yet", "لم يتم التوليد بعد") : tr("Awaiting your media", "بانتظار موادك")}</span></div>
          </section>

          <section className="advanced-composer" aria-labelledby="advanced-prompt-label">
            <label id="advanced-prompt-label" htmlFor="advanced-prompt">{tr("Direct this shot", "وجّه هذه اللقطة")}</label>
            <textarea id="advanced-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={8000} placeholder={tr("Describe the subject, action, camera and light. Or use Improve direction.", "صف العنصر والحركة والكاميرا والإضاءة، أو استخدم تحسين الاتجاه.")} aria-describedby="advanced-prompt-help" />
            <div className="advanced-composer-actions">
              <div className="advanced-prompt-tools">
                <button type="button" disabled={!productImage} title={!productImage ? tr("Add a product before mentioning it in the direction.", "أضف منتجاً قبل الإشارة إليه في التوجيه.") : undefined} onClick={() => setPrompt((current) => `${current}${current ? " " : ""}@Product`)}>@{tr("Product", "المنتج")}</button>
                <button type="button" disabled={!references.length} onClick={() => setPrompt((current) => `${current}${current ? " " : ""}@Reference1`)}>@{tr("Reference 1", "المرجع 1")}</button>
                <button type="button" onClick={improveDirection}><WandSparkles aria-hidden="true" /> {tr("Improve direction", "تحسين الاتجاه")}</button>
              </div>
              <button className="advanced-settings-trigger" type="button" onClick={() => setSettingsOpen((open) => !open)} aria-expanded={settingsOpen} aria-controls="advanced-quick-settings" aria-label={tr("Quick render settings", "إعدادات التوليد السريعة")}><Settings2 aria-hidden="true" /></button>
              <button
                className="advanced-generate"
                type="button"
                onClick={() => void generate()}
                disabled={submitting || !quoteLoaded || !quote || !prompt.trim() || !rights}
                title={!prompt.trim()
                  ? tr("Describe the shot before generating.", "صف اللقطة قبل التوليد.")
                  : !rights
                    ? tr("Confirm asset permission before generating.", "أكد صلاحية استخدام المواد قبل التوليد.")
                    : undefined}
              >
                {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />} {tr("Generate direction", "توليد الاتجاه")}
              </button>
            </div>
            <div className="advanced-composer-meta">
              <label><input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} /><span>{tr("I have permission to use these assets", "عندي صلاحية استخدام هذه المواد")}</span></label>
              <span id="advanced-prompt-help" className="advanced-price-status" role="status" aria-live="polite">{priceNotice || (quote ? developmentFreeGeneration ? tr("Ready for local generation · usually 2–5 minutes", "جاهز للتوليد المحلي · عادةً من دقيقتين إلى 5 دقائق") : (arabicUi ? `${quote.credits} رصيد · عادةً من دقيقتين إلى 5 دقائق` : `${quote.credits} credits · usually 2–5 minutes`) : quoteLoaded ? quoteError || tr("Video generation is temporarily unavailable.", "توليد الفيديو غير متوفر مؤقتاً.") : developmentFreeGeneration ? tr("Checking generation service…", "جارٍ التحقق من خدمة التوليد…") : tr("Checking live price…", "جارٍ التحقق من السعر…"))}{quoteLoaded && !quote && quoteFailure?.retryable && <button type="button" onClick={retryQuote}>{developmentFreeGeneration ? tr("Retry", "أعد المحاولة") : tr("Retry price", "أعد محاولة السعر")}</button>}{quoteFailure?.requestId && <details><summary>{tr("Support details", "تفاصيل الدعم")}</summary><code>{quoteFailure.requestId}</code></details>}</span>
            </div>
            {settingsOpen && (
              <div id="advanced-quick-settings" className="advanced-quick-settings">
                <label>{tr("Duration", "المدة")}<select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>{[5, 8, 10, 15].map((seconds) => <option key={seconds} value={seconds}>{seconds} {tr("seconds", "ثوانٍ")}</option>)}</select></label>
                <label>{tr("Format", "المقاس")}<select value={ratio} onChange={(event) => setRatio(event.target.value as CreatorAspectRatio)}>{RATIOS.map((item) => <option key={item}>{item}</option>)}</select>{ratio === "4:5" && <small>{tr("Generated on a 3:4 canvas, then safely cropped to 4:5.", "يتم التوليد على مساحة 3:4 ثم القص الآمن إلى 4:5.")}</small>}</label>
                <label>{tr("Quality", "الجودة")}<select value={resolution} onChange={(event) => setResolution(normalizeCreatorResolution(event.target.value))}><option value="720p">720p · {tr("Recommended", "موصى بها")}</option><option value="480p">480p · {tr("Faster preview", "معاينة أسرع")}</option></select></label>
              </div>
            )}
          </section>

          <section className="advanced-directions" aria-labelledby="advanced-directions-title">
            <div className="advanced-directions-head"><h2 id="advanced-directions-title">{tr("Starting directions", "اتجاهات البداية")}</h2><span>{tr("Applied to your prompt", "تُطبق على توجيهك")}</span></div>
            <div className="advanced-directions-grid">
              {directionImages.map((image, index) => (
                <button key={directionLabels[index]} type="button" className={cn("advanced-direction-card", selectedDirection === index && "is-selected")} onClick={() => setSelectedDirection(index)} aria-pressed={selectedDirection === index}>
                  {image ? <img src={image} alt="" /> : <span className="advanced-direction-placeholder"><ImagePlus aria-hidden="true" />{tr("No sample output", "لا توجد نتيجة تجريبية")}</span>}
                  <span>{String(index + 1).padStart(2, "0")} {directionLabel(index)}</span>
                  {selectedDirection === index && <i><Check aria-hidden="true" /></i>}
                </button>
              ))}
            </div>
          </section>
        </section>

        <aside className="advanced-director" aria-label={tr("Director controls", "أدوات المخرج")}>
          <div className="advanced-column-head"><span><h2>{tr("Director", "المخرج")}</h2><small>{tr("Shape the shot visually.", "شكّل اللقطة بصرياً.")}</small></span><button type="button" onClick={() => { setCameraMove("push-in"); setShotType("macro"); setMotion("Natural"); setLighting("Studio rim"); setFidelity("Exact"); }}><RotateCcw aria-hidden="true" /> {tr("Reset", "إعادة")}</button></div>
          <fieldset className="advanced-control-group"><legend>{tr("Camera", "الكاميرا")}</legend><div className="advanced-visual-options">{CAMERA_OPTIONS.map((option) => { const Icon = option.icon; return <button key={option.id} type="button" className={cn(cameraMove === option.id && "is-selected")} onClick={() => setCameraMove(option.id)} aria-pressed={cameraMove === option.id}><Icon aria-hidden="true" /><span>{cameraLabel(option.id, option.label)}</span></button>; })}</div></fieldset>
          <fieldset className="advanced-control-group"><legend>{tr("Shot", "اللقطة")}</legend><div className="advanced-visual-options">{SHOT_OPTIONS.map((option) => { const Icon = option.icon; return <button key={option.id} type="button" className={cn(shotType === option.id && "is-selected")} onClick={() => setShotType(option.id)} aria-pressed={shotType === option.id}><Icon aria-hidden="true" /><span>{shotLabel(option.id, option.label)}</span></button>; })}</div></fieldset>
          <fieldset className="advanced-control-group"><legend>{tr("Motion", "الحركة")}</legend><div className="advanced-segmented">{MOTION_OPTIONS.map((option) => <button key={option} type="button" className={cn(motion === option && "is-selected")} onClick={() => setMotion(option)} aria-pressed={motion === option}>{motionLabel(option)}</button>)}</div><input className="advanced-motion-range" type="range" min="0" max="2" step="1" value={MOTION_OPTIONS.indexOf(motion)} onChange={(event) => setMotion(MOTION_OPTIONS[Number(event.target.value)])} aria-label={tr("Motion intensity", "قوة الحركة")} /></fieldset>
          <details className="advanced-control-disclosure"><summary><span><SunMedium aria-hidden="true" /> {tr("Lighting", "الإضاءة")}</span><span>{lightingLabel(lighting)}<ChevronRight aria-hidden="true" /></span></summary><div className="advanced-detail-options">{LIGHTING_OPTIONS.map((option) => <button key={option} type="button" className={cn(lighting === option && "is-selected")} onClick={() => setLighting(option)}>{lightingLabel(option)}</button>)}</div></details>
          <details className="advanced-control-disclosure"><summary><span><ShieldCheck aria-hidden="true" /> {tr("Product fidelity", "مطابقة المنتج")}</span><span>{fidelityLabel(fidelity)}<ChevronRight aria-hidden="true" /></span></summary><div className="advanced-detail-options">{FIDELITY_OPTIONS.map((option) => <button key={option} type="button" className={cn(fidelity === option && "is-selected")} onClick={() => setFidelity(option)}>{fidelityLabel(option)}</button>)}</div></details>
          <details className="advanced-control-disclosure"><summary><span><Mic2 aria-hidden="true" /> {tr("Audio", "الصوت")}</span><span>{audio ? tr("On", "مفعّل") : tr("Off", "متوقف")}<ChevronRight aria-hidden="true" /></span></summary><div className="advanced-detail-options"><button type="button" className={cn(audio && "is-selected")} onClick={() => setAudio(true)}>{tr("Audio on", "تشغيل الصوت")}</button><button type="button" className={cn(!audio && "is-selected")} onClick={() => setAudio(false)}>{tr("Silent", "صامت")}</button></div></details>
          <details className="advanced-control-disclosure advanced-expert-settings"><summary><span><Settings2 aria-hidden="true" /> {tr("Expert settings", "إعدادات الخبراء")}</span><ChevronRight aria-hidden="true" /></summary><label>{tr("Creative capability", "القدرة الإبداعية")}<select value={capability} onChange={(event) => setCapability(event.target.value as ApprovedCapability)}><option value="video.cinematic">{tr("Cinematic direction", "اتجاه سينمائي")}</option><option value="video.product_fidelity">{tr("Product fidelity", "مطابقة المنتج")}</option></select></label></details>
          <div className="advanced-render-strip"><span><Move3D aria-hidden="true" /> {duration}{tr("s", "ث")}</span><span><Frame aria-hidden="true" /> {ratio}</span><span><ImagePlus aria-hidden="true" /> {resolution}</span><button type="button" onClick={() => setSettingsOpen(true)} aria-label={tr("Edit render settings", "تعديل إعدادات التوليد")}><Settings2 aria-hidden="true" /></button></div>
        </aside>
      </div>
      <AuthGateDialog open={authOpen} onOpenChange={setAuthOpen} returnPath={`/advanced?draft=${encodeURIComponent(draftId)}&resume=generate`} />
    </CreatorShell>
  );
}
