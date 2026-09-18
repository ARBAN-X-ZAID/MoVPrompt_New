// Stage 3 client helper for the Director → Orchestrator executor loop.
//
// Invokes the `director-orchestrate` edge function for a given session.
// The edge function submits one video render per eligible shot via the
// existing `generate-video` function and patches director_sessions.plan
// with `rendering` status + video_job_id per shot. Completion is then
// reconciled client-side by listening to video_jobs (see PlanPanel).

import { supabase } from "@/integrations/supabase/client";

export type OrchestrateResult = {
  submitted: number;
  failed: number;
  results: Array<
    | { shotId: string; ok: true; jobId: string | null }
    | { shotId: string; ok: false; error: string }
  >;
};

export async function orchestratePlan(
  sessionId: string,
  shotIds?: string[],
): Promise<OrchestrateResult> {
  const { data, error } = await supabase.functions.invoke("director-orchestrate", {
    body: { sessionId, shotIds },
  });
  if (error) throw error;
  return data as OrchestrateResult;
}
