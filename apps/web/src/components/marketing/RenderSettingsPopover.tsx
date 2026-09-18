import { useState } from "react";
import { Sliders, Square, Gem, Clock, Type, Tag, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type OverlayMode = "none" | "endcard" | "lower_third" | "corner" | "center";

export type RenderSettings = {
  aspect_ratio: string;
  resolution: string;
  duration: number;
  overlay_mode: OverlayMode;
  overlay_logo: boolean;
  overlay_text?: { headline?: string; cta?: string; price?: string };
};

export const RENDER_DEFAULTS: RenderSettings = {
  aspect_ratio: "9:16",
  resolution: "1080p",
  duration: 5,
  overlay_mode: "endcard",
  overlay_logo: true,
  overlay_text: {},
};

const ASPECTS = ["9:16", "16:9", "1:1", "4:3", "3:4", "21:9"];
const QUALITIES = ["480p", "720p", "1080p"];
const DURATIONS = [5, 8, 10, 15];
const OVERLAY_MODES: { id: OverlayMode; label: string }[] = [
  { id: "none", label: "None" },
  { id: "endcard", label: "End-card" },
  { id: "lower_third", label: "Lower-third" },
  { id: "corner", label: "Corner" },
  { id: "center", label: "Center" },
];
const OVERLAY_LABELS: Record<OverlayMode, string> = {
  none: "None",
  endcard: "End-card",
  lower_third: "Lower-third",
  corner: "Corner",
  center: "Center",
};

type Section = "aspect" | "quality" | "duration" | "overlay" | "text" | null;

function Row({
  icon,
  label,
  value,
  active,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl transition-colors",
        active
          ? "bg-[#F5A524]/10 ring-1 ring-inset ring-[#F5A524]/40"
          : "hover:bg-white/[0.04]",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-3 px-2.5 h-11 text-sm rounded-xl"
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-foreground/90 font-medium">{label}</span>
        <span className="ml-auto flex items-center gap-1 text-foreground/80 tabular-nums">
          {value}
          <ChevronRight
            className={cn(
              "w-3.5 h-3.5 text-muted-foreground transition-transform",
              active && "rotate-90",
            )}
          />
        </span>
      </button>
      {active && (
        <div className="px-2.5 pb-2.5 pt-1 flex flex-wrap gap-1.5">{children}</div>
      )}
    </div>
  );
}

function Pill({
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
        "px-3 h-8 text-xs rounded-lg border transition-colors",
        active
          ? "bg-[#F5A524]/15 text-[#F5A524] border-[#F5A524]/40"
          : "bg-background/40 text-muted-foreground border-border/50 hover:text-foreground hover:border-border",
      )}
    >
      {children}
    </button>
  );
}

