// Stage 1 foundation: structured shot plan persisted on director_sessions.plan.
// Stage 2 adds the `budget` axis on PlanGlobals consumed by router.ts.

export type ShotStatus = "draft" | "ready" | "rendering" | "done" | "failed";

export type LockedAxes = {
  duration_seconds?: number;
  aspect_ratio?: string;
  audio?: "on" | "off" | "music_only" | "sfx_only";
  model?: string;
  /** True when the user explicitly chose the model (overrides router). */
  model_user_override?: boolean;
  resolution?: string;
  /** Number of shots to split the clip into (Seedance mandatory when duration ≥ 8s). */
  shot_count?: number;
};

export type ShotMetadata = {
  /** ID of the video_jobs row spawned by the orchestrator for this shot. */
  video_job_id?: string;
} & Record<string, unknown>;

export type PlannedShot = {
  id: string;
  intent: string;
  /** Free-text hints the router can score against (subject, action, mood…). */
  hints?: string;
  locked: LockedAxes;
  prompt?: string;
  status: ShotStatus;
  outputUrl?: string;
  error?: string;
  metadata?: ShotMetadata;
};

export type RoutingBudget = "quality" | "balanced" | "cheap";

export type PlanGlobals = {
  aspect_ratio?: string;
  duration_seconds?: number;
  style_notes?: string;
  budget?: RoutingBudget;
  /** Director-chosen split for the next Seedance render (1 = one continuous take). */
  shot_count?: number;
};

export type DirectorPlan = {
  shots: PlannedShot[];
  globals: PlanGlobals;
};

export const emptyPlan: DirectorPlan = { shots: [], globals: {} };

export function isPlan(value: unknown): value is DirectorPlan {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.shots) && typeof v.globals === "object" && v.globals !== null;
}

export function readPlan(raw: unknown): DirectorPlan {
  return isPlan(raw) ? raw : emptyPlan;
}

const STATUS_LABEL: Record<ShotStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  rendering: "Rendering",
  done: "Done",
  failed: "Failed",
};

export function statusLabel(s: ShotStatus): string {
  return STATUS_LABEL[s];
}

export function missingAxes(shot: PlannedShot): (keyof LockedAxes)[] {
  const need: (keyof LockedAxes)[] = ["duration_seconds", "aspect_ratio", "audio", "model"];
  return need.filter((k) => shot.locked[k] === undefined || shot.locked[k] === null);
}
