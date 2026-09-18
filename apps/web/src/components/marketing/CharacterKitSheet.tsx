import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, X, ImagePlus, UserRound, Sparkles, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useCharacterKit,
  EMPTY_CHARACTER_KIT,
  analyzeCharacterImage,
  type CharacterKit,
} from "@/lib/marketing/characterKit";

export function CharacterKitSheet({
  open,
  onOpenChange,
  onSaved,
  kitId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (kit: CharacterKit) => void;
  kitId?: string | null;
}) {
  const { kits, saveKit, deleteKit, uploadReference } = useCharacterKit();
  const [draft, setDraft] = useState<CharacterKit>(EMPTY_CHARACTER_KIT);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [justFilled, setJustFilled] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (kitId) {
      const found = kits.find((k) => k.id === kitId);
      setDraft(found ?? EMPTY_CHARACTER_KIT);
    } else {
      setDraft(EMPTY_CHARACTER_KIT);
    }
    // Intentionally omit `kits` — re-running on kits changes wipes
    // in-progress edits (notably an uploaded reference_path) when the
    // parent reloads characters mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kitId]);

  const update = <K extends keyof CharacterKit>(k: K, v: CharacterKit[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const runAnalyze = async (imagePath: string, shotType: "face" | "full") => {
    setAnalyzing(true);
    try {
      const res = await analyzeCharacterImage({ imagePath, shotType });
      setDraft((d) => ({
        ...d,
        name: d.name?.trim() ? d.name : (res.name ?? d.name),
        role: d.role?.trim() ? d.role : (res.role ?? d.role),
        description: d.description?.trim() ? d.description : (res.description ?? d.description),
      }));
      setJustFilled(true);
      window.setTimeout(() => setJustFilled(false), 4000);
    } catch (e: any) {
      toast.error("Couldn't auto-read the photo — fill it in manually");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Image must be under 25MB");
      return;
    }
    setUploading(true);
    try {
      const path = await uploadReference(file);
      update("reference_path", path);
      update("reference_url", URL.createObjectURL(file));
      void runAnalyze(path, draft.shot_type ?? "face");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleShotTypeChange = (next: "face" | "full") => {
    update("shot_type", next);
    if (draft.reference_path) {
      // Re-analyze with the new framing so the description matches the mode.
      void runAnalyze(draft.reference_path, next);
    }
  };




  const handleSave = async () => {
    if (!draft.name.trim()) {
      toast.error("Name your character first");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveKit(draft);
      toast.success("Character saved");
      onSaved?.(saved);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!draft.id) return;
    if (!window.confirm("Delete this character?")) return;
    try {
      await deleteKit(draft.id);
      toast.success("Character deleted");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Could not delete");
    }
  };

  const hasImage = !!draft.reference_url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] p-0 gap-0 max-h-[88vh] flex flex-col overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border/60">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            {draft.id ? "Edit character" : "New character"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Saved to your character library — reuse them on any ad.
          </DialogDescription>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Card 1 — Reference photo */}
          <Card title="Reference photo" helper="Pick what the photo shows, then upload a portrait.">
            <div className="space-y-2">
              <SubLabel>What does this photo show?</SubLabel>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: "face", title: "Face / headshot", hint: "Lock the face. Outfit stays flexible per ad." },
                  { id: "full", title: "Full look", hint: "Lock face + body + outfit. Same look every shot." },
                ] as const).map((opt) => {
                  const active = (draft.shot_type ?? "face") === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleShotTypeChange(opt.id)}
                      className={cn(
                        "text-left rounded-xl border px-3 py-2.5 transition-colors",
                        active
                          ? "border-[#F5A524] bg-[#F5A524]/10"
                          : "border-border/60 bg-secondary/20 hover:border-[#F5A524]/40",
                      )}
                    >
                      <p className="text-sm font-medium text-foreground">{opt.title}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{opt.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <SubLabel>Upload</SubLabel>
              {hasImage ? (
                <div className="flex items-center gap-3 p-2.5 sm:pr-3 rounded-xl border border-border/60 bg-secondary/20">
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="group relative w-14 h-14 rounded-lg overflow-hidden bg-muted/30 shrink-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                    aria-label="View full size"
                  >
                    <img src={draft.reference_url!} alt="" className="w-full h-full object-contain" />
                    <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground/90 truncate leading-tight">
                      {draft.name?.trim() || "Reference photo"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5 leading-none">
                      <span className={cn("w-1.5 h-1.5 rounded-full", analyzing ? "bg-accent animate-pulse" : "bg-emerald-500")} />
                      {analyzing ? "Reading the photo…" : "Ready"}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={uploading}
                      onClick={() => fileRef.current?.click()}
                      className="h-8 px-2 sm:px-3"
                    >
                      {uploading ? <Loader2 className="w-3.5 h-3.5 sm:mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 sm:mr-1.5" />}
                      <span className="hidden sm:inline">Replace</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        update("reference_path", null);
                        update("reference_url", null);
                      }}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      aria-label="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    handleFile(e.dataTransfer.files?.[0]);
                  }}
                  className={cn(
                    "w-full h-[140px] rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 transition-all",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60",
                    dragOver
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-accent/60 hover:bg-secondary/20 bg-secondary/10",
                  )}
                >
                  {uploading ? (
                    <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                  ) : (
                    <ImagePlus className="w-6 h-6 text-muted-foreground" />
                  )}
                  <p className="text-sm font-medium text-foreground/90">Upload a portrait of your character</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WEBP — up to 25 MB</p>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />

              {(analyzing || justFilled) && (
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-medium">
                  {analyzing ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Writing a detailed description…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      Filled by AI — edit anything below
                    </>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Card 2 — Identity */}
          <Card title="Identity" helper="Used by the Director to describe your character.">
            <Field
              label="Name"
              required
              value={draft.name}
              onChange={(v) => update("name", v)}
              placeholder="Maya, our barista"
            />
            <Field
              label="Role (optional)"
              value={draft.role ?? ""}
              onChange={(v) => update("role", v || null)}
              placeholder="Founder, customer, talent…"
              max={60}
            />
            <FieldArea
              label="Description"
              value={draft.description}
              onChange={(v) => update("description", v)}
              placeholder="30yo barista, short curly hair, warm smile, denim apron…"
              max={500}
            />
          </Card>
        </div>


        <div className="px-6 py-4 border-t border-border/60 flex items-center gap-2">
          {draft.id && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              Delete
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="min-w-[140px] bg-[#F5A524] text-black hover:bg-[#F5A524]/90"
          >
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            {draft.id ? "Save changes" : "Save character"}
          </Button>
        </div>
      </DialogContent>



      <Dialog open={lightboxOpen && hasImage} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-[860px] p-0 gap-0 bg-background/95 border-border/60 overflow-hidden">
          <DialogTitle className="sr-only">Reference photo preview</DialogTitle>
          <DialogDescription className="sr-only">
            Full-size view of {draft.name?.trim() || "the reference photo"}.
          </DialogDescription>
          <div className="relative w-full max-h-[86vh] flex items-center justify-center bg-black/40 p-4">
            {draft.reference_url && (
              <img
                src={draft.reference_url}
                alt={draft.name?.trim() || "Reference photo"}
                className="max-h-[82vh] max-w-full object-contain rounded-md"
              />
            )}
          </div>
          {(draft.name?.trim() || draft.role?.trim()) && (
            <div className="px-5 py-3 border-t border-border/60 bg-background/70">
              <p className="text-sm font-medium text-foreground/90 truncate">
                {draft.name?.trim() || "Reference photo"}
              </p>
              {draft.role?.trim() && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{draft.role}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  max?: number;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
        {label}
        {required && <span className="text-[hsl(0_72%_60%)]"> *</span>}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={max}
      />
    </div>
  );
}

function FieldArea({
  label,
  value,
  onChange,
  placeholder,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  max?: number;
}) {
  const count = value?.length ?? 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</Label>
        {max && (
          <span className="text-[10px] text-muted-foreground/70 tabular-nums">
            {count}/{max}
          </span>
        )}
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={max}
        className="min-h-[96px] resize-none"
      />
    </div>
  );
}

function Card({ title, helper, children }: { title: string; helper?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/40 bg-secondary/10 p-4 space-y-4">
      <header className="space-y-0.5">
        <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
        {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
      </header>
      {children}
    </section>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
      {children}
    </Label>
  );
}

