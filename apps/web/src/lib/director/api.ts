import { supabase } from "@/integrations/supabase/client";
import { isFeatureEnabled } from "@/config/features";
import { portableCreatorApi } from "@/lib/api/portableApiClient";
import type { Attachment } from "./ingest";
import type { TasteProfile } from "./tasteProfile";

export type DirectorMsg = { role: "user" | "assistant"; content: string };

export type LockedSpec = {
  input_mode?: "text-to-video" | "image-to-video" | "video-edit" | "motion-control" | "multi-reference";
  duration_seconds?: number;
  aspect_ratio?: string;
  audio?: "silent" | "sfx" | "music" | "dialogue" | "full";
  resolution?: "480p" | "720p" | "1080p" | "4k";
  style?: "photoreal" | "cinematic-film" | "stylized" | "anime";
};

export type StyleSpec = {
  lens?: string;
  lighting?: string;
  palette?: string;
  film_emulation?: string;
  grade?: string;
  mood?: string;
};

export type Breakdown = {
  subject?: string;
  action?: string;
  camera?: string;
  lighting?: string;
  mood?: string;
  color_palette?: string;
  environment?: string;
  duration_hint?: string;
  resolution?: "480p" | "720p" | "1080p" | "4k";
  aspect_ratio?: string;
  film_emulation?: string;
  negative_prompt?: string;
  model_recommendation?: string;
  recommended_model_id?: string;
  recommended_alternatives?: string[];
  recommendation_reason?: string;
};

export type AgentSuggestion = {
  question_index: number;
  chips: string[];
  allow_other?: boolean;
};

export type AgentResponse = (
  | {
      kind: "ask_clarification";
      questions: string[];
      reason: string;
      suggestions?: AgentSuggestion[];
    }
  | {
      kind: "ask_model_choice";
      recommended_model_id: string;
      alternatives?: string[];
      reason: string;
      locked_spec?: LockedSpec;
    }
  | {
      kind: "generate_prompt";
      title: string;
      prompt: string;
      breakdown: Breakdown;
      directors_note?: string;
      next_suggestions?: string[];
      locked_spec?: LockedSpec;
    }
  | {
      kind: "request_video_generation";
      prompt: string;
      provider_preference?: "seedance" | "veo" | "kling" | "any";
      model_id?: string;
    }
  | {
      kind: "generate_reference_image";
      mode: "character_sheet" | "storyboard_panels" | "single_panel";
      prompt: string;
      reference_urls?: string[];
      count?: number;
      aspect_ratio?: string;
      per_shot_prompts?: string[];
      shot_index?: number;
      lock_mode?: "character" | "scene" | "auto";
      directors_note?: string;
      scene_already_described?: boolean;
      style_spec?: StyleSpec;
    }
  | {
      kind: "generate_story_bundle";
      aspect: "16:9" | "9:16" | "1:1";
      character_brief: string;
      character_subject_kind?: "character" | "product";
      prop_brief: string;
      location_briefs: string[];
      character_reference_urls?: string[];
      directors_note?: string;
    }
  | {
      kind: "request_story_render";
      aspect: "16:9" | "9:16" | "1:1";
      duration?: number;
      title?: string;
      act_prompts: string[];
      directors_note?: string;
    }
  | { kind: "message"; content: string }
) & { activeSkill?: string };

export type StoryAsset = { url: string; storage_path: string } | null;
export type StoryBundleResponse = {
  character: StoryAsset;
  prop: StoryAsset;
  locations: StoryAsset[];
  missing: number;
};

export async function submitStoryBundle(input: {
  aspect: "16:9" | "9:16" | "1:1";
  character_brief: string;
  character_subject_kind?: "character" | "product";
  prop_brief: string;
  location_briefs: string[];
  character_reference_urls?: string[];
}): Promise<StoryBundleResponse> {
  const { data, error } = await supabase.functions.invoke("story-bundle", { body: input });
  if (error) throw error;
  return data as StoryBundleResponse;
}

export type StoryRenderResponse = {
  story_render_id: string;
  acts: Array<{ job_id: string; act_index: number; ok: boolean }>;
  title: string;
};

