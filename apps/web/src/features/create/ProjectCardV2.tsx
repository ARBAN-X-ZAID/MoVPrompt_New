import { ArrowUpRight, CheckCircle2, Loader2, RefreshCw, AlertTriangle, Copy, Trash2 } from "lucide-react";

import type { CreatorProject, CreatorResolution } from "./types";
import { useLanguage } from "@/i18n/LanguageContext";

export interface ProjectCardV2Props {
  project: CreatorProject;
  isFeatured?: boolean;
  onOpen: (project: CreatorProject) => void;
  onDuplicate?: (project: CreatorProject) => void;
  onDelete?: (project: CreatorProject) => void;
  resolution?: CreatorResolution;
}

type VisualStatus = "ready" | "generating" | "failed" | "draft";

function statusFor(project: CreatorProject): VisualStatus {
  if (project.status === "generating") return "generating";
  if (project.status === "failed") return "failed";
  if (project.hasGeneratedVideo) return "ready";
  return "draft";
}

function fmtUpdated(updatedAt: string, arabic: boolean) {
  if (!updatedAt) return arabic ? "—\u2003" : "—";
  const ts = Date.parse(updatedAt);
  if (!Number.isFinite(ts)) return updatedAt;
  const delta = Date.now() - ts;
  const minutes = Math.round(delta / 60_000);
  if (minutes < 1) return arabic ? "الآن" : "just now";
  if (minutes < 60) return arabic ? `قبل ${minutes} دقيقة` : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return arabic ? `قبل ${hours} ساعة` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return arabic ? `قبل ${days} يوم` : `${days}d ago`;
}

export function ProjectCardV2({
  project,
  isFeatured = false,
  onOpen,
  onDuplicate,
  onDelete,
  resolution,
}: ProjectCardV2Props) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const status = statusFor(project);

  const statusBadge = {
    ready: { label: ar ? "جاهز" : "Ready", icon: CheckCircle2 },
    generating: { label: ar ? "قيد التوليد" : "Generating", icon: Loader2 },
    failed: { label: ar ? "فشل" : "Failed", icon: AlertTriangle },
    draft: { label: ar ? "مسودة" : "Draft", icon: RefreshCw },
  }[status];

  const StatusIcon = statusBadge.icon;

  const classes = [
    "creator-project-card-v2",
    isFeatured ? "is-featured" : "",
    `is-${status}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={classes}
      data-project-id={project.id}
      data-project-status={status}
      aria-label={project.title}
    >
      <header className="creator-project-card-head">
        <div className="creator-project-card-meta">
          <h2 className="creator-project-card-title">{project.title}</h2>
          <span className="creator-project-card-sub">
            {ar ? "آخر تحديث" : "Updated"} {fmtUpdated(project.updatedAt, ar)}
          </span>
        </div>
        <span className="creator-project-card-status">
          <StatusIcon aria-hidden="true" />
          {statusBadge.label}
        </span>
      </header>

      <footer className="creator-project-card-actions">
        {onDuplicate ? (
          <button
            type="button"
            className="creator-button creator-button-ghost"
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate(project);
            }}
            aria-label={ar ? `انسخ ${project.title}` : `Duplicate ${project.title}`}
          >
            <Copy aria-hidden="true" />
            {ar ? "تكرار" : "Duplicate"}
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            className="creator-button creator-button-ghost creator-button-danger creator-delete-draft"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(project);
            }}
            aria-label={ar ? `حذف مشروع ${project.title}` : `Delete project ${project.title}`}
          >
            <Trash2 aria-hidden="true" />
            {ar ? "حذف مشروع" : "Delete project"}
          </button>
        ) : null}
        <button
          type="button"
          className="creator-button creator-button-primary"
          onClick={() => onOpen(project)}
          aria-label={ar ? `افتح ${project.title}` : `Open ${project.title}`}
        >
          {ar ? "فتح" : "Open"}
          <ArrowUpRight aria-hidden="true" />
        </button>
      </footer>
    </article>
  );
}
