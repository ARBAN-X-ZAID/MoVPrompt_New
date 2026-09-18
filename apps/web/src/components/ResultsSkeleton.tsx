import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Film, Lightbulb } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface ResultsSkeletonProps {
  modelLabel?: string;
}

const CHECKLIST_KEYS = [
  "loading.checklist.read",
  "loading.checklist.block",
  "loading.checklist.light",
  "loading.checklist.lens",
  "loading.checklist.camera",
  "loading.checklist.model",
  "loading.checklist.shotlist",
  "loading.checklist.polish",
] as const;

const TRIVIA_KEYS = [
  "loading.trivia.deakins",
  "loading.trivia.goldenHour",
  "loading.trivia.dutchTilt",
  "loading.trivia.kubrick",
  "loading.trivia.rule180",
  "loading.trivia.lensChoice",
  "loading.trivia.eyeLevel",
  "loading.trivia.colorTemp",
  "loading.trivia.depth",
  "loading.trivia.threePoint",
  "loading.trivia.movement",
  "loading.trivia.frameRate",
] as const;

const STEP_INTERVAL_MS = 1600;
const TRIVIA_INTERVAL_MS = 4500;

export const ResultsSkeleton = ({ modelLabel }: ResultsSkeletonProps) => {
  const { t } = useLanguage();
  const [completedCount, setCompletedCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [triviaIdx, setTriviaIdx] = useState(0);
  const [clap, setClap] = useState(false);

  // Pre-pick a random starting trivia so it varies per generation
  const startTriviaIdx = useMemo(() => Math.floor(Math.random() * TRIVIA_KEYS.length), []);
  useEffect(() => {
    setTriviaIdx(startTriviaIdx);
  }, [startTriviaIdx]);

  // Advance checklist (last item keeps pulsing)
  useEffect(() => {
    const id = setInterval(() => {
      setCompletedCount((c) => Math.min(c + 1, CHECKLIST_KEYS.length - 1));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Rotate trivia
  useEffect(() => {
    const id = setInterval(() => {
      setTriviaIdx((i) => (i + 1) % TRIVIA_KEYS.length);
    }, TRIVIA_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Clapperboard "clap" animation
  useEffect(() => {
    const id = setInterval(() => {
      setClap(true);
      const t = setTimeout(() => setClap(false), 220);
      return () => clearTimeout(t);
    }, 2400);
    return () => clearInterval(id);
  }, []);

  // Eased progress to ~92%
  useEffect(() => {
    const start = performance.now();
    const duration = 12000;
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
    let label = t(key as any) as string;
    if (key === "loading.checklist.model" && modelLabel) {
      label = label.replace("{model}", modelLabel);
    }
    return (
      <motion.li
        key={key}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: done || active ? 1 : 0.35, x: 0 }}
        transition={{ duration: 0.35, delay: idx * 0.05 }}
        className="flex items-center gap-2.5 text-sm"
      >
        <span
          className="relative flex items-center justify-center shrink-0"
          style={{ width: 18, height: 18 }}
        >
          {done ? (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
              className="flex items-center justify-center rounded-full"
              style={{
                width: 18,
                height: 18,
                backgroundColor: "hsl(35 90% 50% / 0.18)",
                border: "1px solid hsl(35 90% 50% / 0.5)",
              }}
            >
              <Check style={{ width: 11, height: 11, color: "hsl(35 90% 60%)" }} strokeWidth={3} />
            </motion.span>
          ) : active ? (
            <span className="relative">
              <span
                className="absolute inset-0 rounded-full animate-ping"
                style={{ backgroundColor: "hsl(35 90% 50% / 0.4)" }}
              />
              <span
                className="relative block rounded-full"
                style={{
                  width: 10,
                  height: 10,
                  backgroundColor: "hsl(35 90% 55%)",
                  boxShadow: "0 0 8px hsl(35 90% 55% / 0.8)",
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
            color: done
              ? "hsl(0 0% 95%)"
              : active
                ? "hsl(35 90% 70%)"
                : "hsl(0 0% 60%)",
            fontWeight: active ? 500 : 400,
            letterSpacing: "-0.01em",
          }}
        >
          {label}
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
      {/* Director header card */}
      <Card
        className="relative overflow-hidden border-border/60"
        style={{
          background:
            "linear-gradient(135deg, hsl(35 90% 50% / 0.06) 0%, hsl(220 25% 8%) 50%, hsl(35 90% 55% / 0.05) 100%)",
        }}
      >
        {/* subtle scanline overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, hsl(35 90% 80%) 0px, hsl(35 90% 80%) 1px, transparent 1px, transparent 3px)",
          }}
        />
        <CardContent className="relative pt-5 pb-5 space-y-4">
          <div className="flex items-center gap-3">
            {/* Animated clapperboard */}
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
                <Film style={{ width: 22, height: 22, color: "hsl(35 90% 60%)" }} />
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
                <span>{t("loading.directorTitle" as any)}</span>
                <span
                  className="inline-block animate-pulse"
                  style={{
                    width: 2,
                    height: "1em",
                    backgroundColor: "hsl(35 90% 60%)",
                    transform: "translateY(2px)",
                  }}
                />
              </div>
              <div className="text-xs sm:text-sm" style={{ color: "hsl(0 0% 65%)" }}>
                {(t("loading.directorSubtitle" as any) as string).replace(
                  "{model}",
                  modelLabel || "your model",
                )}
              </div>
            </div>
            <div
              className="shrink-0 font-mono tabular-nums text-xs"
              style={{ color: "hsl(35 90% 65%)" }}
            >
              {Math.round(progress)}%
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
            {/* sweeping shimmer */}
            <div
              className="absolute inset-y-0 w-1/3 pointer-events-none"
              style={{
                background:
                  "linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.35), transparent)",
                animation: "shimmer-sweep 1.6s linear infinite",
              }}
            />
          </div>

          {/* Director's checklist */}
          <ul className="space-y-2 pt-1">
            {CHECKLIST_KEYS.map((k, i) => renderChecklistLine(k, i))}
          </ul>
        </CardContent>

        <style>{`
          @keyframes shimmer-sweep {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(400%); }
          }
        `}</style>
      </Card>

      {/* "While you wait" — callout-styled cinematography tip */}
      <Card
        className="border-0"
        style={{
          backgroundColor: "#161618",
          borderLeft: "2px solid hsl(35 90% 55%)",
          backgroundImage:
            "linear-gradient(90deg, hsl(35 90% 55% / 0.06), transparent 60%)",
        }}
      >
        <CardContent className="py-4 px-4">
          <div className="flex items-start gap-2.5">
            <Lightbulb
              className="shrink-0 mt-0.5"
              style={{ width: 16, height: 16, color: "hsl(35 90% 60%)" }}
            />
            <div className="flex-1 min-w-0">
              <div
                className="text-[10px] uppercase tracking-wider font-display mb-1.5"
                style={{ color: "hsl(35 90% 60%)", letterSpacing: "0.14em" }}
              >
                {t("loading.triviaLabel" as any) || "While you wait"}
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={triviaIdx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.4 }}
                  className="text-base"
                  style={{ color: "hsl(0 0% 98%)", lineHeight: 1.55 }}
                >
                  &ldquo;{t(TRIVIA_KEYS[triviaIdx] as any)}&rdquo;
                </motion.p>
              </AnimatePresence>
              <div
                className="mt-2 text-[11px] font-display"
                style={{ color: "hsl(0 0% 55%)", letterSpacing: "0.02em" }}
              >
                — MovPrompt cinematography library
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Animated shimmer placeholders (so layout doesn't shift when results arrive) */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <div
              className="rounded-lg p-4 border space-y-2 animate-pulse"
              style={{
                backgroundColor: "hsl(35 90% 55% / 0.04)",
                borderColor: "hsl(35 90% 55% / 0.18)",
              }}
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div
              className="rounded-lg p-4 border space-y-2 animate-pulse"
              style={{
                backgroundColor: "hsl(220 25% 9%)",
                borderColor: "hsl(0 0% 100% / 0.06)",
                animationDelay: "0.4s",
              }}
            >
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
