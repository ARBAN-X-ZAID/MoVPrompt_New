import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Check, Plus, Sparkles, X, AlertTriangle, Image as ImageIcon, MapPin, LayoutGrid, Play } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { StudioPreset } from "@/lib/marketingStudio";
import { LocationPanel } from "@/components/marketing/LocationPanel";
import { EMPTY_LOCATION, type LocationInput } from "@/lib/marketing/brandKit";

export type PlaceMode = "preset" | "city" | "image";

const PLACE_SUGGESTIONS = ["Tokyo", "Paris", "New York", "Marrakech", "Dubai", "London", "Seoul", "Lagos"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  presets: StudioPreset[];
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  categories?: { id: string; label: string; tooltip?: string }[];
  searchPlaceholder?: string;
  locationValue?: LocationInput;
  onLocationChange?: (v: LocationInput) => void;
  /** Optional: enables the "Custom" card. */
  customValue?: string;
  onCustomChange?: (v: string) => void;
  customLabel?: string;
  /** Optional: enables the Place mode toggle (preset / city / image). */
  placeMode?: PlaceMode;
  onPlaceModeChange?: (m: PlaceMode) => void;
};

const MODE_META: Record<PlaceMode, { label: string; helper: string; icon: typeof LayoutGrid }> = {
  preset: { label: "Preset scene", helper: "Quick, clean scene types", icon: LayoutGrid },
  city: { label: "Real city", helper: "Match a real place's light & style", icon: MapPin },
  image: { label: "Reference image", helper: "Copy a photo pixel-faithfully", icon: ImageIcon },
};

