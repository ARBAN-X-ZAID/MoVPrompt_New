import { useRef, useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { AtSign, ImageIcon, Film, Music } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { ElementItem } from "./ElementGrid";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "@/components/ui/popover";

interface MentionTextareaProps {
  value: string;
  onChange: (v: string) => void;
  elements: ElementItem[];
  placeholder?: string;
}

export const MentionTextarea = ({ value, onChange, elements, placeholder }: MentionTextareaProps) => {
  const { t } = useLanguage();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  // When set, picker was opened by an inline "@" trigger at this caret position.
  // Selecting a number will replace that "@" instead of inserting a new token.
  const triggerPosRef = useRef<number | null>(null);
  const lastCaretRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  const recordCaret = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    lastCaretRef.current = {
      start: el.selectionStart ?? 0,
      end: el.selectionEnd ?? 0,
    };
  };

  const insertMention = (n: number) => {
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

    // If opened via inline "@" trigger, replace that "@" character.
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
  };

  // Detect "@" trigger: when the char immediately before the caret is "@" and
  // not yet followed by a digit, open the picker automatically.
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    recordCaret(e.target);
    if (elements.length === 0) return;
    const caret = e.target.selectionStart ?? next.length;
    const prev = next[caret - 1];
    const after = next[caret];
    const isTrigger =
      prev === "@" &&
      (caret === 1 || /\s/.test(next[caret - 2] ?? " ") || next[caret - 2] === "\n") &&
      !/\d/.test(after ?? "");
    if (isTrigger) {
      triggerPosRef.current = caret - 1;
      setOpen(true);
    } else if (open && triggerPosRef.current !== null) {
      // Close if user moved away or started typing digits manually
      const tp = triggerPosRef.current;
      if (next[tp] !== "@" || /\d/.test(next[tp + 1] ?? "")) {
        setOpen(false);
        triggerPosRef.current = null;
      }
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) triggerPosRef.current = null;
  };

  // Highlight overlay
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !overlayRef.current) return;
    overlayRef.current.scrollTop = ref.current.scrollTop;
  }, [value]);

  const renderHighlighted = () => {
    const parts = value.split(/(@Element \d+|@\d+)/g);
    return parts.map((part, i) => {
      const m = /^@(?:Element )?(\d+)$/.exec(part);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n >= 1 && n <= elements.length) {
          return (
            <span
              key={i}
              className="bg-primary/25 text-primary rounded px-0.5 -mx-0.5"
            >
              {part}
            </span>
          );
        }
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverAnchor asChild>
          <div className="relative">
            {/* Highlight overlay */}
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
                if (overlayRef.current) overlayRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
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
        </PopoverAnchor>
        <PopoverContent
          className="w-64 p-1"
          align="start"
          side="bottom"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
            {t("elements.mentionHint" as any)}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {elements.map((el, idx) => (
              <button
                key={el.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertMention(idx + 1)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary text-left text-sm"
              >
                <div className="w-8 h-8 rounded bg-secondary overflow-hidden flex items-center justify-center shrink-0">
                  {el.kind === "image" && el.preview && <img src={el.preview} alt="" className="w-full h-full object-cover" />}
                  {el.kind === "video" && el.preview && <video src={el.preview} className="w-full h-full object-cover" muted />}
                  {el.kind === "audio" && <Music className="w-3.5 h-3.5 text-accent" />}
                </div>
                <span className="font-mono text-xs text-primary">@{idx + 1}</span>
                <span className="text-xs text-muted-foreground ms-auto flex items-center gap-1">
                  {el.kind === "image" && <ImageIcon className="w-3 h-3" />}
                  {el.kind === "video" && <Film className="w-3 h-3" />}
                  {el.kind === "audio" && <Music className="w-3 h-3" />}
                </span>
              </button>
            ))}
          </div>
        </PopoverContent>

        <div className="flex items-center gap-2 flex-wrap">
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={elements.length === 0}
              onClick={() => { triggerPosRef.current = null; }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/30 bg-primary/5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <AtSign className="w-3 h-3" /> {t("elements.title" as any)}
            </button>
          </PopoverTrigger>
          <span className="text-[11px] text-muted-foreground">{t("elements.mentionHint" as any)}</span>
        </div>
      </Popover>
    </div>
  );
};
