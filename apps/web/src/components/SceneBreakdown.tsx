import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Waves, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/i18n/LanguageContext";

export interface SceneElement {
  id: string;
  category: "Subject" | "Background" | "Lighting" | "Atmosphere" | "Objects" | "Colors";
  description: string;
  details: string;
}

export interface SceneFrame {
  frameIndex: number;
  elements: SceneElement[];
}

export interface ElementDirection {
  action: "lock" | "move";
  note: string;
}

export type ElementDirections = Record<string, ElementDirection>;

interface SceneBreakdownProps {
  frames: SceneFrame[];
  frameLabels: string[];
  framePreviews: (string | null)[];
  directions: ElementDirections;
  onDirectionsChange: (directions: ElementDirections) => void;
  onInsertMention?: (n: number) => void;
  onManualToggle?: (id: string) => void;
}

// Categories that should default to LOCK (static), others default to MOVE (animate).
const LOCK_DEFAULT_CATEGORIES = new Set(["Background", "Objects", "Atmosphere"]);

const categoryEmoji: Record<string, string> = {
  Subject: "🎯",
  Background: "🏙",
  Lighting: "💡",
  Atmosphere: "🌤",
  Objects: "📦",
  Colors: "🎨",
};

const CATEGORY_ORDER = ["Subject", "Objects", "Background", "Lighting", "Atmosphere", "Colors"];

const truncate = (text: string, max = 60) => {
  if (!text) return "";
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 30 ? slice.slice(0, lastSpace) : slice).trimEnd() + "…";
};

