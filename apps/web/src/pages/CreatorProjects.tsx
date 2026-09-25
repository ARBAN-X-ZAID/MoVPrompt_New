import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CircleAlert, CircleCheck, Clock3, Copy, Download, FileImage, FolderOpen, Plus, RefreshCw, Trash2, Video } from "lucide-react";
import type { PublicRenderRun, RenderProcessingStage } from "@movprompt/contracts";
import { toast } from "sonner";
import { Seo } from "@/components/Seo";
import { useAuth } from "@/hooks/useAuth";
import { CreatorShell } from "@/features/create/CreatorShell";
import { duplicateCreatorProject, listLocalCreatorProjects, loadCreatorProjects, subscribeToCreatorProjects, trashCreatorProject } from "@/features/create/projectStore";
import { ProjectDeletionPendingError } from "@/features/create/trashUnfinishedProject";
import { canDeleteCreatorDraft } from "@/features/create/creatorProjectDeletion";
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
  const [pendingDelete, setPendingDelete] = useState<CreatorProject | null>(null);
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
    if (!canDeleteCreatorDraft(pendingDelete, runs)) {
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

  return (
    <CreatorShell qaMode={qaMode}>
      <Seo title={`${tr("Your video projects", "مشاريع الفيديو")} · MovPrompt`} description={tr("Continue, edit and export your MovPrompt campaigns.", "تابع وعدّل وصدّر حملاتك في MovPrompt.")} path="/projects" noindex />
      <div className="creator-page">
        <header className="creator-page-head">
          <div>
            <p className="creator-kicker">{tr("Your campaigns", "حملاتك")}</p>
            <h1 className="creator-title creator-title-sm">{tr("Projects stay editable.", "مشاريعك تظل قابلة للتعديل.")}</h1>
            <p className="creator-subtitle">{tr("Continue a draft, revise a generated campaign or create a version for another platform.", "كمّل مسودة، عدّل حملة مولّدة، أو أنشئ نسخة لمنصة ثانية.")}</p>
          </div>
          <button className="creator-button creator-button-primary" type="button" onClick={createNew}><Plus aria-hidden="true" /> {tr("New project", "مشروع جديد")}</button>
        </header>

        {portablePlatform && user?.id ? (
          <section className="creator-generation-history" aria-labelledby="generation-history-title" aria-busy={runsLoading}>
            <div className="creator-generation-history-head">
              <div>
                <p className="creator-kicker">{tr("Saved outputs", "الفيديوهات المحفوظة")}</p>
                <h2 id="generation-history-title">{tr("Recent generations", "أحدث الفيديوهات")}</h2>
                <p>{tr("Every render stays attached to your account, including earlier versions of the same project.", "كل توليد يبقى محفوظاً بحسابك، حتى الإصدارات السابقة من نفس المشروع.")}</p>
              </div>
              <button className="creator-button creator-button-secondary" type="button" onClick={refreshRuns} disabled={runsLoading}>
                <RefreshCw aria-hidden="true" className={runsLoading ? "is-spinning" : ""} />
                {runsLoading ? tr("Refreshing", "جارٍ التحديث") : tr("Refresh", "تحديث")}
              </button>
            </div>
            {runsError ? <div className="creator-generation-history-error" role="alert"><CircleAlert aria-hidden="true" /><span>{runsError}</span></div> : null}
            {runs.length ? (
              <div className="creator-generation-grid">
                {runs.map((run) => {
                  const project = projectsById.get(run.projectId);
                  const mediaUrl = runMedia[run.id];
                  const ready = run.status === "completed" && run.outputAvailable;
                  return (
                    <article className="creator-generation-card" key={run.id}>
                      <div className="creator-generation-card-media">
                        {mediaUrl
                          ? <video src={mediaUrl} controls playsInline preload="metadata" poster={project?.product.images[0]?.url || undefined} aria-label={tr(`Generated video for ${project?.title || "project"}`, `الفيديو المولّد لمشروع ${project?.title || "المشروع"}`)} />
                          : project?.product.images[0]?.url
                            ? <img src={project.product.images[0].url} alt="" />
                            : <span className="creator-project-preview-empty"><Video aria-hidden="true" /><span>{tr("Video preview", "معاينة الفيديو")}</span></span>}
                        <span className={`creator-generation-badge is-${run.processingStage}`}>
                          {ready ? <CircleCheck aria-hidden="true" /> : run.status === "failed" ? <CircleAlert aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
                          {generationStageLabel(run.processingStage, ar)}
                        </span>
                      </div>
                      <div className="creator-generation-card-copy">
                        <h3>{project?.title || tr("Video project", "مشروع فيديو")}</h3>
                        <p>{new Date(run.createdAt).toLocaleString(ar ? "ar-KW" : "en-KW", { dateStyle: "medium", timeStyle: "short" })}</p>
                        {run.error ? <p className="creator-generation-error">{run.error.message || run.error.code}</p> : null}
                        <div className="creator-generation-card-actions">
                          <Link className="creator-button creator-button-secondary" to={`/projects/${run.projectId}`}>{tr("Open project", "فتح المشروع")}</Link>
                          {ready ? <button className="creator-button creator-button-primary" type="button" onClick={() => void downloadRun(run)}><Download aria-hidden="true" /> {tr("Download", "تنزيل")}</button> : null}
                          {canRecoverOutput(run) ? <button className="creator-button creator-button-primary" type="button" onClick={() => void retryOutput(run)} disabled={retryingRunId === run.id}><RefreshCw aria-hidden="true" className={retryingRunId === run.id ? "is-spinning" : ""} /> {tr("Retry saving", "إعادة الحفظ")}</button> : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : !runsLoading && !runsError ? (
              <div className="creator-generation-history-empty"><Video aria-hidden="true" /><span>{tr("Your generated videos will appear here.", "ستظهر فيديوهاتك المولّدة هنا.")}</span></div>
            ) : null}
          </section>
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