function TextField({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-8 px-2.5 text-xs rounded-lg bg-background/40 border border-border/50 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-[#F5A524]/40 focus:bg-background/60"
    />
  );
}

export function RenderSettingsPopover({
  value,
  onChange,
}: {
  value: RenderSettings;
  onChange: (v: RenderSettings) => void;
}) {
  const [section, setSection] = useState<Section>("duration");
  const customized =
    value.aspect_ratio !== RENDER_DEFAULTS.aspect_ratio ||
    value.resolution !== RENDER_DEFAULTS.resolution ||
    value.duration !== RENDER_DEFAULTS.duration ||
    value.overlay_mode !== RENDER_DEFAULTS.overlay_mode ||
    value.overlay_logo !== RENDER_DEFAULTS.overlay_logo ||
    !!(value.overlay_text?.headline || value.overlay_text?.cta || value.overlay_text?.price);

  const toggle = (s: Section) => setSection((curr) => (curr === s ? null : s));
  const overlayOff = value.overlay_mode === "none";
  const text = value.overlay_text ?? {};
  const setText = (patch: Partial<NonNullable<RenderSettings["overlay_text"]>>) =>
    onChange({ ...value, overlay_text: { ...text, ...patch } });

  const overlaySummary = overlayOff
    ? "Clean"
    : `${OVERLAY_LABELS[value.overlay_mode]}${value.overlay_logo ? " · logo" : ""}`;
  const textCount = [text.headline, text.cta, text.price].filter((s) => s && s.trim()).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Render settings"
          className={cn(
            "w-9 h-9 rounded-full border flex items-center justify-center bg-secondary/40 transition-colors",
            customized
              ? "border-[#F5A524]/50 text-[#F5A524] hover:border-[#F5A524]"
              : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
          )}
        >
          <Sliders className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[320px] p-2 rounded-2xl border-border/60 bg-[hsl(240_6%_7%)]/95 backdrop-blur-xl shadow-2xl shadow-black/50"
      >
        <div className="px-2 pt-1 pb-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-semibold">
            Render settings
          </span>
        </div>
        <div className="space-y-1">
        <Row
          icon={<Square className="w-4 h-4" />}
          label="Aspect ratio"
          value={value.aspect_ratio}
          active={section === "aspect"}
          onClick={() => toggle("aspect")}
        >
          {ASPECTS.map((a) => (
            <Pill
              key={a}
              active={value.aspect_ratio === a}
              onClick={() => onChange({ ...value, aspect_ratio: a })}
            >
              {a}
            </Pill>
          ))}
        </Row>
        <Row
          icon={<Gem className="w-4 h-4" />}
          label="Quality"
          value={value.resolution}
          active={section === "quality"}
          onClick={() => toggle("quality")}
        >
          {QUALITIES.map((q) => (
            <Pill
              key={q}
              active={value.resolution === q}
              onClick={() => onChange({ ...value, resolution: q })}
            >
              {q}
            </Pill>
          ))}
        </Row>
        <Row
          icon={<Clock className="w-4 h-4" />}
          label="Duration"
          value={`${value.duration}s`}
          active={section === "duration"}
          onClick={() => toggle("duration")}
        >
          {DURATIONS.map((d) => (
            <Pill
              key={d}
              active={value.duration === d}
              onClick={() => onChange({ ...value, duration: d })}
            >
              {d}s
            </Pill>
          ))}
        </Row>
        <Row
          icon={<Tag className="w-4 h-4" />}
          label="Overlay"
          value={overlaySummary}
          active={section === "overlay"}
          onClick={() => toggle("overlay")}
        >
          <div className="w-full flex flex-wrap gap-1.5">
            {OVERLAY_MODES.map((m) => (
              <Pill
                key={m.id}
                active={value.overlay_mode === m.id}
                onClick={() => onChange({ ...value, overlay_mode: m.id })}
              >
                {m.label}
              </Pill>
            ))}
          </div>
          {!overlayOff && (
            <div className="w-full mt-2 flex items-center justify-between gap-2 px-1">
              <span className="text-[11px] text-muted-foreground">Brand logo</span>
              <div className="flex gap-1.5">
                <Pill
                  active={value.overlay_logo}
                  onClick={() => onChange({ ...value, overlay_logo: true })}
                >
                  On
                </Pill>
                <Pill
                  active={!value.overlay_logo}
                  onClick={() => onChange({ ...value, overlay_logo: false })}
                >
                  Off
                </Pill>
              </div>
            </div>
          )}
        </Row>
        {!overlayOff && (
          <Row
            icon={<Type className="w-4 h-4" />}
            label="Text"
            value={textCount > 0 ? `${textCount} set` : "None"}
            active={section === "text"}
            onClick={() => toggle("text")}
          >
            <div className="w-full space-y-1.5">
              <TextField
                placeholder="Headline (e.g. Made for the bold)"
                value={text.headline ?? ""}
                onChange={(v) => setText({ headline: v })}
              />
              <TextField
                placeholder="CTA (e.g. Shop now)"
                value={text.cta ?? ""}
                onChange={(v) => setText({ cta: v })}
              />
              <TextField
                placeholder="Price / offer (e.g. -20%)"
                value={text.price ?? ""}
                onChange={(v) => setText({ price: v })}
              />
            </div>
          </Row>
        )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