export function PresetPickerDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  presets,
  selectedId,
  onSelect,
  categories,
  searchPlaceholder = "Search presets…",
  locationValue,
  onLocationChange,
  customValue,
  onCustomChange,
  customLabel = "Custom",
  placeMode,
  onPlaceModeChange,
}: Props) {
  const hasPlaceModes = !!placeMode && !!onPlaceModeChange;
  const [tab, setTab] = useState<string>("all");
  const [q, setQ] = useState("");
  const [draftId, setDraftId] = useState<string | undefined>(selectedId);
  const [draftCustom, setDraftCustom] = useState<string>(customValue ?? "");
  const [draftLocation, setDraftLocation] = useState<LocationInput | undefined>(locationValue);
  const [draftMode, setDraftMode] = useState<PlaceMode>(placeMode ?? "preset");
  const [customOpen, setCustomOpen] = useState<boolean>(!!(customValue && !selectedId));
  const [hoverId, setHoverId] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  // Sync drafts when dialog opens
  useEffect(() => {
    if (open) {
      setDraftId(selectedId);
      setDraftCustom(customValue ?? "");
      setDraftLocation(locationValue);
      setDraftMode(placeMode ?? "preset");
      setCustomOpen(!!(customValue && !selectedId));
      setQ("");
      setTab("all");
      setHoverId(null);
      cancelledRef.current = false;
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    return presets.filter((p) => {
      if (tab !== "all" && p.category !== tab) return false;
      if (q && !`${p.label} ${p.description}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [presets, tab, q]);

  const noMatch = q.trim().length > 0 && filtered.length === 0;
  const supportsCustom = !!onCustomChange;
  const showPresets = !hasPlaceModes || draftMode === "preset";
  const showCityInput = hasPlaceModes && draftMode === "city";
  const showImagePanel = hasPlaceModes ? draftMode === "image" : !!(locationValue && onLocationChange);

  // Detect conflicts: a preset is picked AND a city or image is also set.
  const hasPreset = !!draftId || !!draftCustom.trim();
  const hasCity = !!draftLocation?.place?.trim();
  const hasImage = !!draftLocation?.imagePath;
  const conflict = hasPlaceModes && hasPreset && (hasCity || hasImage);

  const switchMode = (m: PlaceMode) => {
    setDraftMode(m);
    onPlaceModeChange?.(m);
    if (m === "preset") {
      setDraftLocation(EMPTY_LOCATION);
    } else {
      setDraftId(undefined);
      setDraftCustom("");
      setCustomOpen(false);
      if (m === "city") {
        setDraftLocation((prev) => ({ ...(prev ?? EMPTY_LOCATION), imagePath: null, imageUrl: null }));
      } else if (m === "image") {
        setDraftLocation((prev) => ({ ...(prev ?? EMPTY_LOCATION), place: "" }));
      }
    }
  };

  const commit = useCallback(() => {
    if (supportsCustom) {
      if (draftCustom.trim() && !draftId) {
        onCustomChange?.(draftCustom.trim());
        onSelect(undefined);
      } else {
        onCustomChange?.("");
        onSelect(draftId);
      }
    } else {
      onSelect(draftId);
    }
    if (onLocationChange) onLocationChange(draftLocation ?? EMPTY_LOCATION);
  }, [supportsCustom, draftCustom, draftId, draftLocation, onCustomChange, onSelect, onLocationChange]);

  const apply = () => {
    commit();
    onOpenChange(false);
  };

  const cancel = () => {
    cancelledRef.current = true;
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (!cancelledRef.current) commit();
    onOpenChange(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && q) {
      e.stopPropagation();
      setQ("");
    }
  };

  const allModes: PlaceMode[] = ["preset", "city", "image"];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-5xl rounded-3xl border border-border/60 bg-[hsl(240_5%_7%)] p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden"
        onKeyDown={handleKey}
      >
        {/* Header */}
        <div className="px-6 sm:px-8 pt-6 pb-5 pr-14 sm:pr-16 border-b border-border/40 flex items-start gap-8">
          <div className="flex-1 min-w-0">
            <DialogTitle className="font-display text-2xl sm:text-3xl tracking-tight uppercase">
              {title}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground leading-relaxed text-sm mt-1">
              {subtitle}
            </DialogDescription>
          </div>
          {showPresets && (
            <div className="relative w-72 shrink-0 hidden sm:block">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-10 pr-9 rounded-xl bg-muted/30 border border-border/50 h-10 focus-visible:ring-1 focus-visible:ring-[#F5A524]/40 focus-visible:border-[#F5A524]/40"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Body: left rail + right pane */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left rail */}
          {(hasPlaceModes || (showPresets && categories && categories.length > 0)) && (
            <aside className="w-[220px] shrink-0 border-r border-border/40 px-5 py-6 overflow-y-auto hidden md:flex md:flex-col gap-7">
              {hasPlaceModes && (
                <div>
                  <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground/70 px-2 pb-2 mb-2.5 border-b border-border/30">
                    Mode
                  </div>
                  <div className="space-y-1">
                    {allModes.map((m) => {
                      const meta = MODE_META[m];
                      const Icon = meta.icon;
                      const active = draftMode === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => switchMode(m)}
                          className={cn(
                            "w-full text-left rounded-xl px-3 py-2 transition-all flex items-start gap-2.5 group",
                            active
                              ? "bg-[#F5A524]/10 text-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/20",
                          )}
                        >
                          <span
                            className={cn(
                              "w-7 h-7 rounded-lg inline-flex items-center justify-center shrink-0 transition-colors",
                              active
                                ? "bg-[#F5A524] text-black"
                                : "bg-muted/40 text-muted-foreground group-hover:text-foreground",
                            )}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </span>
                          <span className="min-w-0 pt-0.5">
                            <span className="block text-xs font-semibold leading-tight">
                              {meta.label}
                            </span>
                            <span className="block text-[10px] leading-snug text-muted-foreground/80 mt-0.5">
                              {meta.helper}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {showPresets && categories && categories.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground/70 px-2 pb-2 mb-2.5 border-b border-border/30">
                    Filter
                  </div>
                  <TooltipProvider delayDuration={200}>
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setTab("all")}
                        className={cn(
                          "w-full text-left rounded-lg px-3 py-2 text-xs transition-colors border-l-2",
                          tab === "all"
                            ? "bg-muted/30 text-foreground font-medium border-[#F5A524]"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/20 border-transparent",
                        )}
                      >
                        All
                      </button>
                      {categories.map((c) => {
                        const btn = (
                          <button
                            type="button"
                            onClick={() => setTab(c.id)}
                            className={cn(
                              "w-full text-left rounded-lg px-3 py-2 text-xs transition-colors capitalize border-l-2",
                              tab === c.id
                                ? "bg-muted/30 text-foreground font-medium border-[#F5A524]"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/20 border-transparent",
                            )}
                          >
                            {c.label}
                          </button>
                        );
                        return c.tooltip ? (
                          <Tooltip key={c.id}>
                            <TooltipTrigger asChild>{btn}</TooltipTrigger>
                            <TooltipContent side="right">{c.tooltip}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <div key={c.id}>{btn}</div>
                        );
                      })}
                    </div>
                  </TooltipProvider>
                </div>
              )}
            </aside>
          )}

          {/* Right pane */}
          <div className="flex-1 min-w-0 overflow-y-auto px-5 sm:px-6 py-5">
            {/* Mobile: mode tabs */}
            {hasPlaceModes && (
              <div className="md:hidden mb-4">
                <div className="inline-flex items-center gap-1 rounded-full bg-muted/30 p-1">
                  {allModes.map((m) => {
                    const meta = MODE_META[m];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => switchMode(m)}
                        className={cn(
                          "px-3 py-1.5 text-xs rounded-full transition-colors inline-flex items-center gap-1.5",
                          draftMode === m
                            ? "bg-background text-foreground border border-border/60"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mobile: search */}
            {showPresets && (
              <div className="sm:hidden mb-3 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="pl-9 pr-8 rounded-full bg-muted/30 border-border/40 h-9"
                />
              </div>
            )}

            {conflict && (
              <div className="mb-4 rounded-2xl border border-[#F5A524]/40 bg-[#F5A524]/10 p-3 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-[#F5A524] mt-0.5 shrink-0" />
                <div className="flex-1 text-xs text-foreground/90 leading-relaxed">
                  Your {hasImage ? "reference image" : "city"} will override the preset scene. Pick one mode to keep the prompt clean.
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDraftId(undefined);
                        setDraftCustom("");
                        switchMode(hasImage ? "image" : "city");
                      }}
                      className="px-2.5 py-1 rounded-full bg-[#F5A524] text-black text-[11px] font-semibold"
                    >
                      Use {hasImage ? "reference" : "city"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftLocation(EMPTY_LOCATION);
                        switchMode("preset");
                      }}
                      className="px-2.5 py-1 rounded-full border border-border/60 text-[11px]"
                    >
                      Use preset
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showCityInput && (
              <div className="rounded-2xl border border-border/40 bg-muted/10 p-5 space-y-4">
                <div>
                  <div className="text-base font-semibold text-foreground font-display">City or place</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Type a city, neighborhood, or landmark. The Director will match its architecture, light and styling.
                  </div>
                </div>
                <Input
                  value={draftLocation?.place ?? ""}
                  onChange={(e) =>
                    setDraftLocation({ ...(draftLocation ?? EMPTY_LOCATION), place: e.target.value })
                  }
                  placeholder="e.g. Tokyo, Shibuya crossing"
                  className="bg-background/60 h-11 text-sm"
                  autoFocus
                />
                <div>
                  <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground/70 mb-2">
                    Popular
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PLACE_SUGGESTIONS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() =>
                          setDraftLocation({ ...(draftLocation ?? EMPTY_LOCATION), place: p })
                        }
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs border transition-colors",
                          draftLocation?.place === p
                            ? "border-[#F5A524] bg-[#F5A524]/10 text-foreground"
                            : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border",
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {showImagePanel && draftLocation && (
              <div>
                <LocationPanel value={draftLocation} onChange={setDraftLocation} />
              </div>
            )}

            {showPresets && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filtered.map((p) => {
                    const active = p.id === draftId && !draftCustom;
                    const isHover = hoverId === p.id;
                    const shouldPlay = p.video && (isHover || active);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setDraftId(p.id);
                          setDraftCustom("");
                          setCustomOpen(false);
                        }}
                        onMouseEnter={() => setHoverId(p.id)}
                        onMouseLeave={() => setHoverId((id) => (id === p.id ? null : id))}
                        className={cn(
                          "group relative aspect-[4/5] rounded-2xl overflow-hidden bg-muted/20 text-left transition-all duration-300",
                          "ring-1 ring-inset",
                          active
                            ? "ring-[#F5A524] shadow-[0_8px_30px_-8px_hsl(35_90%_55%/0.5)]"
                            : "ring-border/30 hover:ring-[#F5A524]/50 hover:shadow-[0_8px_24px_-12px_hsl(35_90%_55%/0.35)]",
                        )}
                      >
                        {p.image && !p.video && (
                          <img
                            src={p.image}
                            alt={p.label}
                            loading="lazy"
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                            onError={(e) => {
                              const img = e.currentTarget as HTMLImageElement;
                              img.style.display = "none";
                              const fb = img.parentElement?.querySelector<HTMLElement>("[data-fallback]");
                              if (fb) fb.style.display = "flex";
                            }}
                          />
                        )}
                        {p.video && (
                          <video
                            src={p.video}
                            muted
                            loop
                            autoPlay
                            playsInline
                            preload="metadata"
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                          />
                        )}
                        <div
                          data-fallback
                          className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent items-center justify-center text-5xl"
                          style={{ display: p.image || p.video ? "none" : "flex" }}
                          aria-hidden
                        >
                          <span>{p.emoji ?? "🎬"}</span>
                        </div>

                        {/* Bottom gradient + label */}
                        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 px-3 pb-3 pt-8">
                          <div className="text-[13px] font-semibold text-white font-display tracking-tight leading-tight">
                            {p.label}
                          </div>
                          <div
                            className={cn(
                              "text-[10.5px] text-white/70 leading-snug line-clamp-2 transition-all duration-300 overflow-hidden",
                              active || isHover ? "max-h-10 opacity-100 mt-1" : "max-h-0 opacity-0 mt-0",
                            )}
                          >
                            {p.description}
                          </div>
                        </div>

                        {/* Play indicator for video presets */}
                        {p.video && !active && (
                          <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/50 backdrop-blur-sm text-white/80 inline-flex items-center justify-center">
                            <Play className="w-3 h-3 fill-current" />
                          </div>
                        )}

                        {/* Active check */}
                        {active && (
                          <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#F5A524] text-black inline-flex items-center justify-center shadow-md">
                            <Check className="w-4 h-4" strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {/* Custom card */}
                  {supportsCustom && !noMatch && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomOpen(true);
                        setDraftId(undefined);
                      }}
                      className={cn(
                        "group aspect-[4/5] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all p-4 text-center",
                        "hover:border-[#F5A524]/70 hover:bg-[#F5A524]/5",
                        draftCustom && !draftId
                          ? "border-[#F5A524] bg-[#F5A524]/5"
                          : "border-border/40 bg-muted/5",
                      )}
                    >
                      <div className="w-12 h-12 rounded-full bg-[#F5A524]/15 text-[#F5A524] inline-flex items-center justify-center transition-transform group-hover:scale-110">
                        <Plus className="w-6 h-6" />
                      </div>
                      <div className="text-sm font-semibold text-foreground font-display">{customLabel}</div>
                      <div className="text-[11px] text-muted-foreground line-clamp-3 px-2">
                        {draftCustom || `Describe your own ${customLabel.toLowerCase()}`}
                      </div>
                    </button>
                  )}
                </div>

                {/* Empty state */}
                {noMatch && (
                  <div className="mt-6 rounded-2xl border border-dashed border-border/50 bg-muted/10 p-8 flex flex-col items-center text-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#F5A524]/15 text-[#F5A524] inline-flex items-center justify-center">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        No scenes match "{q}"
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Try a different word{hasPlaceModes ? ", pick a real city, or describe a custom scene." : " or describe a custom scene."}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {supportsCustom && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setDraftCustom(q);
                            setDraftId(undefined);
                            setCustomOpen(true);
                            setQ("");
                          }}
                          className="bg-[#F5A524] text-black hover:bg-[#F5A524]/90"
                        >
                          Use "{q}" as custom
                        </Button>
                      )}
                      {hasPlaceModes && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            switchMode("city");
                            setQ("");
                          }}
                        >
                          Switch to Real city
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Custom editor */}
                {supportsCustom && customOpen && (
                  <div className="mt-4 rounded-2xl border border-[#F5A524]/40 bg-muted/10 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-foreground font-display">{customLabel}</div>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomOpen(false);
                          setDraftCustom("");
                        }}
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                    <Textarea
                      value={draftCustom}
                      onChange={(e) => setDraftCustom(e.target.value)}
                      placeholder={`Describe your ${customLabel.toLowerCase()}…`}
                      className="min-h-[88px] bg-background/60"
                      autoFocus
                    />
                    <p className="text-[11px] text-muted-foreground">
                      The AI will use this description directly.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/40 px-5 sm:px-6 py-3 flex items-center justify-between gap-3 bg-[hsl(240_5%_6%)]">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={cancel}
              className="text-sm text-muted-foreground hover:text-foreground px-2"
            >
              Cancel
            </button>
            <span className="hidden sm:inline text-[11px] text-muted-foreground/70 truncate">
              Selection saves automatically — Cancel to discard.
            </span>
          </div>
          <div className="flex items-center gap-2">
            {(hasPreset || hasCity || hasImage) && (
              <button
                type="button"
                onClick={() => {
                  setDraftId(undefined);
                  setDraftCustom("");
                  setCustomOpen(false);
                  setDraftLocation(EMPTY_LOCATION);
                }}
                className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/50 hover:border-border hover:bg-muted/30 transition-colors inline-flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
            <Button
              onClick={apply}
              className="bg-[#F5A524] text-black hover:bg-[#F5A524]/90 font-semibold px-5"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
