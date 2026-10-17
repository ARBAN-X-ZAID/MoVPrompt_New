import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CircleAlert, CircleCheck, Clock3, Download, FolderOpen, LayoutTemplate, PencilLine, Plus, RefreshCw, Search, SearchX, Sparkles, Trash2, Video, X } from "lucide-react";
import type { PublicRenderRun, RenderProcessingStage } from "@movprompt/contracts";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import { useAuth } from "@/hooks/useAuth";
import { CreatorShell } from "@/features/create/CreatorShell";
import { duplicateCreatorProject, listLocalCreatorProjects, loadCreatorProjects, subscribeToCreatorProjects, trashCreatorProject } from "@/features/create/projectStore";
import { ProjectDeletionPendingError } from "@/features/create/trashUnfinishedProject";
import { canDeleteCreatorDraft } from "@/features/create/creatorProjectDeletion";
import { ProjectCardV2 } from "@/features/create/ProjectCardV2";
import { relativeTime } from "@/features/create/relativeTime";
import { cn } from "@/lib/utils";
import type { CreatorProject } from "@/features/create/types";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { isFeatureEnabled } from "@/config/features";
import { PortableApiError, portableCreatorApi } from "@/lib/api/portableApiClient";

function statusLabel(status: CreatorProject["status"], ar: boolean) {
  if (status === "review") return ar ? "جاهز للمراجعة" : "Ready to review";
  if (status === "generating") return ar ? "جارٍ التوليد" : "Generating";
  if (status === "completed") return ar ? "الفيديو جاهز" : "Video ready";
  if (status === "failed") return ar ? "يحتاج متابعة" : "Needs attention";
  return ar ? "مسودة" : "Draft";
}

function generationStageLabel(stage: RenderProcessingStage, ar: boolean) {
  const copy: Record<RenderProcessingStage, [string, string]> = {
    preparing: ["Preparing campaign", "جارٍ تجهيز الحملة"],
    rendering: ["Creating video", "جارٍ إنشاء الفيديو"],
    securing_output: ["Securing completed video", "جارٍ حفظ الفيديو المكتمل"],
    quality_review: ["Checking video quality", "جارٍ فحص جودة الفيديو"],
    ready: ["Ready", "جاهز"],
    cancelling: ["Cancelling", "جارٍ الإلغاء"],
    failed: ["Needs attention", "يحتاج متابعة"],
    cancelled: ["Cancelled", "ملغي"],
  };
  return copy[stage][ar ? 1 : 0];
}

type ProjectFilter = "all" | "ready" | "progress" | "attention" | "drafts";

function runBucket(run: PublicRenderRun): Exclude<ProjectFilter, "all" | "drafts"> {
  if (run.status === "completed" && run.outputAvailable) return "ready";
  if (run.status === "failed" || run.status === "cancelled") return "attention";
  return "progress";
}

function projectBucket(project: CreatorProject): Exclude<ProjectFilter, "all"> {
  if (project.status === "generating") return "progress";
  if (project.status === "failed") return "attention";
  if (project.hasGeneratedVideo) return "ready";
  return "drafts";
}

function canRecoverOutput(run: PublicRenderRun) {
  if (run.status !== "failed" || !run.error) return false;
  return run.error.code === "provider_output_host_not_allowed"
    || run.error.code === "provider_output_unavailable"
    || run.error.message?.includes("provider_output")
    || run.error.message === "fetch failed";
}

