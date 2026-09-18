import { useEffect, useMemo, useState } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelectLabel } from "@radix-ui/react-select";
import { Label } from "@/components/ui/label";
import { MODEL_GROUPS, type ModelGroup, type ModelOption } from "@/lib/models";
import { getContract } from "@/lib/modelContracts";
import { useLanguage } from "@/i18n/LanguageContext";
import { useModelAvailability, type AvailabilityMap } from "@/hooks/useModelAvailability";
import { Sparkles, Search, Pencil, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";


interface ModelPickerProps {
  model: string;
  onModelChange: (v: string) => void;
}



const GROUP_META: Record<string, { short: string; company: string; order: number }> = {
  "Google": { short: "VEO", company: "by Google", order: 1 },
  "Kuaishou (Kling)": { short: "KLING", company: "by Kuaishou", order: 2 },
  "ByteDance (Seedance)": { short: "SEEDANCE", company: "by ByteDance", order: 3 },
};

const VARIANT_TOKENS = ["Omni Edit", "Motion Control", "Video Edit", "Pro Fast", "Omni", "Turbo", "Fast", "Lite", "Pro", "Video"];

function splitLabel(label: string): { base: string; variant: string | null } {
  for (const tok of VARIANT_TOKENS) {
    const re = new RegExp(`\\s+${tok}$`, "i");
    if (re.test(label)) {
      return { base: label.replace(re, ""), variant: tok.toUpperCase() };
    }
  }
  return { base: label, variant: null };
}

type Tier = "lite" | "fast" | "flagship" | "turbo" | "default";

// Tier classification: explicit per-value overrides win, otherwise derived from variant token
const TIER_OVERRIDES: Record<string, Tier> = {
  "veo-3.1": "flagship",
  "veo-3": "flagship",
  "kling-3.0": "flagship",
  "kling-3.0-pro": "flagship",
  "kling-3.0-omni": "flagship",
  "kling-3.0-omni-edit": "flagship",
  "kling-2.1-master": "flagship",
  "kling-2-master": "flagship",
  "seedance-2.0": "flagship",
  "seedance-pro": "flagship",
  "seedance-1.5-pro": "flagship",
};

function classifyTier(value: string, variant: string | null): Tier {
  if (TIER_OVERRIDES[value]) return TIER_OVERRIDES[value];
  if (!variant) return "default";
  const v = variant.toUpperCase();
  if (v === "LITE") return "lite";
  if (v === "TURBO") return "turbo";
  if (v === "FAST" || v === "PRO FAST") return "fast";
  if (v === "PRO" || v === "OMNI" || v === "OMNI EDIT") return "flagship";
  return "default";
}

const TIER_PILL: Record<Tier, string> = {
  lite: "border border-muted-foreground/30 text-muted-foreground bg-transparent",
  fast: "border border-primary/40 text-primary bg-transparent",
  flagship: "border border-primary/60 text-primary bg-transparent",
  turbo: "border border-muted-foreground/30 text-muted-foreground bg-transparent",
  default: "border border-muted-foreground/30 text-muted-foreground bg-transparent",
};

// Lower rank = better. Defaults to mid (5) if missing.
const MODEL_RANKS: Record<string, { quality: number; speed: number; price: number }> = {
  // Veo
  "veo-3.1": { quality: 1, speed: 6, price: 8 },
  "veo-3.1-fast": { quality: 3, speed: 2, price: 5 },
  "veo-3.1-lite": { quality: 6, speed: 1, price: 1 },
  "veo-3": { quality: 2, speed: 7, price: 9 },
  "veo-3-fast": { quality: 4, speed: 3, price: 4 },
  "veo-2": { quality: 6, speed: 4, price: 3 },
  // Kling
  "kling-3.0-omni": { quality: 1, speed: 5, price: 8 },
  "kling-3.0-omni-edit": { quality: 1, speed: 5, price: 8 },
  "kling-3.0": { quality: 2, speed: 5, price: 7 },
  "kling-3.0-pro": { quality: 1, speed: 5, price: 8 },
  "kling-3.0-standard": { quality: 3, speed: 2, price: 5 },
  "kling-3.0-4k": { quality: 1, speed: 7, price: 9 },
  "kling-3.0-motion-control": { quality: 2, speed: 5, price: 7 },
  "kling-2.6": { quality: 4, speed: 4, price: 5 },
  "kling-2.5-turbo": { quality: 5, speed: 1, price: 3 },
  "kling-2.1-master": { quality: 3, speed: 5, price: 7 },
  "kling-2-master": { quality: 4, speed: 5, price: 7 },
  "kling-1.6-pro": { quality: 6, speed: 5, price: 4 },
  "kling-1.6-standard": { quality: 7, speed: 2, price: 2 },
  "kling-o1-video": { quality: 3, speed: 5, price: 6 },
  "kling-o1-video-edit": { quality: 3, speed: 5, price: 6 },
  "kling-motion-control": { quality: 4, speed: 5, price: 5 },
  // Seedance
  "seedance-2.0": { quality: 1, speed: 5, price: 7 },
  "seedance-2.0-fast": { quality: 3, speed: 2, price: 4 },
  "seedance-1.5-pro": { quality: 2, speed: 5, price: 7 },
  "seedance-pro": { quality: 2, speed: 5, price: 7 },
  "seedance-pro-fast": { quality: 3, speed: 2, price: 4 },
};

function rankOf(value: string, dim: "quality" | "speed" | "price"): number {
  return MODEL_RANKS[value]?.[dim] ?? 5;
}

type SortMode = "recommended" | "quality" | "speed" | "price";

interface ModelRowProps {
  value: string;
  label: string;
  description: string;
  isAny?: boolean;
  providerLabel?: string;
  hasAudio?: boolean;
}

const ModelRow = ({ value, label, description, isAny, providerLabel, hasAudio }: ModelRowProps) => {
  const { base, variant } = isAny ? { base: label, variant: null } : splitLabel(label);
  const tier = isAny ? "default" : classifyTier(value, variant);
  // Show "FLAGSHIP" pill on top-tier models that have no variant suffix (e.g. Veo 3.1, Kling 3.0).
  const showFlagshipPill = !isAny && !variant && tier === "flagship";
  // OMNI EDIT is a function variant — render as outline + pencil icon.
  const isOmniEdit = variant === "OMNI EDIT";
  const variantPillClass = isOmniEdit
    ? "border border-primary/60 text-primary bg-transparent"
    : TIER_PILL[tier];

  return (
    <SelectItem
      value={value}
      className={cn(
        "items-start py-2.5 ps-4 pe-4 min-h-[3rem] cursor-pointer relative",
        "border-l border-l-transparent transition-[background-color,border-color] duration-150 ease-out",
        "hover:border-l-primary hover:bg-muted",
        "data-[state=checked]:border-l-primary data-[state=checked]:bg-primary/[0.06]",
        "data-[highlighted]:bg-muted data-[highlighted]:[&_*]:text-inherit",
        "[&>span:last-child]:block [&>span:last-child]:w-full [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1"
      )}
    >
      <div className="flex flex-col gap-1 w-full min-w-0 pe-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[15px] leading-tight text-foreground font-semibold">
            {base}
          </span>
          {showFlagshipPill && (
            <span className="inline-flex items-center px-1.5 py-[1px] rounded border border-primary/60 text-primary text-[10px] font-semibold uppercase tracking-wider leading-none">
              Flagship
            </span>
          )}
          {variant && (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-[1px] rounded text-[10px] font-semibold uppercase tracking-wider leading-none",
                variantPillClass
              )}
            >
              {isOmniEdit && <Pencil size={9} />}
              {variant}
            </span>
          )}
          {hasAudio && !isAny && (
            <span
              title="Native audio (dialogue, SFX, music)"
              className="inline-flex items-center gap-1 px-1.5 py-[1px] rounded border border-primary/40 text-primary text-[10px] font-semibold uppercase tracking-wider leading-none"
            >
              <Volume2 size={9} />
              Audio
            </span>
          )}
          {isAny && (
            <span className="inline-flex items-center px-1.5 py-[1px] rounded border border-primary/40 text-primary text-[10px] font-semibold uppercase tracking-wider leading-none">
              Recommended
            </span>
          )}
        </div>
        {providerLabel && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">
            {providerLabel}
          </span>
        )}
        <span className="block w-full text-[11px] text-muted-foreground whitespace-normal break-words leading-snug">
          {description}
        </span>
      </div>
    </SelectItem>
  );
};

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: "recommended", label: "Recommended" },
  { id: "quality", label: "Quality" },
  { id: "speed", label: "Speed" },
  { id: "price", label: "Price" },
];

