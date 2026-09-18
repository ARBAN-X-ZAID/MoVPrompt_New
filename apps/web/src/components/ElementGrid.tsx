import { useRef, useState } from "react";
import { Plus, X, ImageIcon, Film, Music } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import type { ReferenceKind } from "./ReferenceItem";
import {
  LONG_PRESS_MS,
  MOVE_CANCEL_PX,
  findDropTargetFromPoint,
  triggerHaptic,
} from "@/lib/touchDrag";

export interface ElementItem {
  id: string;
  file: File;
  kind: ReferenceKind;
  preview?: string; // image/video object URL
  note?: string;
}

interface ElementGridProps {
  items: ElementItem[];
  onChange: (items: ElementItem[]) => void;
  max?: number;
}

const detectKind = (file: File): ReferenceKind => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "image";
};

const MAX_BYTES = 25 * 1024 * 1024;

export const ElementGrid = ({ items, onChange, max = 10 }: ElementGridProps) => {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const touchTimerRef = useRef<number | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const touchActiveRef = useRef<boolean>(false);

  const lastSnappedRef = useRef<string | null>(null);

  const cancelTouchHold = () => {
    if (touchTimerRef.current !== null) {
      window.clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const onTouchStart = (e: React.TouchEvent, id: string) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    touchActiveRef.current = false;
    cancelTouchHold();
    touchTimerRef.current = window.setTimeout(() => {
      touchActiveRef.current = true;
      setDraggingId(id);
      triggerHaptic();
    }, LONG_PRESS_MS);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const start = touchStartPosRef.current;
    if (!touchActiveRef.current) {
      if (start) {
        const dx = Math.abs(touch.clientX - start.x);
        const dy = Math.abs(touch.clientY - start.y);
        if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) cancelTouchHold();
      }
      return;
    }
    e.preventDefault();
    const hit = findDropTargetFromPoint(touch.clientX, touch.clientY, "[data-element-tile-id]");
    const overId = hit?.id ?? null;
    setDragOverId(overId);
    if (hit?.snapped && overId && overId !== lastSnappedRef.current) {
      lastSnappedRef.current = overId;
      triggerHaptic();
    } else if (!hit?.snapped) {
      lastSnappedRef.current = null;
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    cancelTouchHold();
    if (touchActiveRef.current && draggingId) {
      const touch = e.changedTouches[0];
      const hit = findDropTargetFromPoint(touch.clientX, touch.clientY, "[data-element-tile-id]");
      if (hit?.id) reorder(draggingId, hit.id);
    }
    touchActiveRef.current = false;
    touchStartPosRef.current = null;
    lastSnappedRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
  };

  const reorder = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const next = [...items];
    const from = next.findIndex((it) => it.id === sourceId);
    const to = next.findIndex((it) => it.id === targetId);
    if (from === -1 || to === -1) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = max - items.length;
    if (remaining <= 0) {
      toast.error(t("elements.limitReached" as any));
      return;
    }
    const next: ElementItem[] = [...items];
    for (let i = 0; i < files.length && next.length < max; i++) {
      const file = files[i];
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: ${t("references.tooLarge")}`);
        continue;
      }
      const kind = detectKind(file);
      const preview = kind === "audio" ? undefined : URL.createObjectURL(file);
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        kind,
        preview,
      });
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeItem = (id: string) => {
    const target = items.find((it) => it.id === id);
    if (target?.preview) URL.revokeObjectURL(target.preview);
    onChange(items.filter((it) => it.id !== id));
  };

  const isFull = items.length >= max;
  const openPicker = () => inputRef.current?.click();

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          Characters / References <span className="text-muted-foreground font-normal">({items.length}/{max})</span>
        </span>
        <span className="text-[11px] text-muted-foreground italic">
          Add up to {max} character references for your single shot
        </span>
      </div>

      {items.length === 0 ? (
        <button
          type="button"
          onClick={openPicker}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`w-full rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-4 py-10 px-6 ${
            isDragging
              ? "border-primary bg-primary/10"
              : "border-border bg-secondary/40 hover:border-primary/60 hover:bg-secondary/60"
          }`}
        >
          <div className="flex items-center gap-3">
            {[ImageIcon, Film, Music].map((Icon, i) => (
              <span
                key={i}
                className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20 border border-border/60 shadow-inner"
              >
                <Icon className="w-5 h-5 text-foreground/80" />
              </span>
            ))}
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-foreground">{t("elements.uploadMedia" as any)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{t("elements.uploadMediaSubtitle" as any)}</div>
          </div>
        </button>
      ) : (
        <div
          className="grid grid-cols-3 sm:grid-cols-5 gap-2"
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {items.map((item, idx) => (
            <div
              key={item.id}
              data-element-tile-id={item.id}
              draggable
              onDragStart={(e) => {
                setDraggingId(item.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", item.id);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setDragOverId(null);
              }}
              onDragOver={(e) => {
                if (!draggingId) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "move";
                if (dragOverId !== item.id) setDragOverId(item.id);
              }}
              onDragLeave={(e) => {
                e.stopPropagation();
                if (dragOverId === item.id) setDragOverId(null);
              }}
              onDrop={(e) => {
                if (!draggingId) return;
                e.preventDefault();
                e.stopPropagation();
                reorder(draggingId, item.id);
                setDraggingId(null);
                setDragOverId(null);
              }}
              onTouchStart={(e) => onTouchStart(e, item.id)}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onTouchCancel={onTouchEnd}
              style={{ touchAction: draggingId ? "none" : "auto" }}
              className={`relative aspect-square rounded-lg border bg-secondary/40 overflow-hidden group cursor-move transition-all select-none ${
                draggingId === item.id ? "opacity-40 scale-95" : ""
              } ${
                dragOverId === item.id && draggingId !== item.id
                  ? "border-primary ring-2 ring-primary/50"
                  : "border-border"
              }`}
            >
              {item.kind === "image" && item.preview && (
                <img src={item.preview} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
              )}
              {item.kind === "video" && item.preview && (
                <video src={item.preview} preload="metadata" className="w-full h-full object-cover" muted playsInline />
              )}
              {item.kind === "audio" && (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent/20 to-primary/20">
                  <Music className="w-6 h-6 text-accent" />
                </div>
              )}

              <span
                className="absolute top-1 left-1 font-mono font-bold rounded px-1.5 py-0.5 shadow"
                style={{
                  fontSize: 11,
                  color: "#000",
                  backgroundColor: "#F5A524",
                  border: "1px solid #F5A524",
                }}
              >
                @{idx + 1}
              </span>

              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="absolute top-1 right-1 p-1 rounded-full bg-destructive/80 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={t("references.remove")}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {!isFull && (
            <button
              type="button"
              onClick={openPicker}
              className={`aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors ${
                isDragging
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/60 hover:bg-primary/5 text-muted-foreground hover:text-primary"
              }`}
            >
              <Plus className="w-5 h-5" />
              <span className="text-[10px] font-medium">{t("elements.add" as any)}</span>
            </button>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
};