export async function submitStoryRender(input: {
  session_id?: string | null;
  aspect: "16:9" | "9:16" | "1:1";
  duration?: number;
  character_url?: string;
  prop_url?: string;
  location_url: string;
  act_prompts: string[];
  title?: string;
}): Promise<StoryRenderResponse> {
  const { data, error } = await supabase.functions.invoke("story-render", { body: input });
  if (error) throw error;
  return data as StoryRenderResponse;
}

export async function submitStoryStitch(input: {
  story_render_id: string;
  session_id?: string | null;
  title?: string;
}): Promise<{ job_id: string; video_url: string; status: string }> {
  const { data, error } = await supabase.functions.invoke("story-stitch", { body: input });
  if (error) throw error;
  return data as { job_id: string; video_url: string; status: string };
}

export type ImageQuality = "1K" | "2K" | "4K";

export type GeneratedImage = {
  url: string;
  storage_path: string;
  shot_index?: number;
  quality?: ImageQuality;
};

export async function generateReferenceImage(input: {
  mode: "character_sheet" | "storyboard_panels" | "single_panel";
  prompt: string;
  reference_urls?: string[];
  count?: number;
  aspect_ratio?: string;
  per_shot_prompts?: string[];
  shot_index?: number;
  lock_mode?: "character" | "scene" | "auto";
  subject_kind?: "character" | "product";
  style_spec?: StyleSpec;
  quality?: ImageQuality;
}): Promise<{ mode: string; images: GeneratedImage[] }> {
  const { data, error } = await supabase.functions.invoke("generate-reference-image", {
    body: input,
  });
  if (error) throw error;
  return data as { mode: string; images: GeneratedImage[] };
}

export type ImageStreamEvent =
  | { type: "start"; mode: string; total: number }
  | { type: "panel"; index: number; value: GeneratedImage }
  | { type: "panel_error"; index: number; error: string }
  | { type: "done"; mode: string; missing: number };

export async function generateReferenceImageStream(
  input: Parameters<typeof generateReferenceImage>[0],
  onProgress: (e: ImageStreamEvent) => void,
): Promise<{ mode: string; images: GeneratedImage[] }> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-reference-image`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
    body: JSON.stringify(input),
  });
  const ct = resp.headers.get("content-type") || "";
  if (!resp.ok && !ct.includes("ndjson")) {
    let msg = `HTTP ${resp.status}`;
    try {
      const j = await resp.json();
      msg = j.error || msg;
    } catch { /* ignore */ }
    const err: any = new Error(msg);
    err.status = resp.status;
    throw err;
  }
  if (!ct.includes("ndjson")) {
    // Server fell back to single JSON response (non-chain modes).
    const data = (await resp.json()) as { mode: string; images: GeneratedImage[] };
    return data;
  }
  if (!resp.body) throw new Error("No response body");
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  const images: GeneratedImage[] = [];
  let mode = input.mode as string;
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const ev = JSON.parse(line) as ImageStreamEvent;
        onProgress(ev);
        if (ev.type === "panel") images.push(ev.value);
        if (ev.type === "done" || ev.type === "start") mode = (ev as any).mode || mode;
      } catch {
        /* ignore malformed line */
      }
    }
  }
  return { mode, images };
}


export type DirectorPhase =
  | "thinking"
  | "analyzing_image"
  | "decomposing_scene"
  | "choosing_model"
  | "writing_prompt";

export type DirectorStepKind =
  | "reading"
  | "mining"
  | "skill"
  | "preflight"
  | "thinking"
  | "reference"
  | "model"
  | "prompt"
  | "error";

export type DirectorStepEvent = {
  id: string;
  kind: DirectorStepKind;
  label: string;
  status: "running" | "done" | "failed";
  detail?: string;
};

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/director-agent`;

export async function callDirectorAgent(
  messages: DirectorMsg[],
  attachments: Attachment[],
): Promise<AgentResponse> {
  const { data, error } = await supabase.functions.invoke("director-agent", {
    body: { messages, attachments },
  });
  if (error) throw error;
  return data as AgentResponse;
}

/**
 * Streams the agent response. Calls `onPartial` with a progressively-built
 * AgentResponse whenever new tool-argument JSON has accumulated enough to
 * be parseable. Resolves with the final response.
 *
 * NOTE: tool-call argument deltas often arrive as fragments of JSON; we
 * tolerate parse failures and only emit partials when JSON.parse succeeds
 * on the (loosely closed) accumulator.
 */
