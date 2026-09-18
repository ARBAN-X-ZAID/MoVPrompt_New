import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ScanSearch, Lightbulb, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface AnalyzingSkeletonProps {
  framePreviews?: (string | null)[];
  onCancel?: () => void;
}

const CHECKLIST_KEYS = [
  "analyzing.checklist.read",
  "analyzing.checklist.detect",
  "analyzing.checklist.compose",
  "analyzing.checklist.light",
  "analyzing.checklist.draft",
] as const;

// Cinematography quote library — rotates every 6s with fade transition.
const TIPS = [
  "Continuity is the invisible craft — viewers only notice when it breaks.",
  "The 180-degree rule keeps your audience oriented in the scene.",
  "Light shapes mood. Shadow shapes story.",
  "A tripod is patience. A handheld is urgency. Choose your camera's posture intentionally.",
  "Wide for context. Medium for action. Close for emotion.",
];

const STEP_INTERVAL_MS = 1400;
const TIP_INTERVAL_MS = 6000;

export const AnalyzingSkeleton = ({ framePreviews = [], onCancel }: AnalyzingSkeletonProps) => {
  const { t } = useLanguage();
  const [completedCount, setCompletedCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);
  const [activeFrame, setActiveFrame] = useState(0);

  const frames = useMemo(
    () => framePreviews.filter((p): p is string => Boolean(p)),
    [framePreviews],
  );

  const startTipIdx = useMemo(() => Math.floor(Math.random() * TIPS.length), []);
  useEffect(() => setTipIdx(startTipIdx), [startTipIdx]);

  useEffect(() => {
    const id = setInterval(() => {
      setCompletedCount((c) => Math.min(c + 1, CHECKLIST_KEYS.length - 1));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setTipIdx((i) => (i + 1) % TIPS.length);
    }, TIP_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (frames.length <= 1) return;
    const id = setInterval(() => {
      setActiveFrame((i) => (i + 1) % frames.length);
    }, 1100);
    return () => clearInterval(id);
  }, [frames.length]);

  useEffect(() => {
    const start = performance.now();
    const duration = 8000;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(eased * 92);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const renderChecklistLine = (key: string, idx: number) => {
    const done = idx < completedCount;
    const active = idx === completedCount;
    return (
      <motion.li
        key={key}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: done || active ? 1 : 0.35, x: 0 }}
        transition={{ duration: 0.35, delay: idx * 0.05 }}
        className="flex items-center gap-2.5 text-sm"
      >
        <span className="relative flex items-center justify-center shrink-0" style={{ width: 18, height: 18 }}>
          {done ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
              className="flex items-center justify-center rounded-full"
              style={{
                width: 18,
                height: 18,
                backgroundColor: "hsl(38 91% 55% / 0.18)",
                border: "1px solid hsl(38 91% 55% / 0.5)",
              }}
            >
              <Check style={{ width: 11, height: 11, color: "hsl(38 91% 60%)" }} strokeWidth={3} />
            </motion.span>
          ) : active ? (
            <span className="relative">
              <span
                className="absolute inset-0 rounded-full animate-ping"
                style={{ backgroundColor: "hsl(38 91% 55% / 0.4)" }}
              />
              <span
                className="relative block rounded-full"
                style={{
                  width: 10,
                  height: 10,
                  backgroundColor: "hsl(38 91% 55%)",
                  boxShadow: "0 0 8px hsl(38 91% 55% / 0.8)",
                }}
              />
            </span>
          ) : (
            <span
              className="block rounded-full"
              style={{ width: 8, height: 8, backgroundColor: "hsl(0 0% 100% / 0.12)" }}
            />
          )}
        </span>
        <span
          className="font-display"
          style={{
            color: done ? "hsl(0 0% 95%)" : active ? "hsl(38 91% 65%)" : "hsl(0 0% 60%)",
            fontWeight: active ? 500 : 400,
            letterSpacing: "-0.01em",
          }}
        >
          {t(key as any)}
        </span>
      </motion.li>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-4"
    >
      <Card
        className="relative overflow-hidden border-border/60"
        style={{
          background:
            "linear-gradient(135deg, hsl(38 91% 55% / 0.06) 0%, hsl(220 25% 8%) 50%, hsl(35 90% 55% / 0.05) 100%)",
        }}
      >
        {/* Soft amber perimeter glow — replaces the horizontal scan line */}
        <div
          className="pointer-events-none absolute inset-0 rounded-lg"
          style={{
            boxShadow: "inset 0 0 60px hsl(38 91% 55% / 0.18)",
            animation: "perimeter-breath 2.4s ease-in-out infinite",
          }}
        />
        <CardContent className="relative pt-5 pb-5 space-y-4">
          <div className="flex items-center gap-3">
            <div
              className="relative shrink-0 flex items-center justify-center rounded-md"
              style={{
                width: 40,
                height: 40,
                backgroundColor: "hsl(38 91% 55% / 0.12)",
                border: "1px solid hsl(38 91% 55% / 0.3)",
              }}
            >
              <motion.div
                animate={{ rotate: [0, 8, -8, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <ScanSearch style={{ width: 22, height: 22, color: "hsl(38 91% 60%)" }} />
              </motion.div>
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="font-display text-base sm:text-lg font-semibold flex items-center gap-1"
                style={{ color: "hsl(0 0% 98%)", letterSpacing: "-0.02em" }}
              >
                <span>{t("analyzing.title" as any)}</span>
                <span
                  className="inline-block animate-pulse"
                  style={{
                    width: 2,
                    height: "1em",
                    backgroundColor: "hsl(38 91% 60%)",
                    transform: "translateY(2px)",
                  }}
                />
              </div>
              <div className="text-xs sm:text-sm" style={{ color: "hsl(0 0% 65%)" }}>
                {t("analyzing.subtitle" as any)}
              </div>
            </div>
            <div
              className="shrink-0 font-mono tabular-nums text-sm font-semibold"
              style={{ color: "hsl(38 91% 60%)" }}
            >
              {Math.round(progress)}%
            </div>
          </div>

          {/* Frame strip — refined: subject-area amber spotlight on active frame */}
          {frames.length > 0 && (
            <div className="flex gap-2">
              {frames.map((src, i) => {
                const isActive = i === activeFrame;
                return (
                  <div
                    key={i}
                    className="relative flex-1 overflow-hidden rounded-md"
                    style={{
                      aspectRatio: "16 / 9",
                      border: isActive
                        ? "1px solid hsl(38 91% 55% / 0.7)"
                        : "1px solid hsl(0 0% 100% / 0.08)",
                      boxShadow: isActive ? "0 0 12px hsl(38 91% 55% / 0.35)" : "none",
                      transition: "border-color 0.3s, box-shadow 0.3s",
                    }}
                  >
                    <img
                      src={src}
                      alt=""
                      className="w-full h-full object-cover"
                      style={{ opacity: isActive ? 1 : 0.55, transition: "opacity 0.3s" }}
                    />
                    {isActive && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background:
                            "radial-gradient(circle at 50% 50%, hsl(38 91% 55% / 0.18) 0%, transparent 55%)",
                          animation: "spotlight-pulse 1.6s ease-in-out infinite",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Progress bar — 4px, amber fill with shimmer, percentage already in header */}
          <div className="space-y-1.5">
            <div
              className="relative w-full rounded-full overflow-hidden"
              style={{ height: 4, backgroundColor: "#27272A" }}
            >
              <div
                className="h-full transition-[width] duration-200 ease-out rounded-full relative overflow-hidden"
                style={{
                  width: `${progress}%`,
                  backgroundColor: "#F5A524",
                  boxShadow: "0 0 10px hsl(38 91% 55% / 0.7), inset 0 0 4px hsl(38 91% 75% / 0.6)",
                }}
              >
                <div
                  className="absolute inset-y-0 w-1/3 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.55), transparent)",
                    animation: "shimmer-sweep 1.5s linear infinite",
                  }}
                />
              </div>
            </div>
            <div className="text-[11px] font-mono" style={{ color: "#71717A" }}>
              Usually takes 15–30 seconds
            </div>
          </div>

          <ul className="space-y-2 pt-1">
            {CHECKLIST_KEYS.map((k, i) => renderChecklistLine(k, i))}
          </ul>

          {onCancel && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                style={{ fontSize: 13, color: "#71717A" }}
              >
                <X size={13} /> Cancel
              </button>
            </div>
          )}
        </CardContent>

        <style>{`
          @keyframes shimmer-sweep {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(400%); }
          }
          @keyframes perimeter-breath {
            0%, 100% { box-shadow: inset 0 0 40px hsl(38 91% 55% / 0.10); }
            50% { box-shadow: inset 0 0 70px hsl(38 91% 55% / 0.28); }
          }
          @keyframes spotlight-pulse {
            0%, 100% { opacity: 0.55; }
            50% { opacity: 1; }
          }
        `}</style>
      </Card>

      {/* "While you wait" — callout-styled tip with rotating cinematography quotes */}
      <Card
        className="border-border overflow-hidden"
        style={{
          background:
            "linear-gradient(90deg, hsl(38 91% 55% / 0.06) 0%, #161618 35%)",
          borderLeft: "2px solid #F5A524",
        }}
      >
        <CardContent className="py-4 px-4">
          <div className="flex items-start gap-2.5">
            <Lightbulb className="shrink-0 mt-1" style={{ width: 14, height: 14, color: "hsl(35 90% 60%)" }} />
            <div className="flex-1 min-w-0">
              <div
                className="text-[10px] uppercase tracking-wider font-display mb-2"
                style={{ color: "hsl(35 90% 60%)", letterSpacing: "0.1em" }}
              >
                While you wait
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={tipIdx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.4 }}
                >
                  <p
                    className="font-display"
                    style={{ fontSize: 16, color: "hsl(0 0% 98%)", lineHeight: 1.45 }}
                  >
                    “{TIPS[tipIdx]}”
                  </p>
                  <p
                    className="mt-2 text-[11px]"
                    style={{ color: "hsl(0 0% 55%)", letterSpacing: "0.02em" }}
                  >
                    — MovPrompt cinematography library
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
