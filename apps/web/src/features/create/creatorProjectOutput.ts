import type { CreatorProject } from "./types";

/**
 * Template preview media is catalog-only. It must never be treated as a user's
 * generated project output, including when an older local demo saved it in
 * localStorage.
 */
export function isBundledDemoVideoUrl(value: string | null | undefined) {
  if (!value?.trim()) return false;
  try {
    const pathname = new URL(value, "https://movprompt.local").pathname.toLowerCase();
    return pathname.startsWith("/presets/") || pathname.includes("/sample-kinza.");
  } catch {
    const normalized = value.toLowerCase();
    return normalized.includes("/presets/") || normalized.includes("/sample-kinza.");
  }
}

export function hasRealCreatorVideo(project: Pick<CreatorProject, "videoUrl" | "sourceFingerprint" | "outputSourceFingerprint">) {
  return Boolean(project.videoUrl?.trim())
    && !isBundledDemoVideoUrl(project.videoUrl)
    && (!project.sourceFingerprint || project.outputSourceFingerprint === project.sourceFingerprint);
}

function withoutRenderBinding(project: CreatorProject): CreatorProject {
  const { outputSourceFingerprint: _outputSourceFingerprint, ...withoutOutputFingerprint } = project;
  return {
    ...withoutOutputFingerprint,
    status: project.product.images.length ? "ready" : "draft",
    videoUrl: null,
    jobId: null,
    renderRunId: null,
    lastError: null,
    pendingGenerationId: null,
    pendingQuoteCredits: null,
  };
}

/** Clears a render whenever its source product or template changes. */
export function invalidateCreatorProjectOutput(project: CreatorProject) {
  return withoutRenderBinding(project);
}

/**
 * Repairs records written by the former local-demo path without touching real
 * provider outputs or any campaign fields.
 */
export function sanitizeCreatorProjectOutput(project: CreatorProject) {
  return hasRealCreatorVideo(project) || !project.videoUrl ? project : withoutRenderBinding(project);
}

/** Local/QA preparation ends in an honest still-image state, never a fake MP4. */
export function completeLocalProductPreview(project: CreatorProject) {
  if (hasRealCreatorVideo(project)) {
    return { ...project, status: "review" as const, jobId: null, renderRunId: null, lastError: null };
  }
  return withoutRenderBinding(project);
}
