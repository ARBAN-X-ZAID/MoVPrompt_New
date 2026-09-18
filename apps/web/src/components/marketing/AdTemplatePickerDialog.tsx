import { useEffect, useState } from "react";
import { Loader2, Sparkles, Search, Trash2, Play } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listMyTemplates, deleteTemplate, type AdTemplateRow } from "@/lib/adTemplates";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelect: (t: AdTemplateRow) => void;
};

export function AdTemplatePickerDialog({ open, onOpenChange, onSelect }: Props) {
  const [items, setItems] = useState<AdTemplateRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    listMyTemplates()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((e) => {
        if (!cancelled) toast.error(e?.message || "Failed to load templates");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = (items ?? []).filter((t) => {
    if (!q) return true;
    const hay = [t.name, t.description, ...(t.tags ?? [])].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  });

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteTemplate(id);
      setItems((prev) => (prev ?? []).filter((t) => t.id !== id));
      toast.success("Template deleted");
    } catch (e: any) {
      toast.error(e?.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Your ad templates
          </DialogTitle>
          <DialogDescription>
            Pick a saved template to seed the composer. Build new ones in MovPrompt.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates…"
            className="pl-9"
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto -mx-1 px-1">
          {loading && items === null ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground space-y-2">
              <p>{items && items.length === 0 ? "No saved templates yet." : "No matches."}</p>
              {items && items.length === 0 && (
                <Button variant="outline" size="sm" asChild>
                  <a href="/movprompt">Create your first template</a>
                </Button>
              )}
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filtered.map((t) => {
                const tj = t.template_json;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(t);
                        onOpenChange(false);
                      }}
                      className={cn(
                        "group w-full text-left rounded-lg border border-border/60 bg-secondary/20 hover:bg-secondary/40 hover:border-primary/50 transition-colors p-3 space-y-2",
                      )}
                    >
                      <div className="aspect-video rounded-md bg-muted/40 overflow-hidden relative">
                        {t.preview_video_url ? (
                          <video
                            src={t.preview_video_url}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                            onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
                            onMouseLeave={(e) => {
                              e.currentTarget.pause();
                              e.currentTarget.currentTime = 0;
                            }}
                          />
                        ) : t.thumbnail_url ? (
                          <img src={t.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/60">
                            <Play className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{t.name}</p>
                          {t.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            void handleDelete(t.id);
                          }}
                          disabled={deletingId === t.id}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                          aria-label="Delete template"
                        >
                          {deletingId === t.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {tj.aspect_ratio && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                            {tj.aspect_ratio}
                          </span>
                        )}
                        {tj.duration_seconds && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                            {tj.duration_seconds}s
                          </span>
                        )}
                        {(tj.tags ?? []).slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
