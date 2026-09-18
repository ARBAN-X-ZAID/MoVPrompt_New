import { useRef, useImperativeHandle, forwardRef, useEffect, useMemo, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { AtSign, Info, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverAnchor,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";

export interface SceneMentionElement {
  index: number; // 1-based
  category: string;
  description: string;
  frameLabel?: string; // optional — which uploaded frame this element came from
}

interface SceneMentionTextareaProps {
  value: string;
  onChange: (v: string) => void;
  elements: SceneMentionElement[];
  placeholder?: string;
  showFrameBadges?: boolean; // typically only meaningful when there are multiple frames
}

export interface SceneMentionTextareaHandle {
  insertMention: (n: number) => void;
}

const categoryEmoji: Record<string, string> = {
  Subject: "🎯",
  Background: "🏙",
  Lighting: "💡",
  Atmosphere: "🌤",
  Objects: "📦",
  Colors: "🎨",
};

export const SceneMentionTextarea = forwardRef<SceneMentionTextareaHandle, SceneMentionTextareaProps>(
  ({ value, onChange, elements, placeholder, showFrameBadges = false }, fwdRef) => {
    const { t } = useLanguage();
    const ref = useRef<HTMLTextAreaElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const triggerPosRef = useRef<number | null>(null);
    const lastCaretRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

    const maxIndex = elements.length;

    const recordCaret = (el: HTMLTextAreaElement | null) => {
      if (!el) return;
      lastCaretRef.current = {
        start: el.selectionStart ?? 0,
        end: el.selectionEnd ?? 0,
      };
    };

    const insertMention = useCallback((n: number) => {
      const el = ref.current;
      const token = `@${n} `;
      if (!el) {
        onChange(value + token);
        setOpen(false);
        triggerPosRef.current = null;
        return;
      }
      const trigger = triggerPosRef.current;
      const fallbackStart = lastCaretRef.current.start ?? value.length;
      const fallbackEnd = lastCaretRef.current.end ?? fallbackStart;
      let next: string;
      let newCaret: number;
      if (trigger !== null && trigger >= 0 && value[trigger] === "@") {
        next = value.slice(0, trigger) + token + value.slice(trigger + 1);
        newCaret = trigger + token.length;
      } else {
        next = value.slice(0, fallbackStart) + token + value.slice(fallbackEnd);
        newCaret = fallbackStart + token.length;
      }
      onChange(next);
      setOpen(false);
      triggerPosRef.current = null;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(newCaret, newCaret);
      });
    }, [onChange, value]);

    useImperativeHandle(fwdRef, () => ({ insertMention }), [insertMention]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      onChange(next);
      recordCaret(e.target);
      if (elements.length === 0) {
        triggerPosRef.current = null;
        if (open) setOpen(false);
        return;
      }
      const caret = e.target.selectionStart ?? next.length;
      const prev = next[caret - 1];
      const after = next[caret];
      const before = next[caret - 2];
      const isFreshAt =
        prev === "@" &&
        !/\d/.test(after ?? "") &&
        (caret === 1 || !/\w/.test(before ?? "") || before === "\n");
      if (isFreshAt && !open) {
        triggerPosRef.current = caret - 1;
        setOpen(true);
      } else if (triggerPosRef.current !== null) {
        const tp = triggerPosRef.current;
        if (next[tp] !== "@" || /\d/.test(next[tp + 1] ?? "")) {
          triggerPosRef.current = null;
          if (open) setOpen(false);
        }
      }
    };

    const handleOpenChange = (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) triggerPosRef.current = null;
    };

    useEffect(() => {
      if (!ref.current || !overlayRef.current) return;
      overlayRef.current.scrollTop = ref.current.scrollTop;
    }, [value]);

    // Collect any out-of-range @N tokens for the warning chip.
    const invalidTokens = useMemo(() => {
      const found = new Set<string>();
      const re = /@(\d+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(value)) !== null) {
        const n = parseInt(m[1], 10);
        if (maxIndex === 0 || n < 1 || n > maxIndex) found.add(`@${n}`);
      }
      return Array.from(found);
    }, [value, maxIndex]);

    const renderHighlighted = () => {
      const parts = value.split(/(@\d+)/g);
      return parts.map((part, i) => {
        const m = /^@(\d+)$/.exec(part);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n >= 1 && n <= maxIndex) {
            return (
              <span
                key={i}
                className="bg-primary/25 text-primary rounded px-0.5 -mx-0.5"
              >
                {part}
              </span>
            );
          }
          return (
            <span
              key={i}
              className="bg-destructive/20 text-destructive rounded px-0.5 -mx-0.5 underline decoration-destructive decoration-dashed underline-offset-2"
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      });
    };

    const openPicker = () => {
      const el = ref.current;
      if (el) {
        el.focus();
        recordCaret(el);
      }
      triggerPosRef.current = null;
      setOpen(true);
    };

    return (
      <div className="space-y-2">
        <Popover open={open} onOpenChange={handleOpenChange}>
          <div className="relative">
            <div
              ref={overlayRef}
              aria-hidden
              className="absolute inset-0 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words pointer-events-none text-transparent overflow-hidden"
            >
              {renderHighlighted()}
              {"\u200b"}
            </div>
            <Textarea
              ref={ref}
              value={value}
              onChange={handleChange}
              placeholder={placeholder}
              className="relative bg-transparent min-h-[120px] leading-relaxed"
              onScroll={(e) => {
                if (overlayRef.current)
                  overlayRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
              }}
              onSelect={(e) => recordCaret(e.target as HTMLTextAreaElement)}
              onKeyUp={(e) => recordCaret(e.target as HTMLTextAreaElement)}
              onClick={(e) => recordCaret(e.target as HTMLTextAreaElement)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && open) {
                  setOpen(false);
                  triggerPosRef.current = null;
                }
              }}
            />
          </div>
          <PopoverAnchor className="absolute" />
          <PopoverContent
            className="w-[min(22rem,calc(100vw-2rem))] p-1"
            align="start"
            side="bottom"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {elements.length === 0 ? (
              <div className="flex flex-col items-center text-center px-3 py-4 gap-2">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <AtSign className="w-4 h-4 text-primary" />
                </div>
                <div className="text-sm font-medium text-foreground">
                  {t("scene.mentionEmptyTitle" as any)}
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  {t("scene.mentionEmptyHint" as any)}
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertMention(1)}
                  className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                >
                  <AtSign className="w-3 h-3" />
                  {t("scene.mentionEmptyCta" as any)}
                </button>
              </div>
            ) : (
              <>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
                  {t("scene.mentionPickerTitle" as any)}
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {elements.map((el) => (
                    <button
                      key={el.index}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertMention(el.index)}
                      className="w-full flex items-start gap-2 px-2 py-1.5 rounded hover:bg-secondary text-left"
                    >
                      <span className="font-mono text-xs text-primary mt-0.5 shrink-0">
                        @{el.index}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 flex-wrap">
                          <span>{categoryEmoji[el.category] ?? ""} {el.category}</span>
                          {showFrameBadges && el.frameLabel && (
                            <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/40 px-1.5 py-px text-[9px] font-medium text-muted-foreground normal-case tracking-normal">
                              {el.frameLabel}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-foreground truncate">{el.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </PopoverContent>
        </Popover>

        {/* Validation chip — shown when description has invalid @N */}
        {elements.length > 0 && invalidTokens.length > 0 && (
          <div className="flex items-start gap-1.5 text-[11px] leading-relaxed rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-px" aria-hidden="true" />
            <p className="flex-1 text-destructive">
              {t("scene.mentionHint.invalid" as any)
                .replace("{tokens}", invalidTokens.join(", "))
                .replace("{n}", String(maxIndex))}
              {" "}
              <button
                type="button"
                onClick={openPicker}
                className="underline decoration-dotted underline-offset-2 hover:text-foreground"
              >
                {t("scene.mentionHint.pickFromList" as any)}
              </button>
            </p>
          </div>
        )}

        {/* Contextual hint — only when no invalid tokens are present */}
        {elements.length > 0 && invalidTokens.length === 0 && (
          <p className="text-[11px] text-muted-foreground leading-relaxed flex items-start gap-1.5">
            <span aria-hidden="true">💡</span>
            <span className="flex-1">
              {(maxIndex === 1
                ? t("scene.mentionHint.single" as any)
                : t("scene.mentionHint.range" as any).replace("{n}", String(maxIndex))
              )}
            </span>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="How @N works"
                    className="text-muted-foreground/70 hover:text-foreground transition-colors shrink-0"
                  >
                    <Info className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                  {t("scene.mentionHint.info" as any)}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </p>
        )}
      </div>
    );
  },
);

SceneMentionTextarea.displayName = "SceneMentionTextarea";
