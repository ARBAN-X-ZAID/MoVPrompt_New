import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import type { Preset } from "@/lib/presets";
import { getPresetVideoUrl } from "@/lib/presets";

interface PresetCardProps {
  preset: Preset;
  selected: boolean;
  onToggle: (preset: Preset) => void;
}

export const PresetCard = ({ preset, selected, onToggle }: PresetCardProps) => {
  const Icon = preset.icon;
  const videoUrl = getPresetVideoUrl(preset.id);
  const [videoFailed, setVideoFailed] = useState(false);
  const cardVideoRef = useRef<HTMLVideoElement>(null);
  const showVideo = videoUrl && !videoFailed;

  const handleEnter = () => {
    cardVideoRef.current?.play().catch(() => {});
  };
  const handleLeave = () => {
    const v = cardVideoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
  };

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={() => onToggle(preset)}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          className={cn(
            "group preset-card relative flex flex-col items-stretch overflow-hidden rounded-lg border bg-secondary/40 text-start transition-all",
            "hover:border-primary hover:bg-secondary hover:shadow-[0_0_18px_-4px_hsl(var(--primary)/0.5)]",
            selected
              ? "border-primary bg-primary/10 shadow-[0_0_18px_-4px_hsl(var(--primary)/0.6)]"
              : "border-border/50",
          )}
        >
          <div className="relative flex h-16 items-center justify-center bg-gradient-to-b from-background/60 to-secondary/60 overflow-hidden">
            {showVideo && (
              <video
                ref={cardVideoRef}
                src={videoUrl}
                muted
                loop
                playsInline
                preload="metadata"
                onError={() => setVideoFailed(true)}
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <Icon
              size={28}
              className={cn(
                "relative text-primary/80 transition-colors group-hover:text-primary",
                preset.animation && `preset-anim ${preset.animation}`,
                showVideo && "opacity-0",
              )}
            />
            {selected && (
              <span className="absolute top-1 end-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check size={10} strokeWidth={3} />
              </span>
            )}
          </div>
          <div className="px-2 py-1.5 border-t border-border/40">
            <p className="text-[11px] font-medium leading-tight text-foreground/90 truncate">
              {preset.label}
            </p>
          </div>
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-80 p-0 overflow-hidden">
        <div className="relative flex h-44 items-center justify-center bg-gradient-to-b from-background to-secondary border-b border-border/40 overflow-hidden">
          {showVideo ? (
            <video
              src={videoUrl}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              onError={() => setVideoFailed(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <Icon size={64} className={cn("text-primary", preset.animation && `preset-anim ${preset.animation}`)} />
          )}
        </div>
        <div className="p-3 space-y-1.5">
          <p className="text-sm font-semibold text-foreground">{preset.label}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{preset.description}</p>
          <p className="text-[11px] text-primary/80 pt-1">
            <span className="text-muted-foreground/70">Best for: </span>
            {preset.bestFor}
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