export class DirectorTimeoutError extends Error {
  retryable = true;
  constructor(message = "The Director took too long to respond.") {
    super(message);
    this.name = "DirectorTimeoutError";
  }
}

export class DirectorHttpError extends Error {
  retryable: boolean;
  status: number;
  constructor(status: number, message: string, retryable: boolean) {
    super(message);
    this.name = "DirectorHttpError";
    this.status = status;
    this.retryable = retryable;
  }
}

export type StreamOptions = {
  /** Abort if no chunk is received for this many ms. Default 30s. */
  idleTimeoutMs?: number;
  /** Abort the whole request after this many ms. Default 120s. */
  totalTimeoutMs?: number;
  /** Called when the director enters a new phase (drives the typing indicator). */
  onPhase?: (phase: DirectorPhase) => void;
  /** Called with structured Director activity steps as they arrive from the backend. */
  onStep?: (step: DirectorStepEvent) => void;
};

export type HandoffLockedSpec = {
  source?: "movprompt" | "marketing";
  model?: string;
  aspect?: string;
  duration?: number | "auto";
};

export async function streamDirectorAgent(
  messages: DirectorMsg[],
  attachments: Attachment[],
  onPartial: (partial: AgentResponse) => void,
  signal?: AbortSignal,
  options: StreamOptions & {
    tasteProfile?: TasteProfile | null;
    mode?: "director" | "free_chat";
    lockedSpec?: HandoffLockedSpec | null;
    sessionId?: string | null;
  } = {},
): Promise<AgentResponse> {
  const idleTimeoutMs = options.idleTimeoutMs ?? 30_000;
  const totalTimeoutMs = options.totalTimeoutMs ?? 120_000;
  const onPhase = options.onPhase;
  const onStep = options.onStep;
  const tasteProfile = options.tasteProfile ?? null;
  const mode = options.mode ?? "director";
  const lockedSpec = options.lockedSpec ?? null;




  // Initial phase — analyzing image if any visual attachment is present.
  const hasVisual = attachments.some(
    (a) => a.kind === "image" || a.kind === "video_keyframes",
  );
  let currentPhase: DirectorPhase = hasVisual ? "analyzing_image" : "thinking";
  const emitPhase = (next: DirectorPhase) => {
    if (next === currentPhase) return;
    currentPhase = next;
    try {
      onPhase?.(next);
    } catch {
      /* ignore */
    }
  };
  // Emit the initial phase so the UI doesn't stay on the default.
  try {
    onPhase?.(currentPhase);
  } catch {
    /* ignore */
  }

  const controller = new AbortController();
  let timedOut: "idle" | "total" | null = null;

  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onExternalAbort);
  }

  const totalTimer = setTimeout(() => {
    timedOut = "total";
    controller.abort();
  }, totalTimeoutMs);

  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      timedOut = "idle";
      controller.abort();
    }, idleTimeoutMs);
  };

  const cleanup = () => {
    clearTimeout(totalTimer);
    if (idleTimer) clearTimeout(idleTimer);
    if (signal) signal.removeEventListener("abort", onExternalAbort);
  };

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    cleanup();
    throw new DirectorHttpError(401, "Not authenticated", false);
  }

  let resp: Response;
  try {
    resetIdle();
    resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ messages, attachments, stream: true, tasteProfile, mode, lockedSpec, sessionId: options.sessionId ?? null }),
      signal: controller.signal,
    });
  } catch (err: any) {
    cleanup();
    if (timedOut) throw new DirectorTimeoutError(
      timedOut === "idle"
        ? "The Director stopped streaming. Check your connection and try again."
        : "The Director took too long to respond. Try again.",
    );
    const e = new Error(err?.message || "Network error contacting the Director.");
    (e as any).retryable = true;
    throw e;
  }

  if (!resp.ok || !resp.body) {
    cleanup();
    let msg = "Director request failed";
    try {
      const j = await resp.json();
      msg = j.error || msg;
    } catch {
      /* ignore */
    }
    if (resp.status === 429)
      throw new DirectorHttpError(429, "Too many requests — wait a moment and try again.", true);
    if (resp.status === 402)
      throw new DirectorHttpError(402, "AI credits exhausted. Add credits in Workspace → Usage.", false);
    if (resp.status === 401 || resp.status === 403)
      throw new DirectorHttpError(resp.status, "Your session expired — please sign in again.", false);
    throw new DirectorHttpError(resp.status, msg, resp.status >= 500);
  }

  const activeSkill = resp.headers.get("x-active-skill") || undefined;


  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let toolName = "";
  let toolArgs = "";
  let textContent = "";
  let done = false;

  const tryEmitPartial = () => {
    if (!toolName || !toolArgs) return;
    // Try to parse what we have so far. JSON.parse on a half-emitted object
    // fails — so only fire when the brace count balances.
    let depth = 0;
    let inString = false;
    let escape = false;
    for (const ch of toolArgs) {
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    if (depth !== 0) return;
    try {
      const parsed = JSON.parse(toolArgs);
      onPartial({ kind: toolName as any, activeSkill, ...parsed });
    } catch {
      /* ignore */
    }
  };

  try {
    while (!done) {
      const { value, done: streamDone } = await reader.read();
      resetIdle();
      if (streamDone) break;
      buf += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        let line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line || line.startsWith(":")) continue;
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") {
          done = true;
          break;
        }
        try {
          const j = JSON.parse(payload);
          // Custom Director step event (injected by edge function before the AI body).
          if (j && j._step && onStep) {
            try { onStep(j._step as DirectorStepEvent); } catch { /* ignore */ }
            continue;
          }
          const delta = j.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.tool_calls?.[0]) {
            const tc = delta.tool_calls[0];
            if (tc.function?.name) {
              toolName = tc.function.name;
              // Map tool name → phase
              if (toolName === "ask_model_choice") emitPhase("choosing_model");
              else if (toolName === "generate_prompt") emitPhase("writing_prompt");
              else if (toolName === "ask_clarification") emitPhase("thinking");
            }
            if (tc.function?.arguments) {
              toolArgs += tc.function.arguments;
              // Heuristic: scene decomposition keywords inside streamed args.
              if (
                toolName === "generate_prompt" &&
                /foreground|midground|background|key light|lighting/i.test(toolArgs)
              ) {
                emitPhase("decomposing_scene");
              }
              tryEmitPartial();
            }
          } else if (delta.content) {
            textContent += delta.content;
          }
        } catch {
          // partial JSON across chunk boundary — re-buffer
          buf = line + "\n" + buf;
          break;
        }
      }
    }
  } catch (err: any) {
    cleanup();
    if (timedOut)
      throw new DirectorTimeoutError(
        timedOut === "idle"
          ? "The Director stopped streaming. Check your connection and try again."
          : "The Director took too long to respond. Try again.",
      );
    const e = new Error(err?.message || "Connection to the Director was interrupted.");
    (e as any).retryable = true;
    throw e;
  }

  cleanup();

  if (toolName) {
    try {
      const parsed = JSON.parse(toolArgs || "{}");
      return { kind: toolName as any, activeSkill, ...parsed };
    } catch {
      return { kind: "message", content: textContent, activeSkill };
    }
  }
  return { kind: "message", content: textContent, activeSkill };
}

