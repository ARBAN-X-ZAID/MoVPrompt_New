import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Palette, X, Wand2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  EMPTY_BRAND_IDENTITY,
  useBrandIdentity,
  type BrandIdentity,
} from "@/lib/marketing/brandIdentity";
import { useBrandKit } from "@/lib/marketing/brandKit";

const COLOR_PRESETS = [
  "#C8102E", "#E85D3A", "#F5A524", "#FFD23F",
  "#2DD4A8", "#0EA5E9", "#4F46E5", "#A78BFA",
  "#EC4899", "#1A1A1A", "#F5F0E6", "#FFFFFF",
];

const AVOID_PRESETS = ["blue", "neon", "pink", "purple", "green", "yellow", "red"];

function ColorSwatch({
  color,
  selected,
  onClick,
  size = "md",
}: {
  color: string;
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border transition-all shrink-0 relative",
        size === "lg" ? "w-10 h-10" : size === "md" ? "w-8 h-8" : "w-6 h-6",
        selected
          ? "border-accent ring-2 ring-accent/40 ring-offset-2 ring-offset-background scale-105"
          : "border-border/40 hover:border-foreground/40 hover:scale-105",
      )}
      style={{ background: color }}
      aria-label={color}
    />
  );
}

function Section({
  eyebrow,
  title,
  helper,
  icon,
  children,
}: {
  eyebrow?: string;
  title: string;
  helper?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/60 bg-card/40 p-4",
        "shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)]",
      )}
    >
      <div className="mb-3 space-y-0.5">
        {eyebrow && (
          <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-accent/80 flex items-center gap-1.5">
            {icon}
            {eyebrow}
          </div>
        )}
        <h3 className="text-sm font-semibold tracking-tight text-foreground font-display">
          {title}
        </h3>
        {helper && <p className="text-xs text-muted-foreground leading-snug">{helper}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function BrandIdentitySheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { identity, save, clear } = useBrandIdentity();
  const { setActiveIds: setBrandActiveIds, activeKits: brandKits } = useBrandKit();
  const [draft, setDraft] = useState<BrandIdentity>(EMPTY_BRAND_IDENTITY);
  const [colorMode, setColorMode] = useState<"auto" | "custom">("auto");
  const [saving, setSaving] = useState(false);
  const [newSupport, setNewSupport] = useState("");
  const [newAvoid, setNewAvoid] = useState("");

  useEffect(() => {
    if (!open) return;
    const next = identity ?? EMPTY_BRAND_IDENTITY;
    setDraft(next);
    const hasCustomColors =
      !!next.primary_color ||
      (next.supporting_colors?.length ?? 0) > 0 ||
      (next.avoid_colors?.length ?? 0) > 0;
    setColorMode(hasCustomColors ? "custom" : "auto");
  }, [open, identity]);

  const update = (patch: Partial<BrandIdentity>) => setDraft((d) => ({ ...d, ...patch }));

  // Sample of auto colors pulled from the user's product photos (preview only).
  const autoColors = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const k of brandKits) {
      for (const c of k.hero_colors ?? []) {
        if (!c) continue;
        const key = c.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(c.trim());
        if (out.length >= 5) break;
      }
      if (out.length >= 5) break;
    }
    return out;
  }, [brandKits]);


  const addSupporting = (c: string) => {
    const color = c.trim();
    if (!color) return;
    const list = draft.supporting_colors ?? [];
    if (list.includes(color) || list.length >= 4) return;
    update({ supporting_colors: [...list, color] });
    setNewSupport("");
  };
  const removeSupporting = (c: string) =>
    update({ supporting_colors: (draft.supporting_colors ?? []).filter((x) => x !== c) });

  const addAvoid = (c: string) => {
    const v = c.trim().toLowerCase();
    if (!v) return;
    const list = draft.avoid_colors ?? [];
    if (list.includes(v)) return;
    update({ avoid_colors: [...list, v] });
    setNewAvoid("");
  };
  const removeAvoid = (c: string) =>
    update({ avoid_colors: (draft.avoid_colors ?? []).filter((x) => x !== c) });

  const onSave = async () => {
    setSaving(true);
    try {
      // In Auto mode, clear all color overrides so the prompt builder
      // falls back to the product photos' palette.
      const colorPayload =
        colorMode === "auto"
          ? { primary_color: null, supporting_colors: null, avoid_colors: null }
          : {
              primary_color: draft.primary_color,
              supporting_colors: draft.supporting_colors,
              avoid_colors: draft.avoid_colors,
            };
      // Always null the fields we no longer surface so stale values don't
      // keep leaking into the Director's prompt. Logo is fully removed —
      // users add their real logo in their own editor after download.
      const payload: BrandIdentity = {
        ...draft,
        ...colorPayload,
        logo_path: null,
        logo_url: null,
        typography_vibe: null,
        font_hint: null,
        mood_notes: null,
        tagline: null,
        lighting_style: null,
        finish_vibe: null,
        pacing: null,
        logo_treatment: null,
        brand_voice: null,
        industry: null,
      };
      await save(payload);
      toast.success("Brand kit saved");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col overflow-hidden bg-background"
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 space-y-2 relative">
          <SheetTitle className="flex items-center gap-2.5 text-base font-display">
            <span className="relative inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent/15 text-accent">
              <Palette className="w-4 h-4" />
              <span className="absolute inset-0 rounded-lg ring-1 ring-accent/30" />
            </span>
            Brand Kit
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Just colors. Add your logo in your own editor after download for perfect fidelity.
          </p>
          <div className="absolute left-5 right-5 -bottom-px h-px bg-gradient-to-r from-transparent via-primary/40 to-accent/40" />
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Colors */}
          <Section
            eyebrow="01 · Color"
            title="Palette"
            helper="Used for lighting, props, wardrobe and backgrounds — never repainted onto the real product."
          >
            {/* Mode switch */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-secondary/30 border border-border/40">
              <button
                type="button"
                onClick={() => setColorMode("auto")}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                  colorMode === "auto"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Wand2 className="w-3.5 h-3.5" />
                Auto from product
              </button>
              <button
                type="button"
                onClick={() => setColorMode("custom")}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
                  colorMode === "custom"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Palette className="w-3.5 h-3.5" />
                Custom
              </button>
            </div>

            {colorMode === "auto" ? (
              <div className="rounded-xl border border-border/40 bg-secondary/15 p-3">
                <p className="text-[11px] text-muted-foreground leading-snug">
                  We'll pull the palette straight from your product photos so the ad matches your real product.
                </p>
                {autoColors.length > 0 ? (
                  <div className="mt-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1.5">
                      Detected from your products
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {autoColors.map((c) => (
                        <div key={c} className="inline-flex items-center gap-1.5 rounded-full bg-background/60 pl-1 pr-2.5 py-0.5 text-[11px] border border-border/40">
                          <ColorSwatch color={c} size="sm" />
                          <span className="font-mono text-foreground/80">{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground/80 italic mt-2">
                    Upload a product photo on the ads page and the palette will appear here.
                  </p>
                )}
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Primary</Label>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {COLOR_PRESETS.map((c) => (
                      <ColorSwatch
                        key={c}
                        color={c}
                        size="lg"
                        selected={draft.primary_color === c}
                        onClick={() => update({ primary_color: c })}
                      />
                    ))}
                  </div>
                  <Input
                    placeholder="#C8102E"
                    value={draft.primary_color ?? ""}
                    onChange={(e) => update({ primary_color: e.target.value || null })}
                    className="h-8 text-xs font-mono mt-2"
                  />
                </div>

                <div className="pt-2 border-t border-border/40">
                  <Label className="text-[11px] text-muted-foreground">Supporting (up to 4)</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5 min-h-[28px]">
                    {(draft.supporting_colors ?? []).length === 0 && (
                      <p className="text-[10px] text-muted-foreground italic">No supporting colors yet.</p>
                    )}
                    {(draft.supporting_colors ?? []).map((c) => (
                      <div key={c} className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 pl-1 pr-2 py-0.5 text-[11px]">
                        <ColorSwatch color={c} size="sm" />
                        <span className="font-mono">{c}</span>
                        <button type="button" onClick={() => removeSupporting(c)} className="text-muted-foreground hover:text-foreground">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="#1A1A1A"
                      value={newSupport}
                      onChange={(e) => setNewSupport(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSupporting(newSupport); } }}
                      className="h-8 text-xs font-mono"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => addSupporting(newSupport)}>Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {COLOR_PRESETS.map((c) => (
                      <ColorSwatch key={c} color={c} size="sm" onClick={() => addSupporting(c)} />
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-border/40">
                  <Label className="text-[11px] text-muted-foreground">Avoid</Label>
                  <p className="text-[10px] text-muted-foreground">Hard no's. The Director won't use these in lighting, props, wardrobe or backgrounds.</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5 min-h-[20px]">
                    {(draft.avoid_colors ?? []).map((c) => (
                      <div key={c} className="inline-flex items-center gap-1 rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[11px]">
                        <span>{c}</span>
                        <button type="button" onClick={() => removeAvoid(c)}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="e.g. neon pink"
                      value={newAvoid}
                      onChange={(e) => setNewAvoid(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAvoid(newAvoid); } }}
                      className="h-8 text-xs"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => addAvoid(newAvoid)}>Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {AVOID_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => addAvoid(c)}
                        className="px-2 py-0.5 rounded-full text-[10px] border border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/40"
                      >
                        + {c}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </Section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/60 flex items-center gap-2 bg-background/80 backdrop-blur">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={async () => {
              await clear();
              await setBrandActiveIds([]);
              onOpenChange(false);
              toast.success("Brand kit cleared");
            }}
            className="text-muted-foreground hover:text-destructive"
          >
            Clear
          </Button>
          <div className="flex-1" />
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={saving}
            className="bg-accent text-accent-foreground hover:bg-accent/90 min-w-[120px]"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
            Save brand kit
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
