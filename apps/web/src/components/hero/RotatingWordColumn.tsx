import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

const WORDS = [
  "Build ad templates",
  "Generate video concepts",
  "Shoot campaigns",
  "Stay on brand",
  "Lock the look",
  "Scale ads",
  "Storyboard shots",
  "Match any model",
  "Export to Ads",
];

const ITEM_HEIGHT = 72; // px per word
const INTERVAL = 1800;
const TRANSITION_MS = 900;

// Duplicate list so there's always a word above and below the marker.
const LOOP = [...WORDS, ...WORDS];

export const RotatingWordColumn = () => {
  const [active, setActive] = useState(0);
  const [animate, setAnimate] = useState(true);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setAnimate(true);
      setActive((i) => i + 1);
    }, INTERVAL);
    return () => window.clearInterval(id);
  }, []);

  // After we've animated past the first copy, snap back by WORDS.length
  // with the transition disabled — visually identical because the list is duplicated.
  useEffect(() => {
    if (active < WORDS.length) return;
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => {
      setAnimate(false);
      setActive((i) => i - WORDS.length);
      // Re-enable transitions on the next frame.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimate(true));
      });
    }, TRANSITION_MS + 20);
    return () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
    };
  }, [active]);

  const activeMod = ((active % WORDS.length) + WORDS.length) % WORDS.length;

  return (
    <div
      className="relative h-[504px] overflow-hidden select-none pointer-events-none"
      style={{
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)",
      }}
    >
      {/* Pink play marker pinned at vertical center */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex items-center">
        <Play
          className="w-4 h-4 fill-[hsl(var(--magnific-accent))] text-[hsl(var(--magnific-accent))]"
          strokeWidth={0}
        />
      </div>

      <div
        className="absolute left-8 right-0"
        style={{
          top: "50%",
          transform: `translateY(calc(-50% - ${active * ITEM_HEIGHT}px + ${ITEM_HEIGHT / 2}px))`,
          transition: animate
            ? `transform ${TRANSITION_MS}ms cubic-bezier(0.65,0,0.35,1)`
            : "none",
        }}
      >
        {LOOP.map((w, i) => {
          const isActive = i % WORDS.length === activeMod && i === active;
          return (
            <div
              key={`${w}-${i}`}
              className="flex items-center"
              style={{ height: ITEM_HEIGHT }}
            >
              <span
                className={`font-magnific text-[44px] leading-none tracking-tight transition-all duration-500 ${
                  isActive
                    ? "text-white opacity-100"
                    : "text-white/25 opacity-60"
                }`}
                style={{
                  transform: isActive ? "translateX(0)" : "translateX(-4px)",
                }}
              >
                {w}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