export type VideoJob = {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  provider: string;
  prompt: string;
  video_url?: string | null;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
  completed_at?: string | null;
  processing_stage?: "preparing" | "rendering" | "securing_output" | "quality_review" | "ready" | "cancelling" | "failed" | "cancelled";
  fal_request_id?: string | null;
  fal_status_url?: string | null;
  fal_response_url?: string | null;
  session_id?: string | null;
  liked?: boolean;
};

import type { VideoOptions } from "./videoModelControls";

function isProviderReadyImageUrl(value: string): boolean {
  const trimmed = value.trim();
  return /^https:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed);
}

function sanitizeReferenceImages(referenceImages?: string[]): string[] {
  return Array.from(
    new Set(
      (referenceImages ?? [])
        .filter((url): url is string => typeof url === "string")
        .map((url) => url.trim())
        .filter((url) => url.length > 0)
        .filter(isProviderReadyImageUrl),
    ),
  );
}

export async function submitVideoJob(
  prompt: string,
  provider: string,
  sessionId?: string | null,
  options?: VideoOptions,
  referenceImages?: string[],
  extras?: {
    storyboard_session_id?: string;
    storyboard_shot_index?: number;
    metadata?: Record<string, unknown> | null;
  },
): Promise<VideoJob> {
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) {
    throw new Error("Prompt is empty — generate or select a prompt first.");
  }

  const safeReferenceImages = sanitizeReferenceImages(referenceImages);
  if ((referenceImages?.length ?? 0) > 0 && safeReferenceImages.length === 0) {
    throw new Error("The selected reference image is still local or invalid. Please use an uploaded image before rendering.");
  }

  const { data, error } = await supabase.functions.invoke("generate-video", {
    body: {
      prompt: normalizedPrompt,
      provider,
      session_id: sessionId,
      options,
      reference_image_urls: safeReferenceImages.length > 0 ? safeReferenceImages : undefined,
      storyboard_session_id: extras?.storyboard_session_id,
      storyboard_shot_index: extras?.storyboard_shot_index,
      metadata: extras?.metadata ?? undefined,
    },
  });
  if (error) throw error;
  return data as VideoJob;
}

