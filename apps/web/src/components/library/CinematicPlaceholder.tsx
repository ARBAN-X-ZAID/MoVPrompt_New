import { Film, Image as ImageIcon, Layers } from "lucide-react";
import { ModelFamily, FAMILY_META, topKeywords } from "@/lib/modelFamily";

const WORKFLOW_ICON: Record<string, typeof Film> = {
  single: ImageIcon,
  twoframe: Layers,
  multishot: Film,
};

interface Props {
  family: ModelFamily;
  workflow: string;
  prompt: string;
  /** Stable seed (e.g. entry id) used to vary gradient angle/intensity per card. */
  seed?: string;
  className?: string;
}

const ANGLES = ["bg-gradient-to-br", "bg-gradient-to-tr", "bg-gradient-to-r", "bg-gradient-to-b"];

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function CinematicPlaceholder({ family, workflow, prompt, seed = "", className = "" }: Props) {
  const meta = FAMILY_META[family];
  const Icon = WORKFLOW_ICON[workflow] || Film;
  const keywords = topKeywords(prompt, 3);
  const h = hashSeed(seed || prompt || family);
  const angle = ANGLES[h % ANGLES.length];
  const intensityShift = (h % 3) * 0.06;

  return (
    <div
      className={`relative w-full h-full overflow-hidden ${angle} ${meta.gradient} ${className}`}
      style={{ filter: `brightness(${1 + intensityShift}) saturate(${1 + intensityShift})` }}
    >
      {/* film grain */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.18] mix-blend-overlay pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>

      {/* radial vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_rgba(0,0,0,0.55)_100%)]" />

      {/* center workflow icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon className={`w-14 h-14 ${meta.accent} opacity-30`} strokeWidth={1.25} />
      </div>

      {/* keywords overlay */}
      {keywords.length > 0 && (
        <div className="absolute inset-x-0 bottom-3 px-3 flex flex-wrap gap-1.5 justify-center">
          {keywords.map((k) => (
            <span
              key={k}
              className="text-[9px] uppercase tracking-[0.18em] font-mono text-white/40"
            >
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
