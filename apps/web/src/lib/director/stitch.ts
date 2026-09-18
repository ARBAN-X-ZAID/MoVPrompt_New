// Director plan stitching — reuses the existing `story-stitch` edge function
// (originally built for the 4-act story flow) in generic `job_ids` mode to
// concat N completed Director shots into one MP4 via fal's ffmpeg compose.
import { supabase } from "@/integrations/supabase/client";

export type StitchTransition = "hard_cut" | "crossfade" | "match_cut";

// Frame rate used by TransitionPreview's frame-accurate scrubber. Shared with
// the server so per-boundary overrides round-trip 1:1.
export const STITCH_FPS = 24;

// Per-boundary override the user dialed in via the TransitionPreview markers.
// boundaryIdx N applies between clip N and clip N+1 (length = clips.length - 1).
export type TransitionOverride = {
  offsetFrames: number; // shift the cut point ± relative to preset default
  overlapFrames: number; // explicit overlap length for this boundary
};

export const TRANSITION_LABELS: Record<StitchTransition, string> = {
  hard_cut: "Hard cut",
  crossfade: "Crossfade",
  match_cut: "Match cut",
};

export const TRANSITION_DESCRIPTIONS: Record<StitchTransition, string> = {
  hard_cut: "Back-to-back, no blend (default)",
  crossfade: "0.5s overlap between adjacent clips",
  match_cut: "Tight cut — trim 0.15s tail for cinematic pacing",
};

export type StitchResult = {
  job_id: string;
  video_url?: string;
  status: string;
  cancelled?: boolean;
};

export async function stitchPlanShots(args: {
  sessionId: string;
  jobIds: string[];
  durations: number[];
  title?: string;
  transition?: StitchTransition;
  // Per-boundary overrides from the preview scrubber. When omitted the server
  // falls back to the preset default for every boundary.
  overrides?: TransitionOverride[];
}): Promise<StitchResult> {
  const { data, error } = await supabase.functions.invoke("story-stitch", {
    body: {
      session_id: args.sessionId,
      job_ids: args.jobIds,
      durations: args.durations,
      title: args.title,
      transition: args.transition ?? "hard_cut",
      overrides: args.overrides,
      fps: STITCH_FPS,
    },
  });
  if (error) throw new Error(error.message || "Stitch failed");
  if (!data) throw new Error("Stitch returned no data");
  return data as StitchResult;
}


// Server-side cancel — flips the stitch video_jobs row to 'cancelled' so the
// running story-stitch poll loop bails out, calls fal.queue.cancel to actually
// stop the ffmpeg compose request, and refunds credits.
export async function cancelStitch(args: {
  sessionId?: string;
  jobId?: string;
}): Promise<{ job_id: string; status: string; cancelled: boolean }> {
  const { data, error } = await supabase.functions.invoke("story-stitch-cancel", {
    body: { session_id: args.sessionId, job_id: args.jobId },
  });
  if (error) throw new Error(error.message || "Cancel failed");
  return data as { job_id: string; status: string; cancelled: boolean };
}