export type StoryboardShotPlan = {
  index: number;
  panel_url: string;
  hint?: string;
};

export type StoryboardShotResult = {
  index: number;
  prompt: string;
  breakdown: Breakdown;
};

export type StoryboardBatch = {
  shots: StoryboardShotResult[];
  locked_spec: LockedSpec;
  model_id: string;
  title: string;
};

export async function generateStoryboardBatch(input: {
  locked_spec: LockedSpec;
  model_id: string;
  character_ref_urls: string[];
  panels: StoryboardShotPlan[];
  brief?: string;
}): Promise<StoryboardBatch> {
  const { data, error } = await supabase.functions.invoke("director-agent", {
    body: { action: "generate_storyboard_batch", ...input },
  });
  if (error) throw error;
  return data as StoryboardBatch;
}

export async function pollVideoJob(jobId: string): Promise<VideoJob> {
  const { data, error } = await supabase.functions.invoke("generate-video", {
    body: { action: "status", job_id: jobId },
  });
  if (error) throw new Error(error.message || "Could not poll job");
  return data as VideoJob;
}

export async function cancelVideoJob(jobId: string): Promise<VideoJob> {
  const { data, error } = await supabase.functions.invoke("generate-video", {
    body: { action: "cancel", job_id: jobId },
  });
  if (error) throw new Error(error.message || "Could not cancel job");
  return data as VideoJob;
}

export async function startCreatorGeneration(input: { projectId: string; projectVersionId: string; quoteId: string; idempotencyKey: string; mode: "template" | "advanced"; prompt: string; capability: "video.cinematic" | "video.product_fidelity"; options: VideoOptions; referenceImages?: string[]; metadata?: Record<string, unknown>; rightsAttested: boolean; }): Promise<{ runId: string; job: VideoJob }> {
  if (!input.rightsAttested) {
    throw new Error("Confirm that you have permission to use the supplied assets before generating.");
  }
  if (isFeatureEnabled("portableAuth")) {
    const run = await portableCreatorApi.startRender({
      projectId: input.projectId,
      projectVersionId: input.projectVersionId,
      quoteId: input.quoteId,
      rightsAttested: true,
    }, input.idempotencyKey);
    return {
      runId: run.id,
      job: {
        id: run.id,
        created_at: run.createdAt,
        updated_at: run.updatedAt,
        completed_at: run.completedAt,
        status: run.status === "processing" ? "processing" : "queued",
        provider: run.capability,
        prompt: input.prompt,
        video_url: null,
        error: null,
      },
    };
  }
  const { data, error } = await supabase.functions.invoke("start-generation", { body: { project_id: input.projectId, project_version_id: input.projectVersionId, quote_id: input.quoteId, idempotency_key: input.idempotencyKey, mode: input.mode, prompt: input.prompt, capability: input.capability, options: input.options, reference_image_urls: input.referenceImages, metadata: input.metadata, rights_attested: input.rightsAttested } });
  if (error) throw error;
  if (!data?.run?.id || !data?.job?.id) throw new Error("The render operation could not be created.");
  return { runId: data.run.id, job: data.job as VideoJob };
}

