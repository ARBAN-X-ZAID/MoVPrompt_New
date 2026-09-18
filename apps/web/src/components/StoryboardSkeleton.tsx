import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Clapperboard, Camera, Lightbulb } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface StoryboardSkeletonProps {
  shotCount: number;
  modelLabel?: string;
}

const STATUS_KEYS = [
  "storyboard.status.compose",
  "storyboard.status.light",
  "storyboard.status.frame",
  "storyboard.status.lock",
] as const;

const TRIVIA_KEYS = [
  "storyboard.trivia.shotlist",
  "storyboard.trivia.coverage",
  "storyboard.trivia.axis",
  "storyboard.trivia.montage",
] as const;

const SHOT_INTERVAL_MS = 1800;
const STATUS_INTERVAL_MS = 450;
const TRIVIA_INTERVAL_MS = 4500;
const PROGRESS_DURATION_MS = 14000;

export const StoryboardSkeleton = ({ shotCount, modelLabel }: StoryboardSkeletonProps) => {
  const { t } = useLanguage();
  const safeCount = Math.max(2, Math.min(10, shotCount));
  const [activeIdx, setActiveIdx] = useState(0);
  const [statusIdx, setStatusIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [triviaIdx, setTriviaIdx] = useState(0);
  const [clap, setClap] = useState(false);

  const startTriviaIdx = useMemo(() => Math.floor(Math.random() * TRIVIA_KEYS.length), []);
  useEffect(() => setTriviaIdx(startTriviaIdx), [startTriviaIdx]);

  // Advance shot, leaving the last one perpetually "active" (polishing)
  useEffect(() => {
    const id = setInterval(() => {
      setActiveIdx((i) => Math.min(i + 1, safeCount - 1));
    }, SHOT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [safeCount]);

  useEffect(() => {
    const id = setInterval(() => {
      setStatusIdx((i) => (i + 1) % STATUS_KEYS.length);
    }, STATUS_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setTriviaIdx((i) => (i + 1) % TRIVIA_KEYS.length);
    }, TRIVIA_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setClap(true);
      const t = setTimeout(() => setClap(false), 220);
      return () => clearTimeout(t);
    }, 2400);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / PROGRESS_DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(eased * 92);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const titleText = (t("storyboard.title" as any) as string).replace("{count}", String(safeCount));
  const subtitleText = (t("storyboard.subtitle" as any) as string).replace(
    "{model}",
    modelLabel || "your model",
  );

  const renderShotTile = (idx: number) => {
    const done = idx < activeIdx;
    const active = idx === activeIdx;
    const tileFill = active ? 35 + Math.sin(Date.now() / 200) * 5 : done ? 100 : 0;
    return (
      <motion.div
        key={idx}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: idx * 0.04 }}
        className="relative overflow-hidden rounded-lg"
        style={{
          aspectRatio: "16 / 9",
          background:
            "linear-gradient(135deg, hsl(220 25% 9%) 0%, hsl(220 25% 6%) 100%)",
          border: active
            ? "1px solid hsl(35 90% 55% / 0.7)"
            : done
              ? "1px solid hsl(35 90% 50% / 0.45)"
              : "1px dashed hsl(0 0% 100% / 0.12)",
          boxShadow: active ? "0 0 14px hsl(35 90% 50% / 0.35)" : "none",
          transition: "border-color 0.3s, box-shadow 0.3s",
        }}
      >
        {/* film-grain overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, hsl(35 90% 80%) 0px, hsl(35 90% 80%) 1px, transparent 1px, transparent 3px)",
          }}
        />

        {/* Shot label */}
        <div
          className="absolute top-1.5 left-2 font-display text-[10px] uppercase tracking-wider"
          style={{
            color: done || active ? "hsl(35 90% 70%)" : "hsl(0 0% 50%)",
            letterSpacing: "0.1em",
          }}
        >
          {(t("storyboard.shotLabel" as any) as string).replace("{n}", String(idx + 1))}
        </div>

        {/* Done badge */}
        {done && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="absolute top-1.5 right-1.5 flex items-center justify-center rounded-full"
            style={{
              width: 18,
              height: 18,
              backgroundColor: "hsl(35 90% 50% / 0.22)",
              border: "1px solid hsl(35 90% 50% / 0.6)",
            }}
          >
            <Check style={{ width: 11, height: 11, color: "hsl(35 90% 65%)" }} strokeWidth={3} />
          </motion.div>
        )}

        {/* Centered icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          {active ? (
            <motion.div
              animate={{ x: [-8, 8, -8] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <Camera
                style={{
                  width: 26,
                  height: 26,
                  color: "hsl(35 90% 60%)",
                  filter: "drop-shadow(0 0 6px hsl(35 90% 50% / 0.6))",
                }}
              />
            </motion.div>
          ) : (
            <Camera
              style={{
                width: 22,
                height: 22,
                color: done ? "hsl(35 90% 55%)" : "hsl(0 0% 100% / 0.18)",
              }}
            />
          )}
        </div>

        {/* Status line */}
        <div
          className="absolute bottom-4 left-2 right-2 text-[10px] font-display truncate"
          style={{
            color: done
              ? "hsl(35 90% 70%)"
              : active
                ? "hsl(0 0% 92%)"
                : "hsl(0 0% 40%)",
          }}
        >
          {done
            ? t("storyboard.status.locked" as any)
            : active
              ? t(STATUS_KEYS[statusIdx] as any)
              : "—"}
        </div>

        {/* Mini progress */}
        <div
          className="absolute bottom-1.5 left-2 right-2 h-[3px] rounded-full overflow-hidden"
          style={{ backgroundColor: "hsl(0 0% 100% / 0.06)" }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{
              width: done ? "100%" : active ? `${tileFill}%` : "0%",
              background: done
                ? "hsl(35 90% 55%)"
                : "linear-gradient(90deg, hsl(35 90% 50%), hsl(35 90% 55%))",
              boxShadow: active ? "0 0 6px hsl(35 90% 50% / 0.6)" : "none",
            }}
          />
          {active && (
            <div
              className="relative -mt-[3px] h-[3px] w-1/3 pointer-events-none"
              style={{
                background:
                  "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.5), transparent)",
                animation: "shimmer-sweep 1.4s linear infinite",
              }}
            />
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-4"
    >
      {/* Director header */}
      <Card
        className="relative overflow-hidden border-border/60"
        style={{
          background:
            "linear-gradient(135deg, hsl(35 90% 50% / 0.06) 0%, hsl(220 25% 8%) 50%, hsl(35 90% 55% / 0.05) 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, hsl(35 90% 80%) 0px, hsl(35 90% 80%) 1px, transparent 1px, transparent 3px)",
          }}
        />
        <CardContent className="relative pt-5 pb-5 space-y-4">
          <div className="flex items-center gap-3">
            <div
              className="relative shrink-0 flex items-center justify-center rounded-md"
              style={{
                width: 40,
                height: 40,
                backgroundColor: "hsl(35 90% 50% / 0.12)",
                border: "1px solid hsl(35 90% 50% / 0.3)",
              }}
            >
              <motion.div
                animate={{ rotate: clap ? -18 : 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                style={{ originX: 0.1, originY: 0.9 }}
              >
                <Clapperboard style={{ width: 22, height: 22, color: "hsl(35 90% 60%)" }} />
              </motion.div>
              <motion.span
                aria-hidden
                animate={{ opacity: clap ? 1 : 0, scale: clap ? 1.4 : 0.8 }}
                transition={{ duration: 0.25 }}
                className="absolute -top-1 -right-1 rounded-full"
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: "hsl(35 90% 55%)",
                  boxShadow: "0 0 8px hsl(35 90% 55% / 0.9)",
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="font-display text-base sm:text-lg font-semibold flex items-center gap-1"
                style={{ color: "hsl(0 0% 98%)", letterSpacing: "-0.02em" }}
              >
                <span className="truncate">{titleText}</span>
                <span
                  className="inline-block animate-pulse shrink-0"
                  style={{
                    width: 2,
                    height: "1em",
                    backgroundColor: "hsl(35 90% 60%)",
                    transform: "translateY(2px)",
                  }}
                />
              </div>
              <div className="text-xs sm:text-sm truncate" style={{ color: "hsl(0 0% 65%)" }}>
                {subtitleText}
              </div>
            </div>
            <div
              className="shrink-0 font-mono tabular-nums text-xs"
              style={{ color: "hsl(35 90% 65%)" }}
            >
              {Math.min(activeIdx + 1, safeCount)} / {safeCount}
            </div>
          </div>

          {/* Shimmer progress bar */}
          <div
            className="relative h-[6px] w-full rounded-full overflow-hidden"
            style={{ backgroundColor: "hsl(0 0% 100% / 0.06)" }}
          >
            <div
              className="h-full transition-[width] duration-200 ease-out rounded-full"
              style={{
                width: `${progress}%`,
                background:
                  "linear-gradient(90deg, hsl(35 90% 50%) 0%, hsl(35 90% 65%) 50%, hsl(35 90% 55%) 100%)",
                boxShadow: "0 0 10px hsl(35 90% 50% / 0.6)",
              }}
            />
            <div
              className="absolute inset-y-0 w-1/3 pointer-events-none"
              style={{
                background:
                  "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.35), transparent)",
                animation: "shimmer-sweep 1.6s linear infinite",
              }}
            />
          </div>

          {/* Storyboard grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
            {Array.from({ length: safeCount }).map((_, i) => renderShotTile(i))}
          </div>
        </CardContent>

        <style>{`
          @keyframes shimmer-sweep {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(400%); }
          }
        `}</style>
      </Card>

      {/* Trivia card */}
      <Card className="border-border/50" style={{ backgroundColor: "hsl(220 25% 7% / 0.6)" }}>
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-2.5">
            <Lightbulb className="shrink-0 mt-0.5" style={{ width: 14, height: 14, color: "hsl(35 90% 60%)" }} />
            <div className="flex-1 min-w-0">
              <div
                className="text-[10px] uppercase tracking-wider font-display mb-1"
                style={{ color: "hsl(35 90% 60%)", letterSpacing: "0.1em" }}
              >
                {t("storyboard.triviaLabel" as any)}
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={triviaIdx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.4 }}
                  className="text-xs sm:text-sm italic"
                  style={{ color: "hsl(0 0% 80%)", lineHeight: 1.5 }}
                >
                  {t(TRIVIA_KEYS[triviaIdx] as any)}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
