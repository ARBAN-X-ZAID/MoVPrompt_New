import { AlertTriangle, ArrowUpRight, CheckCircle2, Copy, Image, Loader2, PencilLine, Trash2 } from "lucide-react";

import type { CreatorProject, CreatorResolution } from "./types";
import { relativeTime } from "./relativeTime";
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

export function ProjectCardV2({
  project,
  isFeatured = false,
  onOpen,
  onDuplicate,
  onDelete,
}: ProjectCardV2Props) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const status = statusFor(project);

  const statusBadge = {
    ready: { label: ar ? "جاهز" : "Ready", icon: CheckCircle2 },
    generating: { label: ar ? "قيد التوليد" : "Generating", icon: Loader2 },
    failed: { label: ar ? "يحتاج متابعة" : "Needs attention", icon: AlertTriangle },
    draft: { label: ar ? "مسودة" : "Draft", icon: PencilLine },
  }[status];

  const StatusIcon = statusBadge.icon;
  const preview = project.product.images[0]?.url;

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
      <div className="creator-project-card-media">
        {preview
          ? <img src={preview} alt="" loading="lazy" decoding="async" />
          : <span className="creator-project-preview-empty"><Image aria-hidden="true" /><span>{ar ? "بدون صورة" : "No photo yet"}</span></span>}
        <span className="creator-project-card-status">
          <StatusIcon aria-hidden="true" />
          {statusBadge.label}
        </span>
      </div>
      <div className="creator-project-card-head">
        <h3 className="creator-project-card-title">{project.title}</h3>
        <span className="creator-project-card-sub">
          {ar ? "آخر تحديث" : "Updated"} {relativeTime(project.updatedAt, ar)}
        </span>
      </div>

      <div className="creator-project-card-actions">
        <button
          type="button"
          className="creator-button creator-button-primary"
          onClick={() => onOpen(project)}
          aria-label={ar ? `افتح ${project.title}` : `Open ${project.title}`}
        >
          {ar ? "متابعة" : "Continue"}
          <ArrowUpRight aria-hidden="true" />
        </button>
        {onDuplicate ? (
          <button
            type="button"
            className="creator-button creator-button-secondary creator-project-icon-action"
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate(project);
            }}
            aria-label={ar ? `انسخ ${project.title}` : `Duplicate ${project.title}`}
            title={ar ? "تكرار" : "Duplicate"}
          >
            <Copy aria-hidden="true" />
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            className="creator-button creator-button-secondary creator-delete-draft creator-project-icon-action"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(project);
            }}
            aria-label={ar ? `حذف المشروع ${project.title}` : `Delete project ${project.title}`}
            title={ar ? "حذف" : "Delete"}
          >
            <Trash2 aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </article>
  );
}
