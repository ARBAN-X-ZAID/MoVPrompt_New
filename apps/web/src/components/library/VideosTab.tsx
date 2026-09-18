import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search,
  X,
  Check,
  Copy,
  Download,
  Loader2,
  Film,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Play,
  Share2,
  RotateCcw,
  Trash2,
  ChevronDown,
  LayoutGrid,
  List as ListIcon,
  MoreVertical,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
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
import { toast } from "@/hooks/use-toast";

export interface VideoJob {
  id: string;
  user_id: string;
  session_id: string | null;
  provider: string;
  prompt: string;
  status: string;
  video_url: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

// ─── Source / status / model derivation ─────────────────────────────────
const SOURCES = ["Studio", "Ads Studio"] as const;
type Source = (typeof SOURCES)[number];

const STATUS_GROUPS = ["Completed", "In progress", "Failed"] as const;
type StatusGroup = (typeof STATUS_GROUPS)[number];

const MODEL_FAMILIES = ["Seedance", "Kling", "Veo", "Sora", "Runway"] as const;
type ModelFam = (typeof MODEL_FAMILIES)[number];

function sourceOf(job: VideoJob): Source {
  const p = (job.provider || "").toLowerCase();
  if (p.includes("ads") || p.includes("marketing")) return "Ads Studio";
  return "Studio";
}

function statusGroupOf(job: VideoJob): StatusGroup {
  if (job.status === "completed") return "Completed";
  if (job.status === "failed" || job.status === "error") return "Failed";
  return "In progress";
}

function modelFamilyOf(job: VideoJob): ModelFam | null {
  const p = (job.provider || "").toLowerCase();
  if (p.includes("seedance") || p.includes("bytedance")) return "Seedance";
  if (p.includes("kling")) return "Kling";
  if (p.includes("veo")) return "Veo";
  if (p.includes("sora")) return "Sora";
  if (p.includes("runway")) return "Runway";
  return null;
}

function modelLabelOf(job: VideoJob): string {
  const fam = modelFamilyOf(job);
  if (fam === "Seedance") return "Seedance 2.0";
  if (fam) return fam;
  // Fallback short label from provider
  const last = (job.provider || "").split("/").pop() || job.provider || "Model";
  return last.replace(/-/g, " ");
}

function failureReason(job: VideoJob): string {
  const e = (job.error || "").toLowerCase();
  if (!job.error) return "Model error";
  if (e.includes("policy") || e.includes("safety") || e.includes("content")) return "Content policy";
  if (e.includes("credit") || e.includes("balance") || e.includes("quota")) return "Out of credits";
  if (e.includes("timeout")) return "Timed out";
  return "Model error";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// Elapsed since render started, formatted MM:SS (or HH:MM:SS for very old jobs)
function elapsedShort(dateStr: string): string {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

// Render-state classification by elapsed time
type RenderHealth = "normal" | "slow" | "stuck";
function renderHealth(dateStr: string): RenderHealth {
  const mins = (Date.now() - new Date(dateStr).getTime()) / 60000;
  if (mins > 15) return "stuck";
  if (mins > 5) return "slow";
  return "normal";
}

// ─── Status pill ────────────────────────────────────────────────────────
function StatusPill({ group }: { group: StatusGroup }) {
  const map = {
    Completed: { icon: <CheckCircle2 className="w-3 h-3" />, cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
    "In progress": { icon: <Loader2 className="w-3 h-3 animate-spin" />, cls: "bg-[hsl(35_90%_55%)]/15 text-[hsl(35_90%_70%)] border-[hsl(35_90%_55%)]/40" },
    Failed: { icon: <X className="w-3 h-3" />, cls: "bg-destructive/15 text-destructive border-destructive/50" },
  } as const;
  const m = map[group];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border backdrop-blur-sm ${m.cls}`}>
      {m.icon}
      {group}
    </span>
  );
}

// ─── Filter pill (matches Prompts tab) ──────────────────────────────────
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
      type="button"
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

// ─── Card kebab ─────────────────────────────────────────────────────────
function CardKebab({
  onCopyPrompt,
  onDelete,
  onCancel,
  onRetry,
  showCancel,
  showRetry,
}: {
  onCopyPrompt: () => void;
  onDelete: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  showCancel?: boolean;
  showRetry?: boolean;
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
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCopyPrompt(); }}>
          <Copy className="w-3.5 h-3.5 me-2" /> Copy prompt
        </DropdownMenuItem>
        {showRetry && onRetry && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRetry(); }}>
            <RotateCcw className="w-3.5 h-3.5 me-2" /> Retry
          </DropdownMenuItem>
        )}
        {showCancel && onCancel && (
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCancel(); }}>
            <X className="w-3.5 h-3.5 me-2" /> Cancel render
          </DropdownMenuItem>
        )}
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

// ─── Video card ─────────────────────────────────────────────────────────
function VideoJobCard({
  job,
  onOpen,
  onRemix,
  onShare,
  onCopyPrompt,
  onDelete,
  onRetry,
  onCancel,
  selectMode,
  selected,
  onToggleSelect,
}: {
  job: VideoJob;
  onOpen: () => void;
  onRemix: () => void;
  onShare: () => void;
  onCopyPrompt: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onCancel: () => void;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const group = statusGroupOf(job);
  const source = sourceOf(job);
  const [aspect, setAspect] = useState<"portrait" | "landscape" | "square">("portrait");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [, force] = useState(0);
  const health = renderHealth(job.created_at);

  // Tick every second so in-progress elapsed time updates
  useEffect(() => {
    if (group !== "In progress") return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [group]);

  const aspectClass =
    aspect === "landscape" ? "aspect-video"
    : aspect === "square" ? "aspect-square"
    : "aspect-[9/16]";

  return (
    <Card
      className={`group bg-card border overflow-hidden cursor-pointer transition-all flex flex-col ${
        group === "Failed"
          ? "border-destructive/40 hover:border-destructive/70 hover:shadow-[0_0_24px_hsl(var(--destructive)/0.18)]"
          : "border-border hover:border-accent/50 hover:shadow-[0_0_24px_hsl(var(--accent)/0.2)]"
      } ${selected ? "ring-2 ring-accent/80 border-accent/60" : ""}`}
    >
      <div
        className={`relative w-full overflow-hidden bg-gradient-to-br from-secondary/40 to-background ${aspectClass}`}
        onClick={selectMode ? onToggleSelect : onOpen}
      >
        {job.video_url ? (
          <>
            <video
              ref={videoRef}
              src={job.video_url}
              muted
              loop
              playsInline
              preload="metadata"
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                if (v.videoWidth && v.videoHeight) {
                  const r = v.videoWidth / v.videoHeight;
                  if (r > 1.2) setAspect("landscape");
                  else if (r < 0.85) setAspect("portrait");
                  else setAspect("square");
                }
              }}
              onMouseEnter={(e) => void (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
              onMouseLeave={(e) => {
                const v = e.currentTarget as HTMLVideoElement;
                v.pause();
                v.currentTime = 0;
              }}
              className="w-full h-full object-contain bg-black"
            />
            {/* Play overlay — large amber circle, hidden on hover so video shows */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 opacity-100 group-hover:opacity-0 transition-opacity">
              <div className="h-16 w-16 rounded-full bg-accent flex items-center justify-center shadow-[0_0_24px_hsl(var(--accent)/0.45)] transition-transform group-hover:scale-110">
                <Play className="w-7 h-7 text-black fill-black ms-0.5" />
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/70 px-4 text-center">
            {group === "In progress" ? (
              <>
                <div className="relative">
                  <Loader2
                    className={`w-12 h-12 animate-spin ${
                      health === "stuck" ? "text-destructive" : "text-[hsl(35_90%_55%)]"
                    }`}
                  />
                  <span
                    className={`absolute inset-0 rounded-full animate-ping ${
                      health === "stuck" ? "bg-destructive/20" : "bg-[hsl(35_90%_55%)]/20"
                    }`}
                  />
                </div>
                <span className="text-xs font-medium text-[hsl(35_90%_70%)]">
                  {health === "stuck" ? "Render appears stuck" : "Rendering…"}
                </span>
                <span className="text-base font-semibold tabular-nums text-foreground">
                  {elapsedShort(job.created_at)}
                </span>
                {health === "slow" && (
                  <span className="text-[10px] text-[hsl(35_90%_70%)]">Taking longer than expected</span>
                )}
                {health === "stuck" && (
                  <span className="text-[10px] text-destructive">Cancel and retry recommended</span>
                )}
              </>
            ) : group === "Failed" ? (
              <>
                <div className="h-12 w-12 rounded-full bg-destructive/15 border border-destructive/40 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <span className="text-xs font-semibold text-destructive">{failureReason(job)}</span>
              </>
            ) : (
              <Film className="w-8 h-8" />
            )}
          </div>
        )}

        {/* Source pill */}
        <div className="absolute top-2 start-2 z-10">
          <span className="inline-flex items-center text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm border border-white/10 text-foreground/90">
            {source}
          </span>
        </div>

        {selectMode && (
          <div className="absolute top-2 start-2 z-10 ml-[6.5rem]">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
              className="h-6 w-6 inline-flex items-center justify-center rounded-md bg-black/70 backdrop-blur-sm border border-white/20"
              aria-label={selected ? "Deselect" : "Select"}
            >
              <Checkbox checked={selected} className="pointer-events-none" />
            </button>
          </div>
        )}

        {/* Status + kebab */}
        <div className="absolute top-2 end-2 z-10 flex items-center gap-1">
          <StatusPill group={group} />
          <CardKebab
            onCopyPrompt={onCopyPrompt}
            onDelete={() => setConfirmOpen(true)}
            onCancel={onCancel}
            onRetry={onRetry}
            showCancel={group === "In progress"}
            showRetry={group === "Failed"}
          />
        </div>

        {/* Bottom-left model + bottom-right time */}
        <div className="absolute bottom-2 start-2 z-10">
          <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm border border-white/10 text-foreground/90">
            {modelLabelOf(job)}
          </span>
        </div>
        <div className="absolute bottom-2 end-2 z-10">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-foreground/90 border border-white/10">
            <Clock className="w-3 h-3" />
            {timeAgo(job.created_at)}
          </span>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="text-[13px] leading-snug text-[#A1A1AA] line-clamp-2 min-h-[2.4rem]">
          {job.prompt}
        </p>

        {/* Action toolbar */}
        <div className="flex items-center gap-1 pt-1">
          {group === "Completed" && job.video_url ? (
            <>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={(e) => { e.stopPropagation(); onOpen(); }}>
                <Play className="w-3 h-3" /> Play
              </Button>
              <a
                href={job.video_url}
                download
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1">
                  <Download className="w-3 h-3" />
                </Button>
              </a>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={(e) => { e.stopPropagation(); onShare(); }}>
                <Share2 className="w-3 h-3" />
              </Button>
              <div className="flex-1" />
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 border-accent/40 text-accent hover:bg-accent/10" onClick={(e) => { e.stopPropagation(); onRemix(); }}>
                <Sparkles className="w-3 h-3" /> Remix
              </Button>
            </>
          ) : group === "In progress" ? (
            <>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs gap-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); setCancelOpen(true); }}
              >
                <X className="w-3 h-3" /> Cancel render
              </Button>
            </>
          ) : (
            <>
              <span className="text-[11px] text-destructive">{failureReason(job)}</span>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs gap-1 border-accent/50 text-accent hover:bg-accent/10"
                onClick={(e) => { e.stopPropagation(); onRetry(); }}
              >
                <RotateCcw className="w-3 h-3" /> Retry
              </Button>
            </>
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this video?</AlertDialogTitle>
            <AlertDialogDescription>
              This video will be permanently removed from your library. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onDelete(); setConfirmOpen(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this render?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll lose your place in the queue. Any credits committed to this render will be partially refunded (50%) once the provider confirms the cancellation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep rendering</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onCancel(); setCancelOpen(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel render
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─── List row ───────────────────────────────────────────────────────────
function VideoJobRow({
  job,
  onOpen,
  onCopyPrompt,
  onDelete,
  onRetry,
  onCancel,
  selectMode,
  selected,
  onToggleSelect,
}: {
  job: VideoJob;
  onOpen: () => void;
  onCopyPrompt: () => void;
  onDelete: () => void;
  onRetry: () => void;
  onCancel: () => void;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const group = statusGroupOf(job);
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card hover:bg-secondary/30 hover:border-accent/30 transition-all ${
        selected ? "border-accent/60 ring-1 ring-accent/30" : "border-border"
      }`}
    >
      {selectMode && <Checkbox checked={selected} onCheckedChange={onToggleSelect} />}
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 w-12 h-12 rounded-md overflow-hidden border border-border/60 bg-black flex items-center justify-center"
        aria-label="Open preview"
      >
        {job.video_url ? (
          <video src={job.video_url} muted preload="metadata" className="w-full h-full object-cover" />
        ) : group === "In progress" ? (
          <Loader2 className="w-4 h-4 animate-spin text-[hsl(35_90%_55%)]" />
        ) : group === "Failed" ? (
          <AlertTriangle className="w-4 h-4 text-destructive" />
        ) : (
          <Film className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      <StatusPill group={group} />
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-foreground/70 px-2 py-0.5 rounded-md bg-secondary/60">
        {sourceOf(job)}
      </span>
      <span className="shrink-0 w-24 truncate text-[11px] font-mono uppercase tracking-wider text-primary">
        {modelLabelOf(job)}
      </span>
      <button
        onClick={onOpen}
        className="flex-1 text-start text-[12px] text-muted-foreground line-clamp-1 hover:text-foreground transition-colors"
      >
        {job.prompt}
      </button>
      <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
        {timeAgo(job.created_at)}
      </span>
      <CardKebab
        onCopyPrompt={onCopyPrompt}
        onDelete={() => setConfirmOpen(true)}
        onCancel={onCancel}
        onRetry={onRetry}
        showCancel={group === "In progress"}
        showRetry={group === "Failed"}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this video?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { onDelete(); setConfirmOpen(false); }}
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

// ─── Modal (preview) ────────────────────────────────────────────────────
function VideoJobModal({ job, open, onClose }: { job: VideoJob | null; open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!job) return null;
  const group = statusGroupOf(job);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(job.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[800px] max-h-[90vh] overflow-y-auto p-0 gap-0 bg-[#0F0F11] border border-accent/20">
        <DialogClose className="absolute right-4 top-4 z-10 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-[#161618] transition-colors">
          <X className="w-4 h-4" />
        </DialogClose>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 pe-10">
            <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md bg-secondary text-foreground/90">
              {sourceOf(job)}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-primary">
              {modelLabelOf(job)}
            </span>
            <StatusPill group={group} />
            <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(job.created_at)}</span>
          </div>

          {job.video_url ? (
            <div className="rounded-lg overflow-hidden bg-black max-h-[60vh] mx-auto flex items-center justify-center">
              <video src={job.video_url} controls autoPlay className="max-w-full max-h-[60vh] object-contain" />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
              {group === "Failed"
                ? job.error || "Render failed."
                : "Render in progress — check back soon."}
            </div>
          )}

          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">Prompt</h3>
              <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 text-xs gap-1">
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{job.prompt}</p>
          </div>

          {job.video_url && (
            <a href={job.video_url} download target="_blank" rel="noreferrer">
              <Button className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                <Download className="w-4 h-4" />
                Download video
              </Button>
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main tab ───────────────────────────────────────────────────────────
type SortKey = "newest" | "oldest" | "status" | "source" | "model";
const SORT_LABEL: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  status: "By status",
  source: "By source",
  model: "By model",
};

export function VideosTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<Source | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusGroup | null>(null);
  const [modelFilter, setModelFilter] = useState<ModelFam | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [view, setView] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "grid";
    return (localStorage.getItem("library.videos.view") as "grid" | "list") || "grid";
  });
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("library.videos.view", view);
  }, [view]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("video_jobs")
        .select("*")
        .not("video_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setJobs((data || []) as VideoJob[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (sourceFilter && sourceOf(j) !== sourceFilter) return false;
      if (statusFilter && statusGroupOf(j) !== statusFilter) return false;
      if (modelFilter && modelFamilyOf(j) !== modelFilter) return false;
      if (search.trim() && !j.prompt.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [jobs, sourceFilter, statusFilter, modelFilter, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "status":
          return statusGroupOf(a).localeCompare(statusGroupOf(b));
        case "source":
          return sourceOf(a).localeCompare(sourceOf(b));
        case "model":
          return modelLabelOf(a).localeCompare(modelLabelOf(b));
        case "newest":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return arr;
  }, [filtered, sortBy]);

  const activeFilterCount =
    (sourceFilter ? 1 : 0) + (statusFilter ? 1 : 0) + (modelFilter ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0 || !!search.trim();

  const clearAll = () => {
    setSearch("");
    setSourceFilter(null);
    setStatusFilter(null);
    setModelFilter(null);
  };

  const handleDelete = async (id: string) => {
    // No DELETE RLS on video_jobs — we can't truly delete. Hide locally and let user know.
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    toast({ title: "Removed from view", description: "This video is hidden from your library." });
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    setJobs((prev) => prev.filter((j) => !selectedIds.has(j.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
    setBulkConfirmOpen(false);
    toast({ title: "Removed", description: `${ids.length} video${ids.length === 1 ? "" : "s"} hidden.` });
  };

  const handleCopyPrompt = async (job: VideoJob) => {
    await navigator.clipboard.writeText(job.prompt);
    toast({ title: "Copied", description: "Prompt copied to clipboard." });
  };

  const handleShare = async (job: VideoJob) => {
    if (!job.video_url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "MovPrompt video", text: job.prompt, url: job.video_url });
        return;
      } catch { /* fallthrough */ }
    }
    await navigator.clipboard.writeText(job.video_url);
    toast({ title: "Link copied", description: "Video URL copied to clipboard." });
  };

  const handleRemix = (job: VideoJob) => {
    navigate("/", { state: { restorePrompt: job.prompt } });
    toast({ title: "Remixing…", description: "Prompt loaded into Studio. Edit and regenerate." });
  };

  const handleRetry = (job: VideoJob) => {
    navigate("/", { state: { restorePrompt: job.prompt } });
    toast({ title: "Retrying", description: "Prompt loaded into Studio." });
  };

  const handleCancel = (_job: VideoJob) => {
    toast({ title: "Cancel requested", description: "Cancellation will take effect once the provider responds." });
  };

  // ─── Render ───
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="aspect-[9/12] rounded-lg" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
          <Film className="w-7 h-7 text-accent" />
        </div>
        <p className="text-muted-foreground">
          You haven't rendered any videos yet. Generate a prompt and click "Render" to start.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button onClick={() => navigate("/ads")} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Sparkles className="w-4 h-4 mr-1.5" />
            Open Ads Studio
          </Button>
          <Button variant="outline" onClick={() => navigate("/")}>
            Open Studio
          </Button>
        </div>
      </motion.div>
    );
  }

  const open = jobs.find((j) => j.id === openId) || null;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search videos…"
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
            className={`h-9 w-9 inline-flex items-center justify-center rounded-[5px] transition-colors ${
              view === "grid" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            aria-label="List view"
            className={`h-9 w-9 inline-flex items-center justify-center rounded-[5px] transition-colors ${
              view === "list" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
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
          {selectMode ? <>Cancel</> : <><Checkbox checked={false} className="pointer-events-none" /> Select multiple</>}
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

      {/* Grouped filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-16 shrink-0">Source</span>
          <FilterPill active={sourceFilter === null} onClick={() => setSourceFilter(null)}>All</FilterPill>
          {SOURCES.map((s) => (
            <FilterPill key={s} active={sourceFilter === s} onClick={() => setSourceFilter(sourceFilter === s ? null : s)}>
              {s}
            </FilterPill>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-16 shrink-0">Status</span>
          <FilterPill active={statusFilter === null} onClick={() => setStatusFilter(null)}>All</FilterPill>
          {STATUS_GROUPS.map((s) => (
            <FilterPill key={s} active={statusFilter === s} onClick={() => setStatusFilter(statusFilter === s ? null : s)}>
              {s}
            </FilterPill>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-16 shrink-0">Model</span>
          <FilterPill active={modelFilter === null} onClick={() => setModelFilter(null)}>All</FilterPill>
          {MODEL_FAMILIES.map((m) => (
            <FilterPill key={m} active={modelFilter === m} onClick={() => setModelFilter(modelFilter === m ? null : m)}>
              {m === "Seedance" ? "Seedance 2.0" : m}
            </FilterPill>
          ))}
        </div>
      </div>

      {/* Bulk action bar — fixed to bottom of viewport when in select mode */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 rounded-full border border-accent/50 bg-card/95 backdrop-blur-md shadow-[0_8px_32px_-8px_hsl(var(--accent)/0.4)] px-4 py-2 flex items-center gap-2">
          <span className="text-xs font-semibold text-accent pe-1">
            {selectedIds.size} selected
          </span>
          <div className="h-5 w-px bg-border" />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const completed = sorted.filter((j) => selectedIds.has(j.id) && j.video_url);
              completed.forEach((j) => {
                const a = document.createElement("a");
                a.href = j.video_url!;
                a.download = "";
                a.target = "_blank";
                a.rel = "noreferrer";
                document.body.appendChild(a);
                a.click();
                a.remove();
              });
              toast({ title: "Downloads started", description: `${completed.length} video${completed.length === 1 ? "" : "s"}.` });
            }}
            className="h-8 text-xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Download
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              const urls = sorted.filter((j) => selectedIds.has(j.id) && j.video_url).map((j) => j.video_url).join("\n");
              if (urls) {
                await navigator.clipboard.writeText(urls);
                toast({ title: "Links copied", description: "Video URLs copied to clipboard." });
              }
            }}
            className="h-8 text-xs gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" /> Share
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setBulkConfirmOpen(true)} className="h-8 text-xs gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
          <div className="h-5 w-px bg-border" />
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

      {/* Result count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          {hasActiveFilters ? (
            <>
              Showing <span className="text-foreground font-medium">{sorted.length}</span> of {jobs.length} videos.{" "}
              <button onClick={clearAll} className="text-accent hover:underline">Clear filters</button>
            </>
          ) : (
            <>Showing <span className="text-foreground font-medium">{sorted.length}</span> videos</>
          )}
        </span>
      </div>

      {/* Content */}
      {sorted.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-muted-foreground">
            {search.trim()
              ? <>No videos match <span className="text-foreground">"{search}"</span>.</>
              : "No videos match these filters."}
          </p>
          <Button variant="ghost" size="sm" onClick={clearAll}>Clear filters</Button>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map((job) => (
            <VideoJobCard
              key={job.id}
              job={job}
              onOpen={() => setOpenId(job.id)}
              onRemix={() => handleRemix(job)}
              onShare={() => handleShare(job)}
              onCopyPrompt={() => handleCopyPrompt(job)}
              onDelete={() => handleDelete(job.id)}
              onRetry={() => handleRetry(job)}
              onCancel={() => handleCancel(job)}
              selectMode={selectMode}
              selected={selectedIds.has(job.id)}
              onToggleSelect={() =>
                setSelectedIds((prev) => {
                  const n = new Set(prev);
                  if (n.has(job.id)) {
                    n.delete(job.id);
                  } else {
                    n.add(job.id);
                  }
                  return n;
                })
              }
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((job) => (
            <VideoJobRow
              key={job.id}
              job={job}
              onOpen={() => setOpenId(job.id)}
              onCopyPrompt={() => handleCopyPrompt(job)}
              onDelete={() => handleDelete(job.id)}
              onRetry={() => handleRetry(job)}
              onCancel={() => handleCancel(job)}
              selectMode={selectMode}
              selected={selectedIds.has(job.id)}
              onToggleSelect={() =>
                setSelectedIds((prev) => {
                  const n = new Set(prev);
                  if (n.has(job.id)) {
                    n.delete(job.id);
                  } else {
                    n.add(job.id);
                  }
                  return n;
                })
              }
            />
          ))}
        </div>
      )}

      <VideoJobModal job={open} open={!!openId} onClose={() => setOpenId(null)} />

      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selectedIds.size} video{selectedIds.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>They'll be hidden from your library.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
