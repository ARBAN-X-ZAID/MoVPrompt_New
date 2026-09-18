import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Upload, Trash2, Film, Sparkles, Loader2, X, AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  HERO_PRESET_IDS, PRESETS, PRESET_GROUPS, getPresetVideoUrl,
  useAllPresets, ICON_NAMES, getIconByName,
} from "@/lib/presets";

const BUCKET = "preset-previews";

interface FileMeta {
  size: number;
  updated_at: string;
}

type CardStatus = "idle" | "generating" | "error" | "canceled";

const MODEL_OPTIONS = [
  { value: "ltx-fast", label: "LTX — fastest (~20s)" },
  { value: "wan-fast", label: "Wan 2.2 — fast (~30s)" },
  { value: "kling-std", label: "Kling — best quality (~90s)" },
] as const;
type ModelValue = typeof MODEL_OPTIONS[number]["value"];
const DEFAULT_MODEL: ModelValue = "ltx-fast";
const MODEL_STORAGE_KEY = "preset-previews:model";

// Camera-motion presets that historically render poorly on text-to-video
// models (vertical moves, reverse moves, dolly-zoom variants, focus pulls).
// Mirrors HARD_FOR_LTX in the edge function. Used by the "Re-generate likely
// wrong" admin action to quickly refresh just these after prompt updates.
const LIKELY_WRONG_PRESET_IDS = [
  "dolly-out", "pull-out",
  "tilt-up", "tilt-down",
  "pedestal-up", "pedestal-down",
  "crash-zoom-out",
  "crane-up", "crane-down",
  "jib-up", "jib-down",
  "dolly-zoom", "dolly-zoom-in", "dolly-zoom-out",
  "rack-focus",
];

