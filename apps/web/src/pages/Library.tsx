import { useState, useEffect, useMemo } from "react";

import { useNavigate, useSearchParams } from "react-router-dom";
import { VideosTab } from "@/components/library/VideosTab";
import { CinematicPlaceholder } from "@/components/library/CinematicPlaceholder";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { trackPageVisit } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  Copy,
  ChevronDown,
  Sparkles,
  Check,
  Trash2,
  Search,
  X,
  MoreVertical,
  AlertTriangle,
  LayoutGrid,
  List as ListIcon,
  Pencil,
  Files,
} from "lucide-react";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Seo } from "@/components/Seo";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  modelFamily,
  friendlyModelLabel,
  ALL_FAMILIES,
  FAMILY_META,
  variantsForFamily,
  type ModelFamily,
} from "@/lib/modelFamily";
import { TopNav } from "@/components/TopNav";

interface HistoryEntry {
  id: string;
  workflow_type: string;
  target_model: string;
  results: any;
  created_at: string;
  image_paths?: string[] | null;
}

function getWorkflowLabels(t: (k: string) => string): Record<string, { label: string; color: string }> {
  return {
    single: { label: t("library.singleFrame"), color: "text-primary" },
    twoframe: { label: t("library.twoFrames"), color: "text-accent" },
    multishot: { label: t("library.multiShot"), color: "text-emerald-400" },
  };
}

