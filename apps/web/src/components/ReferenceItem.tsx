import { X, Image as ImageIcon, Film, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/i18n/LanguageContext";

export type ReferenceRole = "style" | "lighting" | "composition" | "motion" | "mood";
export type ReferenceKind = "image" | "video" | "audio";

export interface ReferenceMediaItem {
  id: string;
  file: File;
  kind: ReferenceKind;
  role: ReferenceRole;
  note: string;
  preview: string | null; // object URL for image/video poster, null for audio
}

interface ReferenceItemProps {
  item: ReferenceMediaItem;
  onChange: (patch: Partial<ReferenceMediaItem>) => void;
  onRemove: () => void;
}

export const ReferenceItem = ({ item, onChange, onRemove }: ReferenceItemProps) => {
  const { t } = useLanguage();

  const Icon = item.kind === "image" ? ImageIcon : item.kind === "video" ? Film : Music;

  return (
    <div className="flex gap-3 rounded-lg border border-border bg-secondary/30 p-3">
      {/* Thumbnail */}
      <div className="relative shrink-0 w-20 h-20 rounded-md overflow-hidden bg-background border border-border flex items-center justify-center">
        {item.kind === "image" && item.preview && (
          <img src={item.preview} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
        )}
        {item.kind === "video" && item.preview && (
          <video src={item.preview} preload="metadata" className="w-full h-full object-cover" muted playsInline />
        )}
        {item.kind === "audio" && (
          <Music className="w-8 h-8 text-muted-foreground" />
        )}
        <div className="absolute bottom-0.5 left-0.5 rounded bg-background/80 p-0.5">
          <Icon className="w-3 h-3 text-primary" />
        </div>
      </div>

      {/* Controls */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground truncate flex-1" title={item.file.name}>
            {item.file.name}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
            aria-label={t("references.remove" as any)}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={item.role} onValueChange={(v) => onChange({ role: v as ReferenceRole })}>
            <SelectTrigger className="h-8 text-xs sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="style">{t("references.roles.style" as any)}</SelectItem>
              <SelectItem value="lighting">{t("references.roles.lighting" as any)}</SelectItem>
              <SelectItem value="composition">{t("references.roles.composition" as any)}</SelectItem>
              <SelectItem value="motion">{t("references.roles.motion" as any)}</SelectItem>
              <SelectItem value="mood">{t("references.roles.mood" as any)}</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={item.note}
            onChange={(e) => onChange({ note: e.target.value })}
            placeholder={
              item.kind === "audio"
                ? (t("references.audioHint" as any) as string)
                : (t("references.notePlaceholder" as any) as string)
            }
            maxLength={200}
            className="h-8 text-xs flex-1"
          />
        </div>
      </div>
    </div>
  );
};