const formatElapsed = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const PresetPreviewsSection = () => {
  const { presets: allPresets, customs, refetch: refetchCustoms } = useAllPresets();
  const customIds = new Set(customs.map((c) => c.id));
  const builtinIds = new Set(PRESETS.map((p) => p.id));
  const allIds = allPresets.map((p) => p.id);

  const [meta, setMeta] = useState<Record<string, FileMeta | null>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [cacheBust, setCacheBust] = useState(Date.now());
  const [statuses, setStatuses] = useState<Record<string, CardStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [genStarts, setGenStarts] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now());
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const cancelRequested = useRef<Record<string, boolean>>({});
  const [canceling, setCanceling] = useState<Record<string, boolean>>({});
  const [autoUpgrades, setAutoUpgrades] = useState<
    Record<string, { effectiveModel: ModelValue; reason: string } | undefined>
  >({});

  const [model, setModel] = useState<ModelValue>(() => {
    if (typeof window === "undefined") return DEFAULT_MODEL;
    const stored = window.localStorage.getItem(MODEL_STORAGE_KEY);
    return MODEL_OPTIONS.some((o) => o.value === stored) ? (stored as ModelValue) : DEFAULT_MODEL;
  });
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(MODEL_STORAGE_KEY, model);
  }, [model]);

  // Tick a clock while any generation is running so per-card elapsed updates.
  const anyGenerating = Object.values(statuses).some((s) => s === "generating");
  useEffect(() => {
    if (!anyGenerating) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [anyGenerating]);

  // New preset dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    label: "",
    id: "",
    group_id: PRESET_GROUPS[0].id as string,
    icon_name: "Camera",
    description: "",
    best_for: "",
    anim_class: "",
  });
  const [idEdited, setIdEdited] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "uploaded" | "missing">("all");
  const [modelFilter, setModelFilter] = useState<string>("all");

  // Per-preset metadata: which model produced the current preview, when.
  const [previewMeta, setPreviewMeta] = useState<
    Record<string, { preview_model: string | null; generated_at: string | null }>
  >({});

  const q = search.trim().toLowerCase();
  const filterPreset = (p: typeof allPresets[number]) => {
    if (groupFilter !== "all" && p.group !== groupFilter) return false;
    if (statusFilter === "uploaded" && !meta[p.id]) return false;
    if (statusFilter === "missing" && meta[p.id]) return false;
    if (modelFilter !== "all") {
      const m = previewMeta[p.id]?.preview_model ?? null;
      if (modelFilter === "unknown") {
        if (!meta[p.id]) return false;
        if (m) return false;
      } else if (m !== modelFilter) {
        return false;
      }
    }
    if (q) {
      const hay = `${p.label} ${p.id} ${p.description ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  };

  const filteredPresets = allPresets.filter(filterPreset);
  const presetsByGroup = PRESET_GROUPS
    .filter((g) => groupFilter === "all" || g.id === groupFilter)
    .map((g) => ({
      group: g,
      items: filteredPresets.filter((p) => p.group === g.id),
    }))
    .filter((g) => g.items.length > 0);

  const uploadedCount = allIds.filter((id) => meta[id]).length;
  const filtersActive = q !== "" || groupFilter !== "all" || statusFilter !== "all" || modelFilter !== "all";
  const clearFilters = () => {
    setSearch(""); setGroupFilter("all"); setStatusFilter("all"); setModelFilter("all");
  };

  const refreshPreviewMeta = async () => {
    const { data, error } = await supabase
      .from("preset_preview_meta")
      .select("preset_id, preview_model, generated_at");
    if (error) {
      console.error(error);
      return;
    }
    const map: Record<string, { preview_model: string | null; generated_at: string | null }> = {};
    (data || []).forEach((r) => {
      map[r.preset_id] = {
        preview_model: r.preview_model,
        generated_at: r.generated_at,
      };
    });
    setPreviewMeta(map);
  };

  const refresh = async () => {
    const { data, error } = await supabase.storage.from(BUCKET).list("", { limit: 1000 });
    if (error) {
      console.error(error);
      return;
    }
    const map: Record<string, FileMeta | null> = {};
    allIds.forEach((id) => (map[id] = null));
    (data || []).forEach((f) => {
      const id = f.name.replace(/\.mp4$/, "");
      if (map[id] === null || allIds.includes(id)) {
        map[id] = {
          size: (f.metadata as { size?: number } | null)?.size ?? 0,
          updated_at: f.updated_at ?? f.created_at ?? "",
        };
      }
    });
    setMeta(map);
    setCacheBust(Date.now());
    await refreshPreviewMeta();
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPresets.length]);

  const handleUpload = async (presetId: string, file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error("Please upload a video file (MP4 recommended)");
      return;
    }
    setUploading(presetId);
    const path = `${presetId}.mp4`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: true,
      contentType: "video/mp4",
      cacheControl: "3600",
    });
    if (!error) {
      // Manual upload — drop any stale model attribution.
      await supabase.from("preset_preview_meta").delete().eq("preset_id", presetId);
    }
    setUploading(null);
    if (error) {
      toast.error(`Upload failed: ${error.message}`);
      return;
    }
    toast.success(`Uploaded preview for ${presetId}`);
    await refresh();
  };

  const handleDelete = async (presetId: string) => {
    if (!confirm(`Delete preview for ${presetId}?`)) return;
    const { error } = await supabase.storage.from(BUCKET).remove([`${presetId}.mp4`]);
    if (error) {
      toast.error(`Delete failed: ${error.message}`);
      return;
    }
    await supabase.from("preset_preview_meta").delete().eq("preset_id", presetId);
    toast.success("Deleted");
    await refresh();
  };

  const handleDeleteCustomPreset = async (presetId: string) => {
    if (!confirm(`Delete custom preset "${presetId}"? This also removes its video.`)) return;
    await supabase.storage.from(BUCKET).remove([`${presetId}.mp4`]);
    await supabase.from("preset_preview_meta").delete().eq("preset_id", presetId);
    const { error } = await supabase.from("custom_presets").delete().eq("id", presetId);
    if (error) {
      toast.error(`Delete failed: ${error.message}`);
      return;
    }
    toast.success("Custom preset deleted");
    await refetchCustoms();
    await refresh();
  };

  const generateOne = async (
    presetId: string,
    attempt = 0,
  ): Promise<{ ok: boolean; code?: string; error?: string }> => {
    setStatuses((s) => ({ ...s, [presetId]: "generating" }));
    setErrors((e) => {
      const next = { ...e };
      delete next[presetId];
      return next;
    });
    setGenStarts((g) => ({ ...g, [presetId]: Date.now() }));
    cancelRequested.current[presetId] = false;
    setCanceling((c) => {
      const next = { ...c };
      delete next[presetId];
      return next;
    });
    setAutoUpgrades((u) => {
      const next = { ...u };
      delete next[presetId];
      return next;
    });

    const markCanceled = (): { ok: false; code: "canceled" } => {
      cancelRequested.current[presetId] = false;
      setCanceling((c) => {
        const next = { ...c };
        delete next[presetId];
        return next;
      });
      setGenStarts((g) => {
        const next = { ...g };
        delete next[presetId];
        return next;
      });
      setStatuses((s) => ({ ...s, [presetId]: "canceled" }));
      return { ok: false, code: "canceled" };
    };

    const preset = allPresets.find((p) => p.id === presetId);
    const { data: subData, error: subErr } = await supabase.functions.invoke(
      "generate-preset-preview",
      {
        body: {
          action: "submit",
          presetId,
          model,
          label: preset?.label,
          description: preset?.description,
          bestFor: preset?.bestFor,
          groupId: preset?.group,
        },
      },
    );
    const sub = (subData as { ok?: boolean; code?: string; error?: string; statusUrl?: string; responseUrl?: string; effectiveModel?: string; requestedModel?: string; upgraded?: boolean; upgradeReason?: string | null } | null) ?? null;
    if (cancelRequested.current[presetId]) return markCanceled();
    if (subErr || !sub?.ok) {
      const code = sub?.code;
      if (code === "rate_limit" && attempt < 2) {
        await new Promise((r) => setTimeout(r, 10_000));
        return generateOne(presetId, attempt + 1);
      }
      const msg = sub?.error || subErr?.message || "Submit failed";
      setStatuses((s) => ({ ...s, [presetId]: "error" }));
      setErrors((e) => ({ ...e, [presetId]: msg }));
      return { ok: false, code, error: msg };
    }

    const effectiveModel = (MODEL_OPTIONS.some((o) => o.value === sub.effectiveModel)
      ? (sub.effectiveModel as ModelValue)
      : model);
    if (sub.upgraded && sub.upgradeReason) {
      setAutoUpgrades((u) => ({
        ...u,
        [presetId]: { effectiveModel, reason: sub.upgradeReason as string },
      }));
    }

    const deadline = Date.now() + 6 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 4_000));
      if (cancelRequested.current[presetId]) return markCanceled();
      const { data: pData, error: pErr } = await supabase.functions.invoke(
        "generate-preset-preview",
        {
          body: {
            action: "poll",
            presetId,
            model: effectiveModel,
            statusUrl: sub.statusUrl,
            responseUrl: sub.responseUrl,
          },
        },
      );
      const p = (pData as { ok?: boolean; status?: string; code?: string; error?: string } | null) ?? null;
      if (cancelRequested.current[presetId]) return markCanceled();
      if (pErr || !p?.ok) {
        const msg = p?.error || pErr?.message || "Poll failed";
        setStatuses((s) => ({ ...s, [presetId]: "error" }));
        setErrors((e) => ({ ...e, [presetId]: msg }));
        return { ok: false, code: p?.code, error: msg };
      }
      if (p.status === "done") {
        setStatuses((s) => ({ ...s, [presetId]: "idle" }));
        await refresh();
        return { ok: true };
      }
    }
    const msg = "Timed out after 6 minutes";
    setStatuses((s) => ({ ...s, [presetId]: "error" }));
    setErrors((e) => ({ ...e, [presetId]: msg }));
    return { ok: false, code: "timeout", error: msg };
  };

  const handleGenerateOne = async (presetId: string) => {
    const res = await generateOne(presetId);
    if (res.ok) toast.success(`Generated ${presetId}`);
    else if (res.code === "canceled") toast(`Canceled ${presetId}`);
    else if (res.code === "no_credits") toast.error("Fal.ai credits exhausted — top up at fal.ai/dashboard/billing");
    else toast.error(`Failed: ${res.error}`);
  };

  const requestCancel = (presetId: string) => {
    cancelRequested.current[presetId] = true;
    setCanceling((c) => ({ ...c, [presetId]: true }));
  };

  const [batchRunning, setBatchRunning] = useState(false);
  const batchCancel = useRef(false);

  // Re-generate the camera-motion presets known to render poorly, plus any
  // preset currently in error state. Runs sequentially to avoid hammering Fal.
  const handleRegenerateLikelyWrong = async () => {
    const errored = Object.entries(statuses)
      .filter(([, s]) => s === "error")
      .map(([id]) => id);
    const allIdsSet = new Set(allPresets.map((p) => p.id));
    const targets = Array.from(new Set([...LIKELY_WRONG_PRESET_IDS, ...errored]))
      .filter((id) => allIdsSet.has(id));

    if (targets.length === 0) {
      toast("Nothing to re-generate");
      return;
    }
    if (!confirm(
      `Re-generate ${targets.length} preset preview${targets.length === 1 ? "" : "s"} ` +
      `(camera-motion presets known to render poorly + any currently in error)?\n\n` +
      `This runs sequentially and may take several minutes. Click Cancel on any ` +
      `card to skip it; close this section to abort the queue.`
    )) return;

    setBatchRunning(true);
    batchCancel.current = false;
    let ok = 0;
    let failed = 0;
    let canceled = 0;
    for (const id of targets) {
      if (batchCancel.current) break;
      const res = await generateOne(id);
      if (res.ok) ok++;
      else if (res.code === "canceled") canceled++;
      else {
        failed++;
        if (res.code === "no_credits") {
          toast.error("Fal.ai credits exhausted — stopping batch");
          break;
        }
      }
    }
    setBatchRunning(false);
    toast.success(
      `Batch complete: ${ok} generated, ${failed} failed, ${canceled} canceled`,
    );
  };

  const handleCancelBatch = () => {
    batchCancel.current = true;
    // Also cancel whichever preset is currently mid-flight.
    const active = Object.entries(statuses).find(([, s]) => s === "generating");
    if (active) requestCancel(active[0]);
  };

  const resetForm = () => {
    setForm({
      label: "",
      id: "",
      group_id: PRESET_GROUPS[0].id as string,
      icon_name: "Camera",
      description: "",
      best_for: "",
      anim_class: "",
    });
    setIdEdited(false);
  };

  const handleCreatePreset = async () => {
    const id = (form.id || slugify(form.label)).trim();
    if (!form.label.trim()) return toast.error("Label is required");
    if (!id) return toast.error("ID is required");
    if (!/^[a-z0-9-]+$/.test(id)) return toast.error("ID must be lowercase letters, numbers, and dashes");
    if (builtinIds.has(id) || customIds.has(id)) return toast.error(`ID "${id}" already exists`);

    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("custom_presets").insert({
      id,
      label: form.label.trim(),
      group_id: form.group_id,
      icon_name: form.icon_name,
      description: form.description.trim(),
      best_for: form.best_for.trim(),
      anim_class: form.anim_class.trim() || null,
      created_by: user?.id ?? null,
    });
    setCreating(false);
    if (error) {
      toast.error(`Create failed: ${error.message}`);
      return;
    }
    toast.success(`Created "${form.label}"`);
    resetForm();
    setDialogOpen(false);
    await refetchCustoms();
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const PreviewIcon = getIconByName(form.icon_name);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="w-5 h-5 text-primary" />
          Preset Previews
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {uploadedCount} / {allIds.length} uploaded
          </span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload an MP4 for any preset to enable hover-play on the main page.
          Create custom presets to add your own cards.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-2">
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                New Preset
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create custom preset</DialogTitle>
                <DialogDescription>
                  Adds a new card to the main preset grid. Upload an MP4 after creation to enable hover-play.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="cp-label">Label</Label>
                  <Input
                    id="cp-label"
                    value={form.label}
                    onChange={(e) => {
                      const label = e.target.value;
                      setForm((f) => ({
                        ...f,
                        label,
                        id: idEdited ? f.id : slugify(label),
                      }));
                    }}
                    placeholder="e.g. Cosmic Dust"
                  />
                </div>
                <div>
                  <Label htmlFor="cp-id">ID (slug)</Label>
                  <Input
                    id="cp-id"
                    value={form.id}
                    onChange={(e) => { setIdEdited(true); setForm((f) => ({ ...f, id: slugify(e.target.value) })); }}
                    placeholder="cosmic-dust"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Group</Label>
                    <Select value={form.group_id} onValueChange={(v) => setForm((f) => ({ ...f, group_id: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRESET_GROUPS.map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            <span className="me-2">{g.icon}</span>{g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Icon</Label>
                    <Select value={form.icon_name} onValueChange={(v) => setForm((f) => ({ ...f, icon_name: v }))}>
                      <SelectTrigger>
                        <div className="flex items-center gap-2">
                          <PreviewIcon className="w-4 h-4" />
                          <span>{form.icon_name}</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {ICON_NAMES.map((name) => {
                          const I = getIconByName(name);
                          return (
                            <SelectItem key={name} value={name}>
                              <div className="flex items-center gap-2">
                                <I className="w-4 h-4" />
                                <span>{name}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="cp-desc">Description</Label>
                  <Textarea
                    id="cp-desc"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Short description shown on hover"
                    rows={2}
                  />
                </div>
                <div>
                  <Label htmlFor="cp-best">Best for</Label>
                  <Input
                    id="cp-best"
                    value={form.best_for}
                    onChange={(e) => setForm((f) => ({ ...f, best_for: e.target.value }))}
                    placeholder="e.g. Sci-fi reveals"
                  />
                </div>
                <div>
                  <Label htmlFor="cp-anim">Animation class (optional)</Label>
                  <Input
                    id="cp-anim"
                    value={form.anim_class}
                    onChange={(e) => setForm((f) => ({ ...f, anim_class: e.target.value }))}
                    placeholder="preset-pulse"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="button" onClick={handleCreatePreset} disabled={creating}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <Plus className="w-4 h-4 me-2" />}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <div className="sm:ml-auto sm:max-w-xs w-full">
            <Label htmlFor="pp-model" className="text-xs text-muted-foreground">Model</Label>
            <Select value={model} onValueChange={(v) => setModel(v as ModelValue)}>
              <SelectTrigger id="pp-model" className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              LTX is fastest. Switch to Kling for the highest-quality reference clips.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, id, or description…"
              className="pr-8"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="sm:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {PRESET_GROUPS.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  <span className="me-2">{g.icon}</span>{g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "uploaded" | "missing")}>
            <SelectTrigger className="sm:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="uploaded">Uploaded</SelectItem>
              <SelectItem value="missing">Missing video</SelectItem>
            </SelectContent>
          </Select>
          <Select value={modelFilter} onValueChange={setModelFilter}>
            <SelectTrigger className="sm:w-[180px]"><SelectValue placeholder="All models" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All models</SelectItem>
              {MODEL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
              <SelectItem value="unknown">Unknown / uploaded</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-xs text-muted-foreground sm:ml-auto">
            <span>Showing {filteredPresets.length} of {allIds.length}</span>
            {filtersActive && (
              <Button type="button" size="sm" variant="ghost" onClick={clearFilters} className="h-7 gap-1">
                <X className="w-3 h-3" /> Clear
              </Button>
            )}
            {batchRunning ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCancelBatch}
                className="h-7 gap-1"
              >
                <X className="w-3 h-3" /> Cancel batch
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleRegenerateLikelyWrong}
                className="h-7 gap-1"
                title="Re-generate camera-motion presets known to render poorly + any currently in error"
              >
                <Sparkles className="w-3 h-3" /> Re-generate likely wrong
              </Button>
            )}
          </div>
        </div>
        {presetsByGroup.map(({ group, items }) => {
          const groupUploaded = items.filter((p) => meta[p.id]).length;
          return (
            <section key={group.id}>
              <div className="flex items-baseline gap-2 mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <span>{group.icon}</span>
                  {group.label}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {groupUploaded} / {items.length} uploaded
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((preset) => {
                  const fileMeta = meta[preset.id];
                  const url = fileMeta ? `${getPresetVideoUrl(preset.id)}?t=${cacheBust}` : null;
                  const Icon = preset.icon;
                  const status = statuses[preset.id] ?? "idle";
                  const errMsg = errors[preset.id];
                  const isGen = status === "generating";
                  const isCanceled = status === "canceled";
                  const isCanceling = !!canceling[preset.id];
                  const isHero = HERO_PRESET_IDS.includes(preset.id);
                  const isCustom = customIds.has(preset.id);
                  return (
                    <div key={preset.id} className="rounded-lg border border-border/50 bg-secondary/30 overflow-hidden flex flex-col">
                      <div className="relative h-28 bg-gradient-to-b from-background/60 to-secondary/60 flex items-center justify-center overflow-hidden">
                        {url ? (
                          <video key={url} src={url} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />
                        ) : (
                          <Icon size={40} className="text-muted-foreground/40" />
                        )}
                        {isGen && (
                          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center gap-1.5">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            <div className="text-[10px] font-mono text-foreground/80 tabular-nums">
                              {genStarts[preset.id] ? formatElapsed(now - genStarts[preset.id]) : "0:00"}
                            </div>
                            <div className="text-[10px] text-muted-foreground px-2 text-center leading-tight">
                              {isCanceling
                                ? "Canceling…"
                                : (MODEL_OPTIONS.find(
                                    (o) => o.value === (autoUpgrades[preset.id]?.effectiveModel ?? model),
                                  )?.label)}
                            </div>
                            {autoUpgrades[preset.id] && !isCanceling && (
                              <div className="text-[9px] text-accent px-2 text-center leading-tight max-w-[14rem]">
                                Auto-upgraded for accuracy
                              </div>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 gap-1 text-[10px]"
                              disabled={isCanceling}
                              onClick={() => requestCancel(preset.id)}
                            >
                              <X className="w-3 h-3" /> Cancel
                            </Button>
                          </div>
                        )}
                        {isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomPreset(preset.id)}
                            className="absolute top-1.5 right-1.5 p-1 rounded bg-background/70 backdrop-blur-sm hover:bg-destructive/80 hover:text-destructive-foreground transition-colors"
                            title="Delete custom preset"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="p-3 space-y-2 flex-1 flex flex-col">
                        <div>
                          <p className="text-sm font-semibold flex items-center gap-1.5 flex-wrap">
                            {preset.label}
                            {isHero && (
                              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">Hero</span>
                            )}
                            {isCustom && (
                              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/20 text-accent font-medium">Custom</span>
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono">{preset.id}</p>
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                          {fileMeta ? (
                            <>
                              <span>
                                {formatSize(fileMeta.size)} ·{" "}
                                {fileMeta.updated_at ? new Date(fileMeta.updated_at).toLocaleDateString() : ""}
                              </span>
                              {(() => {
                                const pm = previewMeta[preset.id]?.preview_model;
                                const label = pm ? (MODEL_OPTIONS.find((o) => o.value === pm)?.label ?? pm) : null;
                                return label ? (
                                  <span
                                    className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium"
                                    title={`Generated with ${label}`}
                                  >
                                    {pm}
                                  </span>
                                ) : (
                                  <span
                                    className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium"
                                    title="Source model unknown (uploaded manually or pre-tracking)"
                                  >
                                    unknown
                                  </span>
                                );
                              })()}
                            </>
                          ) : (
                            <span className="italic">No video uploaded</span>
                          )}
                        </div>
                        {status === "error" && errMsg && (
                          <div className="flex items-start gap-1.5 text-[11px] text-destructive bg-destructive/10 rounded px-2 py-1">
                            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{errMsg}</span>
                          </div>
                        )}
                        {isCanceled && (
                          <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground bg-muted/60 rounded px-2 py-1">
                            <X className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">Canceled — job may still complete server-side. Refresh to check.</span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 mt-auto">
                          <input
                            ref={(el) => (inputs.current[preset.id] = el)}
                            type="file"
                            accept="video/mp4,video/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUpload(preset.id, f);
                              e.target.value = "";
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            className="flex-1 gap-1.5"
                            disabled={isGen}
                            onClick={() => handleGenerateOne(preset.id)}
                          >
                            {isGen ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            {isGen ? "Generating" : isCanceled ? "Generate again" : "Generate"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={uploading === preset.id || isGen}
                            onClick={() => inputs.current[preset.id]?.click()}
                          >
                            <Upload className="w-3.5 h-3.5" />
                            {uploading === preset.id ? "…" : fileMeta ? "Replace" : "Upload"}
                          </Button>
                          {fileMeta && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(preset.id)}
                              disabled={isGen}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default PresetPreviewsSection;