export async function pollCreatorGeneration(runId: string, guest = false): Promise<VideoJob> {
  if (isFeatureEnabled("portableAuth")) {
    const run = await portableCreatorApi.renderStatus(runId);
    const status: VideoJob["status"] = run.status === "completed"
      ? "completed"
      : run.status === "failed" || run.status === "cancelled"
        ? "failed"
        : run.status === "processing" || run.status === "cancelling"
          ? "processing"
          : "queued";
    const videoUrl = status === "completed" && run.outputAvailable
      ? await (guest ? portableCreatorApi.guestPreview(run.projectId, run.id) : portableCreatorApi.outputDownload(run.projectId, run.id))
      : null;
    return {
      id: run.id,
      status,
      provider: run.capability,
      prompt: "",
      video_url: videoUrl,
      error: run.error?.message ?? run.error?.code ?? (run.status === "cancelled" ? "Generation was cancelled." : null),
      processing_stage: run.processingStage,
      created_at: run.createdAt,
      updated_at: run.updatedAt,
      completed_at: run.completedAt,
    };
  }
  const { data, error } = await supabase.functions.invoke("generation-status", { body: { run_id: runId } });
  if (error) throw error;
  if (!data?.job) throw new Error("The render job is still being prepared.");
  return data.job as VideoJob;
}

export async function cancelCreatorGeneration(runId: string) {
  if (isFeatureEnabled("portableAuth")) {
    return portableCreatorApi.cancelRender(runId, `render-cancel:${runId}`);
  }
  const { data, error } = await supabase.functions.invoke("cancel-generation", { body: { run_id: runId } });
  if (error) throw error;
  return data;
}

export type ModerateImageResult = {
  eligible: boolean;
  severity: "safe" | "borderline" | "blocked";
  categories: string[];
  reason: string;
  degraded?: boolean;
};

export async function moderateImage(imageUrl: string): Promise<ModerateImageResult> {
  try {
    const { data, error } = await supabase.functions.invoke("moderate-image", {
      body: { image_url: imageUrl },
    });
    if (error) throw error;
    return data as ModerateImageResult;
  } catch {
    // Fail-open on transport errors so users aren't blocked by infra issues.
    return {
      eligible: true,
      severity: "safe",
      categories: [],
      reason: "",
      degraded: true,
    };
  }
}

export async function rewritePromptSafe(
  originalPrompt: string,
  rejectionReason: string,
  modelId: string,
  categories?: string[],
): Promise<{ rewritten_prompt: string; changes_summary: string }> {
  const { data, error } = await supabase.functions.invoke("director-agent", {
    body: {
      action: "rewrite_safe",
      original_prompt: originalPrompt,
      rejection_reason: rejectionReason,
      categories,
      model_id: modelId,
    },
  });
  if (error) throw error;
  return data as { rewritten_prompt: string; changes_summary: string };
}

export type AdSceneBrief = {
  subject?: "product" | "app";
  format?: { label?: string; fragment?: string; custom?: string };
  hook?: { label?: string; fragment?: string };
  setting?: { label?: string; fragment?: string; custom?: string };
  brand?: { name?: string; description?: string; tagline?: string | null; audience?: string | null } | null;
  brands?: Array<{ name?: string; description?: string; tagline?: string | null; audience?: string | null }>;
  character?: { name?: string; role?: string | null; description?: string | null; shot_type?: "face" | "full" } | null;
  characters?: Array<{ name?: string; role?: string | null; description?: string | null; shot_type?: "face" | "full" }>;

  location?: { place?: string; hasImage?: boolean } | null;
  /** Free-text adaptation layer — preset stays locked, this tweaks tone/details. */
  userNote?: string;
  brandIdentity?: {
    primary_color?: string | null;
    supporting_colors?: string[] | null;
    avoid_colors?: string[] | null;
    typography_vibe?: string | null;
    font_hint?: string | null;
    mood_notes?: string | null;
    tagline?: string | null;
    lighting_style?: string | null;
    finish_vibe?: string | null;
    pacing?: string | null;
    logo_treatment?: string | null;
    brand_voice?: string | null;
    industry?: string | null;
  } | null;
  /** Up to ~3 prompts from the user's previously-liked ads, used as style references. */
  likedExamples?: string[];
};

export async function writeAdScene(
  brief: AdSceneBrief,
  signal?: AbortSignal,
): Promise<string> {
  // We need AbortSignal support and supabase.functions.invoke doesn't expose it,
  // so call the function URL directly with fetch.
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/write-ad-scene`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
    body: JSON.stringify(brief),
    signal,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error || `Scene draft failed (${resp.status})`);
  }
  const data = await resp.json();
  return typeof data?.scene === "string" ? data.scene : "";
}