export const ModelPicker = ({ model, onModelChange }: ModelPickerProps) => {
  const { t } = useLanguage();
  const contract = getContract(model);
  const variantDesc = contract.variantDescKey ? t(contract.variantDescKey as any) : null;
  const [flash, setFlash] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("recommended");
  const availability = useModelAvailability();

  useEffect(() => {
    setFlash(true);
    const id = setTimeout(() => setFlash(false), 200);
    return () => clearTimeout(id);
  }, [model]);

  // Filter gated entries by live availability flags, then sort groups.
  const sortedGroups: ModelGroup[] = useMemo(() => {
    const filterGated = (m: ModelOption) =>
      !m.gated || availability[m.gated.availabilityKey]?.available === true;
    return [...MODEL_GROUPS]
      .map((g) => ({ ...g, models: g.models.filter(filterGated) }))
      .sort(
        (a, b) => (GROUP_META[a.label]?.order ?? 99) - (GROUP_META[b.label]?.order ?? 99)
      );
  }, [availability]);


  const q = query.trim().toLowerCase();

  // Filter groups by query
  const filteredGroups = useMemo(() => {
    if (!q) return sortedGroups;
    return sortedGroups
      .map((g) => ({ ...g, models: g.models.filter((m) => m.label.toLowerCase().includes(q)) }))
      .filter((g) => g.models.length > 0);
  }, [sortedGroups, q]);

  // Flat sorted list for non-recommended sort modes
  const flatSorted = useMemo<(ModelOption & { provider: string })[]>(() => {
    if (sort === "recommended") return [];
    const all = filteredGroups.flatMap((g) =>
      g.models.map((m) => ({ ...m, provider: GROUP_META[g.label]?.short ?? g.label }))
    );
    const dim = sort as "quality" | "speed" | "price";
    return all.sort((a, b) => rankOf(a.value, dim) - rankOf(b.value, dim));
  }, [filteredGroups, sort]);

  return (
    <div data-tour="model-picker" className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-5 space-y-3 shadow-md">
      <div className="flex items-center gap-2">
        <Sparkles className={cn("w-4 h-4 text-primary", flash && "animate-pulse")} />
        <Label className="text-base font-normal text-foreground font-display">{t("modelPicker.title" as any)}</Label>
      </div>
      <Select value={model} onValueChange={onModelChange} open={open} onOpenChange={setOpen}>
        <SelectTrigger
          className={cn(
            "bg-secondary border-border min-h-[4rem] sm:min-h-[3.75rem] h-auto py-3 px-3.5 sm:py-2.5 text-base font-display text-start [&>span]:line-clamp-none [&>span]:w-full transition-shadow",
            flash && open && "ring-2 ring-primary/40"
          )}
        >
          <SelectValue placeholder={t("config.chooseModel")} />
        </SelectTrigger>
        <SelectContent
          side="bottom"
          align="start"
          collisionPadding={12}
          position="popper"
          sideOffset={6}
          className="model-picker-content w-[var(--radix-select-trigger-width)] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-1.5rem)] overscroll-contain p-0 relative [&_[role=option]>span:first-child]:hidden [&_[role=option]]:ps-3"
          style={{
            zIndex: 1000,
            maxHeight: 480,
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 12,
            boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
          }}
        >
          {/* Search + sort */}
          <div className="sticky top-0 z-20 bg-popover border-b border-border/60 px-4 py-3">
            <div className="relative border-b border-border/60">
              <Search size={14} className="absolute left-1 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Search models..."
                className="w-full bg-transparent text-sm ps-7 pe-2 py-2 outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="mt-3 flex items-center gap-4">
              {SORT_OPTIONS.map((opt) => {
                const active = sort === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSort(opt.id); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className={cn(
                      "text-[12px] font-medium transition-colors duration-150 pb-0.5 border-b",
                      active
                        ? "text-foreground border-primary"
                        : "text-muted-foreground border-transparent hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>


          <div
            style={{
              maxHeight: 480 - 132,
              overflowY: "auto",
              scrollbarColor: "hsl(var(--muted-foreground) / 0.3) transparent",
              scrollbarWidth: "thin",
            }}
          >
            {!q && (
              <>
                <ModelRow
                  value="any"
                  label={t("config.anyModel")}
                  description={t("models.desc.any" as any)}
                  isAny
                />
                <SelectSeparator />
              </>
            )}

            {sort === "recommended" ? (
              filteredGroups.map((group) => {
                const meta = GROUP_META[group.label];
                return (
                  <SelectGroup key={group.label}>
                    <SelectLabel className="px-4 pt-5 pb-2 border-t border-border/40">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.14em]">
                        {meta?.short ?? group.label}
                      </div>
                    </SelectLabel>
                    {group.models.map((m) => (
                      <ModelRow
                        key={m.value}
                        value={m.value}
                        label={m.label}
                        description={t(m.descriptionKey as any)}
                        hasAudio={m.audio}
                      />
                    ))}
                  </SelectGroup>
                );
              })
            ) : (
              flatSorted.map((m) => (
                <ModelRow
                  key={m.value}
                  value={m.value}
                  label={m.label}
                  description={t(m.descriptionKey as any)}
                  providerLabel={m.provider}
                  hasAudio={m.audio}
                />
              ))
            )}

            {((sort === "recommended" && filteredGroups.length === 0) ||
              (sort !== "recommended" && flatSorted.length === 0)) && (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                No models match "{query}"
              </div>
            )}
          </div>

          {/* Gradient fade indicating scroll */}
          <div
            className="pointer-events-none absolute left-0 right-0 bottom-0 rounded-b-xl"
            style={{
              height: 40,
              background: "linear-gradient(to bottom, transparent, hsl(var(--popover)) 100%)",
            }}
          />
        </SelectContent>
      </Select>
      {variantDesc && !open && (
        <p className="text-xs text-muted-foreground/80 italic">{variantDesc}</p>
      )}
    </div>
  );
};