function timeAgo(dateStr: string, t: (k: string) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("library.justNow");
  if (mins < 60) return `${mins}${t("library.minsAgo")}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${t("library.hrsAgo")}`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}${t("library.daysAgo")}`;
  return new Date(dateStr).toLocaleDateString();
}

function CopyButton({ text, label, copiedLabel, variant = "ghost" }: { text: string; label: string; copiedLabel: string; variant?: "ghost" | "outline" }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={handleCopy}
      className="h-7 px-2 text-xs gap-1 hover:bg-[#161618] hover:border-accent/40 hover:text-accent"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? copiedLabel : label}
    </Button>
  );
}

const SEQUENCE_RE = /^\s*\[?\s*(SEQUENCE|SCENE|SHOT)\b[^\]\n]*\]?\s*$/i;
function renderPromptWithSequenceHeaders(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (SEQUENCE_RE.test(line)) {
      return (
        <div key={i} className="text-accent font-semibold uppercase tracking-wider text-xs mt-2 first:mt-0">
          {line.trim()}
        </div>
      );
    }
    return <div key={i}>{line || "\u00A0"}</div>;
  });
}

function getMainPrompt(entry: HistoryEntry): string {
  const results: any[] = Array.isArray(entry.results) ? entry.results : [entry.results];
  return results[0]?.mainPrompt || "";
}

function buildAllText(entry: HistoryEntry, t: (k: string) => string): string {
  const results: any[] = Array.isArray(entry.results) ? entry.results : [entry.results];
  return results
    .map((r: any, i: number) => {
      let s = `${t("library.shot")} ${i + 1}\n${r.mainPrompt || ""}`;
      if (r.negativePrompt) s += `\n${t("library.negative")}: ${r.negativePrompt}`;
      if (r.cameraSuggestions) s += `\n${t("library.camera")}: ${r.cameraSuggestions}`;
      if (r.modelNotes) s += `\n${t("library.notes")}: ${r.modelNotes}`;
      return s;
    })
    .join("\n\n");
}

// ─────────────────────────────────────────────────────────
// Kebab actions menu (shared by card + row)
// ─────────────────────────────────────────────────────────

function CardKebab({
  onEdit,
  onDuplicate,
  onDelete,
}: {
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="h-6 w-6 inline-flex items-center justify-center rounded-md bg-black/60 backdrop-blur-sm border border-white/10 text-foreground/90 hover:text-foreground hover:bg-black/80 transition-colors"
          aria-label="More options"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
          <Pencil className="w-3.5 h-3.5 me-2" /> Edit in Studio
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
          <Files className="w-3.5 h-3.5 me-2" /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="w-3.5 h-3.5 me-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────────────────────────────────────
// Grid card
// ─────────────────────────────────────────────────────────

function HistoryCard({
  entry,
  t,
  onDelete,
  isExpanded,
  onToggle,
  onOpen,
  selectMode,
  selected,
  onToggleSelect,
  onEdit,
  onDuplicate,
}: {
  entry: HistoryEntry;
  t: (k: string) => string;
  onDelete: (id: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
}) {
  const [thumbUrls, setThumbUrls] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const workflowLabels = getWorkflowLabels(t);
  const wf = workflowLabels[entry.workflow_type] || workflowLabels.single;
  const mainPrompt = getMainPrompt(entry);
  const preview = mainPrompt.slice(0, 120);
  const modelLabel = friendlyModelLabel(entry.target_model);
  const family = modelFamily(entry.target_model);

  useEffect(() => {
    const paths = entry.image_paths?.slice(0, 4) || [];
    if (paths.length === 0) return;
    let cancelled = false;
    const resolveOne = async (raw: string): Promise<string | null> => {
      // Supports: absolute URL, "<bucket>:<path>", or bare path in legacy `generation-images` bucket.
      if (/^https?:\/\//i.test(raw)) return raw;
      let bucket = "generation-images";
      let path = raw;
      const idx = raw.indexOf(":");
      if (idx > 0) {
        const maybeBucket = raw.slice(0, idx);
        if (!maybeBucket.includes("/")) {
          bucket = maybeBucket;
          path = raw.slice(idx + 1);
        }
      }
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      return data?.signedUrl || null;
    };
    Promise.all(paths.map(resolveOne)).then((urls) => {
      if (!cancelled) setThumbUrls(urls.filter((u): u is string => !!u));
    });
    return () => { cancelled = true; };
  }, [entry.image_paths]);

  const totalRefs = entry.image_paths?.length ?? 0;
  const showComposite = thumbUrls.length > 1;
  const hasThumb = thumbUrls.length > 0;

  return (
    <Card
      className={`bg-card border-border overflow-hidden flex flex-col group transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_8px_24px_-12px_hsl(var(--accent)/0.35)] ${
        isExpanded ? "ring-2 ring-primary/40 shadow-lg" : ""
      } ${selected ? "ring-2 ring-accent/60" : ""}`}
    >
      {/* Media banner — click anywhere on media to open preview */}
      <div className="relative aspect-video w-full overflow-hidden">
        {/* click overlay sits behind floating UI; pills/kebab/checkbox use z-10 */}
        <button
          type="button"
          onClick={onOpen}
          aria-label="Open prompt preview"
          className="absolute inset-0 z-0 cursor-pointer"
        />
        {showComposite ? (
          <div className="grid grid-cols-2 grid-rows-2 gap-px w-full h-full bg-border/50 pointer-events-none">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-background/40 overflow-hidden">
                {thumbUrls[i] ? (
                  <img src={thumbUrls[i]} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : null}
              </div>
            ))}
          </div>
        ) : hasThumb ? (
          <img
            src={thumbUrls[0]}
            alt="Reference"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02] pointer-events-none"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full pointer-events-none">
            <CinematicPlaceholder
              family={family}
              workflow={entry.workflow_type}
              prompt={mainPrompt}
              seed={entry.id}
            />
          </div>
        )}

        {/* Workflow pill */}
        <div className="absolute top-2 start-2">
          <span
            className={`inline-flex items-center text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm border border-white/10 ${wf.color}`}
          >
            {wf.label}
          </span>
        </div>

        {/* Select checkbox top-left when in select mode */}
        {selectMode && (
          <div className="absolute top-2 start-2 ml-[6.5rem]">
            <div
              role="checkbox"
              aria-checked={selected}
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
              onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); onToggleSelect(); } }}
              className="h-6 w-6 inline-flex items-center justify-center rounded-md bg-black/70 backdrop-blur-sm border border-white/20 cursor-pointer"
              aria-label={selected ? "Deselect" : "Select"}
            >
              <Checkbox checked={selected} className="pointer-events-none" tabIndex={-1} />
            </div>
          </div>
        )}

        {/* Time + kebab top-right */}
        <div className="absolute top-2 end-2 flex items-center gap-1">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-foreground/90 border border-white/10">
            {timeAgo(entry.created_at, t)}
          </span>
          <CardKebab
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onDelete={() => setConfirmOpen(true)}
          />
        </div>

        {totalRefs > 4 && (
          <div className="absolute bottom-2 end-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-foreground border border-white/10">
              +{totalRefs - 4}
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-primary">
          {modelLabel}
        </span>
        <p className="text-[13px] leading-snug text-[#A1A1AA] line-clamp-3 min-h-[3.4rem]">
          {preview}{mainPrompt.length > 120 ? "…" : ""}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border bg-secondary/20">
        <Button variant="ghost" size="sm" onClick={onToggle} className="h-7 px-2 text-xs gap-1">
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          {isExpanded ? "Close" : t("library.viewPrompts" as any)}
        </Button>
        <CopyButton text={buildAllText(entry, t)} label={t("library.copyAll")} copiedLabel={t("library.copied")} />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this prompt?</AlertDialogTitle>
            <AlertDialogDescription>
              This prompt will be permanently removed from your library. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onDelete(entry.id); setConfirmOpen(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// List row
// ─────────────────────────────────────────────────────────

function HistoryRow({
  entry,
  t,
  selectMode,
  selected,
  onToggleSelect,
  onOpen,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  entry: HistoryEntry;
  t: (k: string) => string;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: (id: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const workflowLabels = getWorkflowLabels(t);
  const wf = workflowLabels[entry.workflow_type] || workflowLabels.single;
  const mainPrompt = getMainPrompt(entry);
  const preview = mainPrompt.slice(0, 200);
  const modelLabel = friendlyModelLabel(entry.target_model);
  const family = modelFamily(entry.target_model);

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card hover:bg-secondary/30 hover:border-accent/30 transition-all ${
        selected ? "border-accent/60 ring-1 ring-accent/30" : "border-border"
      }`}
    >
      {selectMode && (
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
      )}
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 w-10 h-10 rounded-md overflow-hidden border border-border/60"
        aria-label="Open preview"
      >
        <CinematicPlaceholder family={family} workflow={entry.workflow_type} prompt={mainPrompt} seed={entry.id} />
      </button>
      <span
        className={`shrink-0 inline-flex items-center text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded-md bg-secondary/60 ${wf.color}`}
      >
        {wf.label}
      </span>
      <span className="shrink-0 w-28 truncate text-[11px] font-mono uppercase tracking-wider text-primary">
        {modelLabel}
      </span>
      <button
        onClick={onOpen}
        className="flex-1 text-start text-[12px] font-mono text-muted-foreground line-clamp-1 hover:text-foreground transition-colors"
      >
        {preview}{mainPrompt.length > 200 ? "…" : ""}
      </button>
      <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
        {timeAgo(entry.created_at, t)}
      </span>
      <CopyButton text={buildAllText(entry, t)} label={t("library.copy")} copiedLabel={t("library.copied")} />
      <CardKebab
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={() => setConfirmOpen(true)}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this prompt?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onDelete(entry.id); setConfirmOpen(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Expanded modal (unchanged)
// ─────────────────────────────────────────────────────────

function PromptSection({
  title,
  body,
  variant = "default",
  copyLabel,
  copiedLabel,
  renderHeaders = false,
}: {
  title: string;
  body: string;
  variant?: "default" | "notes";
  copyLabel: string;
  copiedLabel: string;
  renderHeaders?: boolean;
}) {
  const isNotes = variant === "notes";
  return (
    <section
      className={`rounded-lg border p-6 ${
        isNotes ? "bg-[#0F0E0C] border-t border-[#27272A] border-accent/15" : "bg-secondary/30 border-border"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-[11px] font-semibold uppercase tracking-wider ${isNotes ? "text-muted-foreground" : "text-foreground/80"}`}>
          {title}
        </h3>
        <CopyButton text={body} label={copyLabel} copiedLabel={copiedLabel} />
      </div>
      <div className={`text-sm leading-relaxed whitespace-pre-wrap ${isNotes ? "text-muted-foreground italic" : "text-foreground/90"}`}>
        {renderHeaders ? renderPromptWithSequenceHeaders(body) : body}
      </div>
    </section>
  );
}

function ExpandedPromptModal({
  entry,
  t,
  open,
  onClose,
}: {
  entry: HistoryEntry | null;
  t: (k: string) => string;
  open: boolean;
  onClose: () => void;
}) {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const results: any[] = entry ? (Array.isArray(entry.results) ? entry.results : [entry.results]) : [];

  useEffect(() => {
    if (!entry?.image_paths?.length) {
      setImageUrls([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      entry.image_paths.map((p) =>
        supabase.storage.from("generation-images").createSignedUrl(p, 3600).then(({ data }) => data?.signedUrl || null),
      ),
    ).then((urls) => {
      if (!cancelled) setImageUrls(urls.filter((u): u is string => !!u));
    });
    return () => { cancelled = true; };
  }, [entry?.id, entry?.image_paths]);

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[800px] max-h-[90vh] overflow-y-auto p-0 gap-0 bg-[#0F0F11] border border-accent/20">
        <DialogClose className="absolute right-4 top-4 z-10 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-[#161618] transition-colors">
          <X className="w-4 h-4" />
          <span className="sr-only">Close</span>
        </DialogClose>

        <div className="p-6 sm:p-8 space-y-4">
          <div className="space-y-1 pe-10">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-primary">
              {friendlyModelLabel(entry.target_model)}
            </p>
            <h2 className="text-lg font-semibold font-display">{t("library.viewPrompts" as any)}</h2>
          </div>

          {imageUrls.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {imageUrls.map((url, i) => (
                <img key={i} src={url} alt={`Reference frame ${i + 1}`} className="w-20 h-20 rounded-md object-cover border border-border shrink-0" />
              ))}
            </div>
          )}

          {results.map((shot: any, i: number) => {
            const charLimit = shot.charLimit as number | undefined;
            const originalLength = shot.originalLength as number | undefined;
            const trimmedLength = (shot.mainPrompt || "").length;
            const wasTrimmed = typeof charLimit === "number" && typeof originalLength === "number" && originalLength > trimmedLength;
            return (
              <div key={i} className="space-y-4">
                {results.length > 1 && (
                  <p className="text-accent font-semibold uppercase tracking-wider text-xs">
                    {t("library.shot")} {i + 1}
                  </p>
                )}
                {wasTrimmed && (
                  <div className="rounded-md border border-accent/30 bg-accent/10 p-3 flex gap-2 items-start">
                    <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <p className="text-xs text-accent-foreground/90 leading-relaxed">
                      Auto-trimmed from {originalLength} to {charLimit} chars to fit{" "}
                      {friendlyModelLabel(entry.target_model)} input limit.
                    </p>
                  </div>
                )}
                {shot.mainPrompt && (
                  <PromptSection title={t("results.mainPrompt")} body={shot.mainPrompt} copyLabel={t("library.copy")} copiedLabel={t("library.copied")} renderHeaders />
                )}
                {shot.negativePrompt && (
                  <PromptSection title={t("results.negativePrompt")} body={shot.negativePrompt} copyLabel={t("library.copy")} copiedLabel={t("library.copied")} />
                )}
                {shot.cameraSuggestions && (
                  <PromptSection title={t("results.cameraSuggestions")} body={shot.cameraSuggestions} copyLabel={t("library.copy")} copiedLabel={t("library.copied")} />
                )}
                {shot.modelNotes && (
                  <PromptSection title={t("results.modelNotes")} body={shot.modelNotes} variant="notes" copyLabel={t("library.copy")} copiedLabel={t("library.copied")} />
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────
// Filter pill
// ─────────────────────────────────────────────────────────

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
        active
          ? "bg-accent text-accent-foreground border-accent"
          : "border-accent/40 text-accent bg-transparent hover:bg-accent/10"
      }`}
    >
      {active && <Check className="w-3 h-3" />}
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────

type SortKey = "newest" | "oldest" | "alpha" | "model" | "workflow";
const SORT_LABEL: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  alpha: "Alphabetical (A–Z)",
  model: "By model",
  workflow: "By workflow",
};

const Library = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") === "videos" ? "videos" : "prompts") as "prompts" | "videos";
  const setTab = (next: "prompts" | "videos") => {
    const sp = new URLSearchParams(searchParams);
    if (next === "prompts") sp.delete("tab");
    else sp.set("tab", next);
    setSearchParams(sp, { replace: true });
  };
  const [videoCount, setVideoCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("video_jobs")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setVideoCount(count ?? 0));
  }, [user]);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState<string | null>(null);
  const [familyFilter, setFamilyFilter] = useState<ModelFamily | null>(null);
  const [variantFilter, setVariantFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [view, setView] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "grid";
    return (localStorage.getItem("library:view") as "grid" | "list") || "grid";
  });
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("library:view", view);
  }, [view]);

  useEffect(() => {
    trackPageVisit("/library");
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from("prompt_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setHistory((data as HistoryEntry[]) || []);
      }
      setLoading(false);
    };
    fetchHistory();
  }, [user, authLoading, navigate]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("prompt_history").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setHistory((prev) => prev.filter((e) => e.id !== id));
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const { error } = await supabase.from("prompt_history").delete().in("id", ids);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setHistory((prev) => prev.filter((e) => !selectedIds.has(e.id)));
      setSelectedIds(new Set());
      setSelectMode(false);
      toast({ title: "Deleted", description: `${ids.length} prompt${ids.length === 1 ? "" : "s"} removed.` });
    }
    setBulkConfirmOpen(false);
  };

  const handleEdit = (entry: HistoryEntry) => {
    navigate("/", { state: { restorePrompt: getMainPrompt(entry), restoreModel: entry.target_model } });
  };

  const handleDuplicate = async (entry: HistoryEntry) => {
    await navigator.clipboard.writeText(buildAllText(entry, t));
    toast({ title: "Copied", description: "Prompt copied to clipboard." });
  };

  // Family selection resets variant
  const onFamilyClick = (f: ModelFamily | null) => {
    setFamilyFilter(f);
    setVariantFilter(null);
  };

  const filtered = useMemo(() => {
    return history.filter((entry) => {
      if (workflowFilter && entry.workflow_type !== workflowFilter) return false;
      if (familyFilter && modelFamily(entry.target_model) !== familyFilter) return false;
      if (variantFilter && entry.target_model !== variantFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const results: any[] = Array.isArray(entry.results) ? entry.results : [entry.results];
        const text = results.map((r: any) => r.mainPrompt || "").join(" ").toLowerCase();
        if (!text.includes(q) && !entry.target_model.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [history, workflowFilter, familyFilter, variantFilter, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "alpha":
          return getMainPrompt(a).localeCompare(getMainPrompt(b));
        case "model":
          return friendlyModelLabel(a.target_model).localeCompare(friendlyModelLabel(b.target_model));
        case "workflow":
          return a.workflow_type.localeCompare(b.workflow_type);
        case "newest":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return arr;
  }, [filtered, sortBy]);

  const activeFilterCount =
    (workflowFilter ? 1 : 0) + (familyFilter ? 1 : 0) + (variantFilter ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0 || !!search.trim();

  const variantsAvailable = familyFilter ? variantsForFamily(familyFilter) : [];

  // Workflow row
  const workflowEntries = Object.entries(getWorkflowLabels(t));

  // Which families actually appear in the user's library? (Always show all five for clarity.)
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <Seo
        title="Your prompt library — MovPrompt"
        description="Browse, search, and reuse every cinematic AI video prompt you've generated with MovPrompt."
        path="/library"
        noindex
      />

      <div className="relative z-10 container max-w-7xl mx-auto px-4 py-4 sm:py-6">
        {/* Page header */}
        <div className="mb-5 text-center sm:text-start">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tab === "videos"
              ? "Every video you've rendered. Download, share, or remix."
              : "Every prompt you've generated, ready to use again."}
          </p>
        </div>

        {/* Tab toggle — amber active */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-1 rounded-full bg-secondary/40 border border-border p-1">
            <button
              type="button"
              onClick={() => setTab("prompts")}
              className={`px-4 h-8 text-xs font-medium rounded-full transition-colors ${
                tab === "prompts"
                  ? "bg-accent/15 text-accent border border-accent/60"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              Prompts {history.length > 0 && <span className="opacity-70">({history.length})</span>}
            </button>
            <button
              type="button"
              onClick={() => setTab("videos")}
              className={`px-4 h-8 text-xs font-medium rounded-full transition-colors ${
                tab === "videos"
                  ? "bg-accent/15 text-accent border border-accent/60"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              Videos {videoCount !== null && videoCount > 0 && <span className="opacity-70">({videoCount})</span>}
            </button>
          </div>
        </div>

        {tab === "videos" ? (
          <VideosTab />
        ) : (
          <>
            {/* Search + Sort + View + Select */}
            {!loading && history.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 mb-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t("library.searchPlaceholder")}
                      className="ps-9 pe-9 bg-secondary/30 border-border"
                    />
                    {search && (
                      <button onClick={() => setSearch("")} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="inline-flex items-center rounded-md border border-border bg-secondary/30 p-0.5 h-10">
                    <button
                      type="button"
                      onClick={() => setView("grid")}
                      aria-label="Grid view"
                      title="Grid view"
                      className={`h-9 w-9 inline-flex items-center justify-center rounded-[5px] transition-colors ${
                        view === "grid"
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <LayoutGrid className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("list")}
                      aria-label="List view"
                      title="List view"
                      className={`h-9 w-9 inline-flex items-center justify-center rounded-[5px] transition-colors ${
                        view === "list"
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <ListIcon className="w-5 h-5" />
                    </button>
                  </div>

                  <Button
                    variant={selectMode ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => { setSelectMode((v) => !v); setSelectedIds(new Set()); }}
                    className="h-10 text-xs gap-1.5"
                  >
                    {selectMode ? (
                      <>Cancel</>
                    ) : (
                      <><span className="inline-block h-3.5 w-3.5 rounded border border-current" /> Select multiple</>
                    )}
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="text-xs gap-1.5 shrink-0 h-10">
                        {SORT_LABEL[sortBy]}
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                        <DropdownMenuItem key={k} onClick={() => setSortBy(k)}>
                          {SORT_LABEL[k]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Grouped filter rows */}
                <div className="space-y-2">
                  {/* Workflow */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-16 shrink-0">
                      Workflow
                    </span>
                    <FilterPill active={workflowFilter === null} onClick={() => setWorkflowFilter(null)}>
                      All
                    </FilterPill>
                    {workflowEntries.map(([key, wf]) => (
                      <FilterPill
                        key={key}
                        active={workflowFilter === key}
                        onClick={() => setWorkflowFilter(workflowFilter === key ? null : key)}
                      >
                        {wf.label}
                      </FilterPill>
                    ))}
                  </div>

                  {/* Model family */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-16 shrink-0">
                      Model
                    </span>
                    <FilterPill active={familyFilter === null} onClick={() => onFamilyClick(null)}>
                      All
                    </FilterPill>
                    {ALL_FAMILIES.map((f) => (
                      <FilterPill
                        key={f}
                        active={familyFilter === f}
                        onClick={() => onFamilyClick(familyFilter === f ? null : f)}
                      >
                        {FAMILY_META[f].label}
                      </FilterPill>
                    ))}
                  </div>

                  {/* Variant — conditional */}
                  {familyFilter && variantsAvailable.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-16 shrink-0">
                        Variant
                      </span>
                      <FilterPill active={variantFilter === null} onClick={() => setVariantFilter(null)}>
                        All
                      </FilterPill>
                      {variantsAvailable.map((v) => (
                        <FilterPill
                          key={v.value}
                          active={variantFilter === v.value}
                          onClick={() => setVariantFilter(variantFilter === v.value ? null : v.value)}
                        >
                          {v.label}
                        </FilterPill>
                      ))}
                    </div>
                  )}

                  {hasActiveFilters && (
                    <button
                      onClick={() => { setSearch(""); setWorkflowFilter(null); setFamilyFilter(null); setVariantFilter(null); }}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Clear filters
                      {activeFilterCount > 0 && (
                        <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{activeFilterCount}</Badge>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Bulk action bar */}
            {selectMode && selectedIds.size > 0 && (
              <div className="sticky top-16 z-20 mb-4 rounded-lg border border-accent/40 bg-accent/10 backdrop-blur px-3 py-2 flex items-center gap-3">
                <span className="text-xs font-medium text-accent">
                  {selectedIds.size} selected
                </span>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setBulkConfirmOpen(true)}
                  className="h-8 text-xs"
                >
                  <Trash2 className="w-3.5 h-3.5 me-1.5" /> Delete
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
              </div>
            )}

            {/* Content */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-primary" />
                </div>
                <p className="text-muted-foreground">You haven't generated any prompts yet.</p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => navigate("/")} size="sm">
                    Open Studio
                  </Button>
                  <Button onClick={() => navigate("/ads")} size="sm" variant="outline">
                    Open Ads
                  </Button>
                </div>
              </motion.div>
            ) : filtered.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 space-y-3">
                <p className="text-muted-foreground">
                  {search.trim()
                    ? <>No results for <span className="text-foreground">"{search}"</span>.</>
                    : "No prompts match these filters. Try removing some."}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSearch(""); setWorkflowFilter(null); setFamilyFilter(null); setVariantFilter(null); }}
                >
                  Clear filters
                </Button>
              </motion.div>
            ) : view === "grid" ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>
                    {hasActiveFilters
                      ? <>Showing <span className="text-foreground font-medium">{sorted.length}</span> of {history.length} prompts.{" "}
                          <button onClick={() => { setSearch(""); setWorkflowFilter(null); setFamilyFilter(null); setVariantFilter(null); }} className="text-accent hover:underline">Clear filters</button>
                        </>
                      : <>Showing <span className="text-foreground font-medium">{sorted.length}</span> prompts</>}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {sorted.map((entry) => {
                    const isExpanded = expandedId === entry.id;
                    return (
                      <HistoryCard
                        key={entry.id}
                        entry={entry}
                        t={t}
                        onDelete={handleDelete}
                        isExpanded={isExpanded}
                        onToggle={() => setExpandedId(isExpanded ? null : entry.id)}
                        onOpen={() => setExpandedId(entry.id)}
                        selectMode={selectMode}
                        selected={selectedIds.has(entry.id)}
                        onToggleSelect={() => setSelectedIds((prev) => {
                          const n = new Set(prev);
                          if (n.has(entry.id)) n.delete(entry.id); else n.add(entry.id);
                          return n;
                        })}
                        onEdit={() => handleEdit(entry)}
                        onDuplicate={() => handleDuplicate(entry)}
                      />
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1 mb-1">
                  <span>
                    {hasActiveFilters
                      ? <>Showing <span className="text-foreground font-medium">{sorted.length}</span> of {history.length} prompts.{" "}
                          <button onClick={() => { setSearch(""); setWorkflowFilter(null); setFamilyFilter(null); setVariantFilter(null); }} className="text-accent hover:underline">Clear filters</button>
                        </>
                      : <>Showing <span className="text-foreground font-medium">{sorted.length}</span> prompts</>}
                  </span>
                </div>
                {sorted.map((entry) => (
                  <HistoryRow
                    key={entry.id}
                    entry={entry}
                    t={t}
                    selectMode={selectMode}
                    selected={selectedIds.has(entry.id)}
                    onToggleSelect={() => setSelectedIds((prev) => {
                      const n = new Set(prev);
                      if (n.has(entry.id)) n.delete(entry.id); else n.add(entry.id);
                      return n;
                    })}
                    onOpen={() => setExpandedId(entry.id)}
                    onEdit={() => handleEdit(entry)}
                    onDuplicate={() => handleDuplicate(entry)}
                    onDelete={handleDelete}
                  />
                ))}
              </motion.div>
            )}

            <ExpandedPromptModal
              entry={sorted.find((e) => e.id === expandedId) || null}
              t={t}
              open={!!expandedId}
              onClose={() => setExpandedId(null)}
            />

            <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selectedIds.size} prompt{selectedIds.size === 1 ? "" : "s"}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    These prompts will be permanently removed. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBulkDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
};

export default Library;
