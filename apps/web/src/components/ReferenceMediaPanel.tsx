import { useRef } from "react";
import { Plus, ChevronDown, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ReferenceItem, type ReferenceMediaItem, type ReferenceKind } from "./ReferenceItem";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";

const MAX_REFERENCES = 10;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

interface ReferenceMediaPanelProps {
  items: ReferenceMediaItem[];
  onChange: (items: ReferenceMediaItem[]) => void;
}

function detectKind(file: File): ReferenceKind | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

export const ReferenceMediaPanel = ({ items, onChange }: ReferenceMediaPanelProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const additions: ReferenceMediaItem[] = [];
    const remaining = MAX_REFERENCES - items.length;
    const toProcess = Array.from(files).slice(0, remaining);

    for (const file of toProcess) {
      const kind = detectKind(file);
      if (!kind) {
        toast({ title: t("references.invalidType" as any), description: file.name, variant: "destructive" });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: t("references.tooLarge" as any), description: file.name, variant: "destructive" });
        continue;
      }
      const preview = kind === "audio" ? null : URL.createObjectURL(file);
      additions.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        kind,
        role: kind === "audio" ? "mood" : kind === "video" ? "motion" : "style",
        note: "",
        preview,
      });
    }

    if (files.length > remaining) {
      toast({ title: t("references.limit" as any), description: t("references.limitDesc" as any) });
    }

    onChange([...items, ...additions]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const updateItem = (id: string, patch: Partial<ReferenceMediaItem>) => {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id: string) => {
    const target = items.find((it) => it.id === id);
    if (target?.preview) URL.revokeObjectURL(target.preview);
    onChange(items.filter((it) => it.id !== id));
  };

  const canAddMore = items.length < MAX_REFERENCES;

  return (
    <Collapsible defaultOpen={items.length > 0}>
      <CollapsibleTrigger className="flex items-center justify-between w-full rounded-lg border border-border bg-secondary/30 px-3 py-2 hover:bg-secondary/50 transition-colors group">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <span>{t("references.title" as any)}</span>
          {items.length > 0 && (
            <span className="text-xs text-muted-foreground">({items.length}/{MAX_REFERENCES})</span>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-3 pt-3">
        <p className="text-xs text-muted-foreground">{t("references.desc" as any)}</p>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => (
              <ReferenceItem
                key={item.id}
                item={item}
                onChange={(patch) => updateItem(item.id, patch)}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canAddMore}
          onClick={() => fileInputRef.current?.click()}
          className="w-full gap-2 border-dashed"
        >
          <Plus className="w-3.5 h-3.5" />
          {canAddMore ? t("references.add" as any) : t("references.limitReached" as any)}
        </Button>
        <p className="text-[11px] text-muted-foreground">{t("references.videoHint" as any)}</p>
      </CollapsibleContent>
    </Collapsible>
  );
};