export const SceneBreakdown = ({
  frames,
  frameLabels,
  framePreviews,
  directions,
  onDirectionsChange,
  onInsertMention,
  onManualToggle,
}: SceneBreakdownProps) => {
  // Stable global 1-based index across all frames.
  const globalIndexById = useMemo(() => {
    const m = new Map<string, number>();
    let counter = 0;
    for (const frame of frames) {
      for (const el of frame.elements) {
        counter += 1;
        m.set(el.id, counter);
      }
    }
    return m;
  }, [frames]);

  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [pulsing, setPulsing] = useState<Record<string, number>>({});
  const prevActionsRef = useRef<Record<string, string | undefined>>({});
  const { t } = useLanguage();

  useEffect(() => {
    const prev = prevActionsRef.current;
    const changed: string[] = [];
    for (const id of Object.keys(directions)) {
      const a = directions[id]?.action;
      if (prev[id] !== undefined && prev[id] !== a) changed.push(id);
      prev[id] = a;
    }
    if (changed.length === 0) return;
    const now = Date.now();
    setPulsing((p) => {
      const next = { ...p };
      for (const id of changed) next[id] = now;
      return next;
    });
    const timer = setTimeout(() => {
      setPulsing((p) => {
        const next = { ...p };
        for (const id of changed) {
          if (next[id] === now) delete next[id];
        }
        return next;
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [directions]);

  const setAction = (id: string, action: "lock" | "move") => {
    onManualToggle?.(id);
    const current = directions[id];
    if (current?.action === action) return;
    onDirectionsChange({
      ...directions,
      [id]: { ...current, action },
    });
  };

  const updateNote = (id: string, note: string) => {
    onDirectionsChange({
      ...directions,
      [id]: { ...directions[id], note },
    });
  };

  const toggleDescExpanded = (id: string) => {
    setExpandedDescriptions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Batch actions
  const applyAll = (action: "lock" | "move") => {
    const next: ElementDirections = { ...directions };
    for (const frame of frames) {
      for (const el of frame.elements) {
        onManualToggle?.(el.id);
        next[el.id] = { ...next[el.id], action };
      }
    }
    onDirectionsChange(next);
  };

  const applySmartDefaults = () => {
    const next: ElementDirections = { ...directions };
    for (const frame of frames) {
      for (const el of frame.elements) {
        onManualToggle?.(el.id);
        next[el.id] = {
          ...next[el.id],
          action: LOCK_DEFAULT_CATEGORIES.has(el.category) ? "lock" : "move",
        };
      }
    }
    onDirectionsChange(next);
  };

  const showFrameHeaders = frames.length > 1;

  // Group elements by category within each frame, ordered consistently.
  const groupByCategory = (elements: SceneElement[]) => {
    const grouped = new Map<string, SceneElement[]>();
    for (const el of elements) {
      const list = grouped.get(el.category) ?? [];
      list.push(el);
      grouped.set(el.category, list);
    }
    return CATEGORY_ORDER.filter((c) => grouped.has(c)).map((c) => ({
      category: c,
      items: grouped.get(c)!,
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-display font-semibold text-foreground">{t("scene.title")}</h3>
        <span className="text-xs text-muted-foreground">{t("scene.subtitle")}</span>
      </div>

      {/* Batch action chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-display me-1">
          Quick set:
        </span>
        <button
          type="button"
          onClick={applySmartDefaults}
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-display px-2.5 py-1 rounded-full transition-colors"
          style={{
            backgroundColor: "#F5A524",
            color: "#000",
            border: "1px solid #F5A524",
          }}
          title="Auto-assign Lock/Move based on element category"
        >
          <span style={{ color: "rgba(255,255,255,0.9)" }}>✨</span>
          <span>Smart suggest</span>
        </button>
        <button
          type="button"
          onClick={() => applyAll("lock")}
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-display px-2.5 py-1 rounded-full transition-colors hover:bg-primary/5"
          style={{
            border: "1px solid #F5A524",
            color: "#F5A524",
            backgroundColor: "transparent",
          }}
        >
          <Lock className="w-3 h-3" style={{ color: "rgba(255,255,255,0.9)" }} /> Lock all
        </button>
        <button
          type="button"
          onClick={() => applyAll("move")}
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-display px-2.5 py-1 rounded-full transition-colors hover:bg-primary/5"
          style={{
            border: "1px solid #F5A524",
            color: "#F5A524",
            backgroundColor: "transparent",
          }}
        >
          <Waves className="w-3 h-3" style={{ color: "rgba(255,255,255,0.9)" }} /> Move all
        </button>
      </div>

      {/* Inline legend so users don't need a tooltip to learn Lock vs Move. */}
      <p className="text-[11px] text-muted-foreground leading-relaxed -mt-1">
        <Lock className="inline w-3 h-3 me-1 align-[-2px] text-primary" />
        <span className="font-medium text-foreground/80">Lock</span> keeps an element identical across the shot.
        <span className="mx-2 opacity-40">·</span>
        <Waves className="inline w-3 h-3 me-1 align-[-2px] text-accent" />
        <span className="font-medium text-foreground/80">Move</span> lets it animate, drift, or react.
      </p>

      {/* @-mention hint moved next to the description textarea (SceneMentionTextarea)
          so users see it where the input actually lives. */}



      {frames.map((frame, frameIdx) => {
        const label = frameLabels[frameIdx] || `Frame ${frameIdx + 1}`;
        const preview = framePreviews[frameIdx];
        const groups = groupByCategory(frame.elements);

        return (
          <div key={frame.frameIndex} className="space-y-3">
            {showFrameHeaders && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: frameIdx * 0.15 }}
                className="flex items-center gap-3 pt-2 pb-1 border-b border-border/50"
              >
                {preview ? (
                  <img
                    src={preview}
                    alt={label}
                    loading="lazy"
                    decoding="async"
                    className="w-10 h-10 rounded-md object-cover border border-border/50 flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                    <Film className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <h4 className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                  {label}
                </h4>
                <span className="text-xs text-muted-foreground">
                  {frame.elements.length} {t("scene.elements")}
                </span>
              </motion.div>
            )}

            {groups.map((group, gIdx) => (
              <motion.div
                key={`${frame.frameIndex}-${group.category}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: frameIdx * 0.12 + gIdx * 0.06 }}
                className="space-y-1.5"
              >
                {/* Category header — single per group */}
                <div className="flex items-center gap-2 ps-1">
                  <span
                    className="text-[10px] uppercase tracking-[0.14em] font-display font-semibold"
                    style={{ color: "#F5A524" }}
                  >
                    {categoryEmoji[group.category]} {group.category}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    ({group.items.length} {group.items.length === 1 ? "element" : "elements"})
                  </span>
                </div>

                {/* Indented element list */}
                <div className="ms-3 ps-3 border-l border-border/40 space-y-1.5">
                  {group.items.map((el, i) => {
                    const dir = directions[el.id];
                    const isLocked = dir?.action === "lock";
                    const descExpanded = expandedDescriptions.has(el.id);
                    const fullText = el.details || el.description || "";
                    const idx = globalIndexById.get(el.id) ?? 0;

                    return (
                      <motion.div
                        key={el.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: frameIdx * 0.12 + gIdx * 0.06 + i * 0.04 }}
                        className={`group/card rounded-lg p-2.5 sm:p-3 transition-colors border ${
                          isLocked
                            ? "border-border/60 bg-muted/40"
                            : "border-primary/30 bg-primary/[0.04]"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {/* Prominent amber @ number — clickable to insert */}
                              <button
                                type="button"
                                onClick={() => onInsertMention?.(idx)}
                                disabled={!onInsertMention}
                                title="Insert reference into prompt"
                                className="font-mono font-bold rounded px-1.5 py-0.5 transition-all disabled:cursor-default"
                                style={{
                                  fontSize: 14,
                                  color: "#F5A524",
                                  backgroundColor: "rgba(245,165,36,0.12)",
                                  border: "1px solid rgba(245,165,36,0.3)",
                                }}
                                onMouseEnter={(e) => {
                                  if (onInsertMention)
                                    e.currentTarget.style.backgroundColor = "rgba(245,165,36,0.22)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = "rgba(245,165,36,0.12)";
                                }}
                              >
                                @{idx}
                              </button>
                              <span className="text-sm font-medium text-foreground break-words">
                                {el.description}
                              </span>
                            </div>

                            {fullText && (
                              <p
                                onClick={() => toggleDescExpanded(el.id)}
                                title={fullText}
                                className={`text-xs text-muted-foreground leading-relaxed break-words cursor-text transition-[max-height] ${
                                  descExpanded
                                    ? ""
                                    : "line-clamp-2 group-hover/card:line-clamp-none group-focus-within/card:line-clamp-none"
                                }`}
                              >
                                {fullText}
                              </p>
                            )}
                          </div>

                          {/* Lock/Move segmented toggle */}
                          <TooltipProvider delayDuration={200}>
                            <div
                              className="group/toggle flex items-center rounded-md p-0.5 flex-shrink-0 relative transition-all"
                              style={{
                                backgroundColor: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.08)",
                              }}
                            >

                              {/* Sliding active background */}
                              <motion.div
                                className="absolute top-0.5 bottom-0.5 rounded"
                                animate={{
                                  left: isLocked ? 2 : "calc(50% + 0px)",
                                  right: isLocked ? "calc(50% + 0px)" : 2,
                                }}
                                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                style={{
                                  backgroundColor: isLocked ? "#27272A" : "#F5A524",
                                  boxShadow: isLocked
                                    ? "none"
                                    : "0 0 12px rgba(245,165,36,0.45)",
                                }}
                              />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => setAction(el.id, "lock")}
                                    aria-label="Lock"
                                    aria-pressed={isLocked}
                                    className={`relative z-10 inline-flex items-center h-7 px-1.5 text-xs font-display font-medium transition-colors ${
                                      isLocked && pulsing[el.id] ? "animate-pulse-glow" : ""
                                    }`}
                                    style={{
                                      color: isLocked ? "#FFFFFF" : "#71717A",
                                    }}
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                    <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap group-hover/toggle:max-w-[40px] group-hover/toggle:opacity-100 group-hover/toggle:ms-1 transition-all duration-200">
                                      Lock
                                    </span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[220px] text-xs">
                                  {t("scene.lockTooltip" as any)}
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => setAction(el.id, "move")}
                                    aria-label="Move"
                                    aria-pressed={!isLocked}
                                    className={`relative z-10 inline-flex items-center h-7 px-1.5 text-xs font-display font-medium transition-colors ${
                                      !isLocked && pulsing[el.id] ? "animate-pulse-glow" : ""
                                    }`}
                                    style={{
                                      color: !isLocked ? "#000000" : "#71717A",
                                    }}
                                  >
                                    <Waves className="w-3.5 h-3.5" />
                                    <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap group-hover/toggle:max-w-[40px] group-hover/toggle:opacity-100 group-hover/toggle:ms-1 transition-all duration-200">
                                      Move
                                    </span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[220px] text-xs">
                                  {t("scene.moveTooltip" as any)}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </div>

                        <AnimatePresence>
                          {expandedNotes.has(el.id) && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-2"
                            >
                              <Textarea
                                placeholder={t("scene.notePlaceholder")}
                                value={dir?.note || ""}
                                onChange={(e) => updateNote(el.id, e.target.value)}
                                className="min-h-[56px] sm:min-h-[60px] text-xs bg-background/50 border-border/50 resize-none"
                                maxLength={300}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        );
      })}
    </motion.div>
  );
};