export default function CreatorProjects({ qaMode = false }: { qaMode?: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const tr = useCallback((english: string, arabic: string) => ar ? arabic : english, [ar]);
  const [projects, setProjects] = useState<CreatorProject[]>([]);
  const [runs, setRuns] = useState<PublicRenderRun[]>([]);
  const [runMedia, setRunMedia] = useState<Record<string, string>>({});
  const runMediaRef = useRef<Record<string, string>>({});
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState("");
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Pick<CreatorProject, "id" | "title"> | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  const [deleteError, setDeleteError] = useState("");
  const portablePlatform = isFeatureEnabled("portableAuth") && !qaMode;

  const loadRuns = useCallback(async () => {
    if (!portablePlatform || !user?.id) {
      setRuns([]);
      setRunMedia({});
      runMediaRef.current = {};
      return;
    }
    setRunsLoading(true);
    setRunsError("");
    try {
      await portableCreatorApi.claimGuestResults();
      const [loadedProjects, nextRuns] = await Promise.all([
        loadCreatorProjects(user.id, { signAssets: false }),
        portableCreatorApi.listRenders({ limit: 50 }),
      ]);
      setProjects(loadedProjects);
      setRuns(nextRuns);
      setRunsLoading(false);
      const completed = nextRuns.filter((run) => run.status === "completed" && run.outputAvailable && !runMediaRef.current[run.id]);
      const media = await Promise.all(completed.map(async (run) => {
        try {
          return [run.id, await portableCreatorApi.outputDownload(run.projectId, run.id)] as const;
        } catch {
          return null;
        }
      }));
      runMediaRef.current = {
        ...runMediaRef.current,
        ...Object.fromEntries(media.filter((item): item is readonly [string, string] => item !== null)),
      };
      setRunMedia(runMediaRef.current);
    } catch (error) {
      const requestId = error instanceof PortableApiError ? error.requestId : undefined;
      setRunsError(tr(
        `We couldn’t load your generations.${requestId ? ` Support ID: ${requestId}` : ""}`,
        `ما قدرنا نحمّل الفيديوهات.${requestId ? ` رقم الدعم: ${requestId}` : ""}`,
      ));
    } finally {
      setRunsLoading(false);
    }
  }, [portablePlatform, tr, user?.id]);

  useEffect(() => {
    if (portablePlatform && user?.id) {
      return subscribeToCreatorProjects(() => setProjects(listLocalCreatorProjects(user.id)));
    }
    void loadCreatorProjects(qaMode ? null : user?.id).then(setProjects);
    return subscribeToCreatorProjects(() => setProjects(listLocalCreatorProjects(qaMode ? null : user?.id)));
  }, [portablePlatform, qaMode, user?.id]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      runMediaRef.current = {};
      void loadRuns();
    }, 10 * 60_000);
    return () => window.clearInterval(timer);
  }, [loadRuns]);

  useEffect(() => {
    if (!runs.some((run) => !["completed", "failed", "cancelled"].includes(run.status))) return;
    const timer = window.setInterval(() => void loadRuns(), 4_000);
    return () => window.clearInterval(timer);
  }, [loadRuns, runs]);

  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  const refreshRuns = () => {
    runMediaRef.current = {};
    setRunMedia({});
    void loadRuns();
  };

  const retryOutput = async (run: PublicRenderRun) => {
    setRetryingRunId(run.id);
    try {
      await portableCreatorApi.retryRenderOutput(run.id, `render-output-recovery:${run.id}`);
      toast.success(tr("Saving resumed. This does not generate or charge again.", "استؤنف حفظ الفيديو بدون توليد أو رسوم جديدة."));
      await loadRuns();
    } catch (error) {
      const requestId = error instanceof PortableApiError ? error.requestId : undefined;
      toast.error(tr(
        `We couldn’t resume saving.${requestId ? ` Support ID: ${requestId}` : ""}`,
        `ما قدرنا نستأنف الحفظ.${requestId ? ` رقم الدعم: ${requestId}` : ""}`,
      ));
    } finally {
      setRetryingRunId(null);
    }
  };

  const downloadRun = async (run: PublicRenderRun) => {
    try {
      const url = await portableCreatorApi.outputDownload(run.projectId, run.id);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `movprompt-${run.id}.mp4`;
      anchor.rel = "noopener";
      anchor.click();
    } catch {
      toast.error(tr("We couldn’t prepare the download. Refresh and try again.", "ما قدرنا نجهز التنزيل. حدّث الصفحة وحاول مرة ثانية."));
    }
  };

  const duplicate = async (project: CreatorProject) => {
    try {
      await duplicateCreatorProject(project.id, qaMode ? null : user?.id);
      setProjects(await loadCreatorProjects(qaMode ? null : user?.id));
      toast.success(tr("Project duplicated.", "تم نسخ المشروع."));
    } catch {
      toast.error(tr("We couldn’t duplicate this project. Try again.", "ما قدرنا ننسخ المشروع. حاول مرة ثانية."));
    }
  };

  const remove = async () => {
    if (!pendingDelete || deletingRef.current) return;
    const currentProject = projectsById.get(pendingDelete.id);
    const hasSavedOutput = runs.some(run => run.projectId === pendingDelete.id && (run.outputAvailable || run.status === "completed"));
    if (hasSavedOutput || (currentProject && !canDeleteCreatorDraft(currentProject, runs))) {
      setDeleteError(tr("This project has a generated video and cannot be deleted.", "هذا المشروع فيه فيديو مُنشأ ولا يمكن حذفه."));
      return;
    }
    deletingRef.current = true;
    setDeleting(true);
    setDeleteError("");
    try {
      await trashCreatorProject(pendingDelete.id, qaMode ? null : user?.id);
      // Preserve hydrated thumbnails; the local cache intentionally strips temporary media URLs.
      setProjects(projects.filter(project => project.id !== pendingDelete.id));
      setRuns(current => current.filter(run => run.projectId !== pendingDelete.id));
      setPendingDelete(null);
      toast.success(tr("Project moved to trash.", "تم نقل المشروع إلى سلة المحذوفات."));
    } catch (error) {
      const message = error instanceof ProjectDeletionPendingError
        ? tr("Generation is still stopping. Your project is preserved. Try Delete again once it stops.", "التوليد لا يزال يتوقف. مشروعك محفوظ. حاول الحذف مرة أخرى بعد توقفه.")
        : error instanceof PortableApiError && ["project_generation_in_progress", "provider_acceptance_in_progress"].includes(error.code)
          ? tr("Generation could not stop yet. Your project is preserved. Try Delete again shortly.", "لم يتوقف التوليد بعد. مشروعك محفوظ. حاول الحذف مرة أخرى بعد قليل.")
          : error instanceof PortableApiError && error.code === "project_has_generated_video"
            ? tr("This project has a generated video and cannot be deleted.", "هذا المشروع فيه فيديو مُنشأ ولا يمكن حذفه.")
            : tr("We couldn’t delete this project. Try again.", "ما قدرنا نحذف المشروع. حاول مرة ثانية.");
      setDeleteError(message);
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  const createNew = () => {
    navigate(qaMode ? "/qa/create" : "/create");
  };

  const [filter, setFilter] = useState<ProjectFilter>("all");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const runProjectIds = useMemo(() => new Set(runs.map((run) => run.projectId)), [runs]);
  const draftProjects = useMemo(() => projects.filter((project) => !runProjectIds.has(project.id)), [projects, runProjectIds]);
  const counts = useMemo(() => {
    const tally = { ready: 0, progress: 0, attention: 0, drafts: 0 };
    for (const run of runs) tally[runBucket(run)] += 1;
    for (const project of draftProjects) tally[projectBucket(project)] += 1;
    return tally;
  }, [draftProjects, runs]);
  const matchesQuery = (title: string) => !normalizedQuery || title.toLocaleLowerCase().includes(normalizedQuery);
  const runTitle = (run: PublicRenderRun) => projectsById.get(run.projectId)?.title || tr("Video project", "مشروع فيديو");
  const visibleRuns = filter === "drafts" ? [] : runs.filter((run) => (filter === "all" || runBucket(run) === filter) && matchesQuery(runTitle(run)));
  const visibleDrafts = draftProjects.filter((project) => (filter === "all" || projectBucket(project) === filter) && matchesQuery(project.title));
  const showRuns = portablePlatform && Boolean(user?.id);
  const hasAnything = runs.length > 0 || projects.length > 0;
  const initialLoading = showRuns && runsLoading && !hasAnything;
  const projectPath = (projectId: string) => qaMode ? `/qa/create?project=${projectId}` : `/projects/${projectId}`;
  const requestDelete = (projectId: string, title: string) => { setDeleteError(""); setPendingDelete({ id: projectId, title }); };
  const clearFilters = () => { setFilter("all"); setQuery(""); };

  const filters: Array<[ProjectFilter, string, number]> = [
    ["all", tr("All", "الكل"), runs.length + draftProjects.length],
    ["ready", tr("Ready", "جاهز"), counts.ready],
    ["progress", tr("In progress", "قيد التنفيذ"), counts.progress],
    ["attention", tr("Needs attention", "يحتاج متابعة"), counts.attention],
    ["drafts", tr("Drafts", "مسودات"), counts.drafts],
  ];
  const summary: Array<[string, number, typeof CircleCheck, string]> = [
    [tr("Videos ready", "فيديوهات جاهزة"), counts.ready, CircleCheck, "is-ready"],
    [tr("In progress", "قيد التنفيذ"), counts.progress, Clock3, "is-progress"],
    [tr("Needs attention", "يحتاج متابعة"), counts.attention, CircleAlert, "is-attention"],
    [tr("Drafts", "مسودات"), counts.drafts, PencilLine, "is-draft"],
  ];

  return (
    <CreatorShell qaMode={qaMode}>
      <Seo title={`${tr("Your video projects", "مشاريع الفيديو")} · MovPrompt`} description={tr("Continue, edit and export your MovPrompt campaigns.", "تابع وعدّل وصدّر حملاتك في MovPrompt.")} path="/projects" noindex />
      <div className="creator-page creator-library creator-projects-page">
        <header className="creator-page-head creator-library-head">
          <div>
            <p className="creator-kicker">{tr("Your campaigns", "حملاتك")}</p>
            <h1 className="creator-title creator-title-sm">{tr("Projects stay editable.", "مشاريعك تظل قابلة للتعديل.")}</h1>
            <p className="creator-subtitle">{tr("Download finished videos, continue drafts, or make a new version.", "نزّل الفيديوهات الجاهزة، كمّل المسودات، أو سوِّ نسخة جديدة.")}</p>
          </div>
          <button className="creator-button creator-button-primary" type="button" onClick={createNew}><Plus aria-hidden="true" /> {tr("New project", "مشروع جديد")}</button>
        </header>

        {hasAnything ? (
          <dl className="creator-projects-summary">
            {summary.map(([label, value, Icon, tone]) => (
              <div key={tone} className={cn("creator-projects-stat", tone)}>
                <dt><Icon aria-hidden="true" />{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {hasAnything ? (
          <div className="creator-projects-toolbar">
            <div className="creator-template-filters" role="group" aria-label={tr("Filter projects", "تصفية المشاريع")}>
              {filters.map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  className={cn("creator-template-filter", filter === value && "is-active")}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                  <span className="creator-template-filter-count" aria-hidden="true">{count}</span>
                </button>
              ))}
            </div>
            <div className="creator-projects-toolbar-end">
              <label className="creator-template-search creator-projects-search">
                <span className="sr-only">{tr("Search projects", "ابحث في المشاريع")}</span>
                <Search aria-hidden="true" />
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr("Search by project name", "ابحث باسم المشروع")} />
                {query ? <button type="button" className="creator-template-search-clear" onClick={() => setQuery("")} aria-label={tr("Clear search", "امسح البحث")}><X aria-hidden="true" /></button> : null}
              </label>
              {showRuns ? (
                <button className="creator-button creator-button-secondary creator-projects-refresh" type="button" onClick={refreshRuns} disabled={runsLoading} aria-label={runsLoading ? tr("Refreshing", "جارٍ التحديث") : tr("Refresh", "تحديث")}>
                  <RefreshCw aria-hidden="true" className={runsLoading ? "is-spinning" : ""} />
                  <span>{runsLoading ? tr("Refreshing", "جارٍ التحديث") : tr("Refresh", "تحديث")}</span>
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {runsError ? <div className="creator-generation-history-error" role="alert"><CircleAlert aria-hidden="true" /><span>{runsError}</span></div> : null}

        {initialLoading ? (
          <div className="creator-generation-grid" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="creator-template-skeleton">
                <span className="creator-skeleton-block is-media" />
                <span className="creator-skeleton-block is-line is-short" />
                <span className="creator-skeleton-block is-line" />
              </div>
            ))}
          </div>
        ) : null}

        {showRuns && visibleRuns.length ? (
          <section className="creator-generation-history" aria-labelledby="generation-history-title" aria-busy={runsLoading}>
            <div className="creator-projects-section-head">
              <h2 id="generation-history-title">{tr("Generated videos", "الفيديوهات المولّدة")}</h2>
              <p>{tr("Every render stays attached to your account, including earlier versions.", "كل توليد يبقى محفوظاً بحسابك، حتى الإصدارات السابقة.")}</p>
            </div>
            <div className="creator-generation-grid">
              {visibleRuns.map((run) => {
                const project = projectsById.get(run.projectId);
                const mediaUrl = runMedia[run.id];
                const bucket = runBucket(run);
                const ready = bucket === "ready";
                const title = runTitle(run);
                const deletable = run.status !== "completed" && (project
                  ? canDeleteCreatorDraft(project, runs)
                  : !runs.some(item => item.projectId === run.projectId && (item.outputAvailable || item.status === "completed")));
                return (
                  <article className={cn("creator-generation-card", `is-${bucket}`)} key={run.id}>
                    <div className="creator-generation-card-media" data-ratio={project?.aspectRatio ?? "9:16"}>
                      {mediaUrl
                        ? <video src={mediaUrl} controls playsInline preload="metadata" poster={project?.product.images[0]?.url || undefined} aria-label={tr(`Generated video for ${project?.title || "project"}`, `الفيديو المولّد لمشروع ${project?.title || "المشروع"}`)} />
                        : project?.product.images[0]?.url
                          ? <img src={project.product.images[0].url} alt="" loading="lazy" />
                          : <span className="creator-project-preview-empty"><Video aria-hidden="true" /><span>{tr("Video preview", "معاينة الفيديو")}</span></span>}
                      {bucket === "progress" ? <span className="creator-generation-card-progress" aria-hidden="true" /> : null}
                    </div>
                    <div className="creator-generation-card-copy">
                      <span className={`creator-generation-badge is-${run.processingStage}`}>
                        {ready ? <CircleCheck aria-hidden="true" /> : bucket === "attention" ? <CircleAlert aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
                        {generationStageLabel(run.processingStage, ar)}
                      </span>
                      <h3>{title}</h3>
                      <p title={new Date(run.createdAt).toLocaleString(ar ? "ar-KW" : "en-KW", { dateStyle: "medium", timeStyle: "short" })}>{relativeTime(run.createdAt, ar)}</p>
                      {run.error ? <p className="creator-generation-error">{run.error.message || run.error.code}</p> : null}
                      <div className="creator-generation-card-actions">
                        {ready ? <button className="creator-button creator-button-primary" type="button" onClick={() => void downloadRun(run)}><Download aria-hidden="true" /> {tr("Download", "تنزيل")}</button> : null}
                        {canRecoverOutput(run) ? <button className="creator-button creator-button-primary" type="button" onClick={() => void retryOutput(run)} disabled={retryingRunId === run.id}><RefreshCw aria-hidden="true" className={retryingRunId === run.id ? "is-spinning" : ""} /> {tr("Retry saving", "إعادة الحفظ")}</button> : null}
                        <Link className="creator-button creator-button-secondary" to={projectPath(run.projectId)}>{tr("Open project", "فتح المشروع")}</Link>
                        {deletable ? (
                          <button
                            className="creator-button creator-button-secondary creator-delete-draft creator-project-icon-action"
                            type="button"
                            aria-label={tr(`Delete project ${title}`, `حذف المشروع ${title}`)}
                            title={tr("Delete", "حذف")}
                            onClick={() => requestDelete(run.projectId, title)}
                          >
                            <Trash2 aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {visibleDrafts.length ? (
          <section className="creator-projects-drafts" aria-labelledby="project-drafts-title">
            <div className="creator-projects-section-head">
              <h2 id="project-drafts-title">{showRuns ? tr("Drafts", "المسودات") : tr("Projects", "المشاريع")}</h2>
              <p>{tr("Saved settings you have not generated yet. Pick up where you left off.", "إعدادات محفوظة لم تُولَّد بعد. كمّل من حيث وقفت.")}</p>
            </div>
            <div className="creator-projects-draft-grid">
              {visibleDrafts.map((project) => (
                <ProjectCardV2
                  key={project.id}
                  project={project}
                  onOpen={(item) => navigate(projectPath(item.id))}
                  onDuplicate={(item) => void duplicate(item)}
                  onDelete={canDeleteCreatorDraft(project, runs) ? (item) => requestDelete(item.id, item.title) : undefined}
                />
              ))}
            </div>
          </section>
        ) : null}

        {hasAnything && !initialLoading && !visibleRuns.length && !visibleDrafts.length ? (
          <div className="creator-template-empty" role="status">
            <span className="creator-template-empty-icon" aria-hidden="true"><SearchX /></span>
            <strong>{tr("Nothing matches this view", "ما في شي يطابق هذا العرض")}</strong>
            <span>{tr("Try another filter or clear the search.", "جرّب تصفية ثانية أو امسح البحث.")}</span>
            <button type="button" className="creator-button creator-button-secondary" onClick={clearFilters}>{tr("Clear filters", "مسح التصفية")}</button>
          </div>
        ) : null}

        {!hasAnything && !initialLoading && !runsError ? (
          <div className="creator-projects-empty">
            <span className="creator-projects-empty-icon" aria-hidden="true"><FolderOpen /></span>
            <h2>{tr("Your first campaign starts here", "أول حملة لك تبدأ من هنا")}</h2>
            <p>{tr("Pick a template or open Ad Studio. Your generated videos and drafts will appear on this page.", "اختر قالب أو افتح استوديو الإعلانات. فيديوهاتك ومسوداتك بتظهر في هذي الصفحة.")}</p>
            <div className="creator-projects-empty-actions">
              <Link className="creator-button creator-button-primary" to={qaMode ? "/qa/create?view=templates" : "/templates"}><LayoutTemplate aria-hidden="true" /> {tr("Browse templates", "تصفح القوالب")}</Link>
              <Link className="creator-button creator-button-secondary" to={qaMode ? "/qa/create?view=ad-studio" : "/ad-studio"}><Sparkles aria-hidden="true" /> {tr("Open Ad Studio", "افتح استوديو الإعلانات")}</Link>
            </div>
          </div>
        ) : null}
      </div>
      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open && !deletingRef.current) setPendingDelete(null); }}>
        <AlertDialogContent className="creator-app" dir={ar ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("Are you sure you want to delete this project?", "هل أنت متأكد أنك تريد حذف هذا المشروع؟")}</AlertDialogTitle>
            <AlertDialogDescription>{tr(`“${pendingDelete?.title ?? ""}” will be moved to trash and removed from My Projects. Any running generation will be cancelled before deletion. Generated videos are protected.`, `سيتم نقل «${pendingDelete?.title ?? ""}» إلى سلة المحذوفات وإزالته من مشاريعي. سيتم إلغاء أي توليد جارٍ قبل الحذف. الفيديوهات المُنشأة محمية.`)}</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? <p className="creator-export-error" role="alert">{deleteError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{tr("Cancel", "إلغاء")}</AlertDialogCancel>
            <button className="creator-button creator-button-secondary creator-delete-draft" type="button" disabled={deleting} onClick={() => void remove()}>{deleting ? tr("Deleting…", "جارٍ الحذف…") : tr("Delete project", "حذف المشروع")}</button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CreatorShell>
  );
}
