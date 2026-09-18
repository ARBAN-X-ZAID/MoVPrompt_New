// Client helper for the plan-storyboard edge function.
// Given a user story + shot count, returns a structured plan the user can
// review/edit before paying credits to render the panels.

import { supabase } from "@/integrations/supabase/client";

export type StoryboardPlanShot = {
  title: string;
  beat: string;
  shot_type?: string;
  camera_move?: string;
  lens?: string;
  lighting?: string;
  mood?: string;
};

export type StoryboardPlan = {
  shared_style: string;
  grammar_note: string;
  shots: StoryboardPlanShot[];
};

export async function planStoryboard(input: {
  story: string;
  shot_count: 3 | 6 | 9;
  location?: string;
  tone?: string;
  subject_summary?: string;
  style_spec?: Record<string, string | undefined>;
}): Promise<StoryboardPlan> {
  const { data, error } = await supabase.functions.invoke("plan-storyboard", {
    body: input,
  });
  if (error) throw error;
  if (!data || !Array.isArray((data as any).shots)) {
    throw new Error("Plan response malformed");
  }
  return data as StoryboardPlan;
}

// Convert a structured shot back into the single-string `per_shot_prompts`
// entry that generate-reference-image expects (30–60 words, ordered fields).
export function shotToPanelBeat(shot: StoryboardPlanShot, index: number, total: number): string {
  const parts: string[] = [];
  parts.push(shot.beat.trim());
  if (shot.shot_type) parts.push(shot.shot_type.trim());
  if (shot.camera_move) parts.push(shot.camera_move.trim());
  if (shot.lens) parts.push(`lens ${shot.lens.trim()}`);
  if (shot.lighting) parts.push(shot.lighting.trim());
  if (shot.mood) parts.push(`mood: ${shot.mood.trim()}`);
  // index/total help the edge function preserve order in the chained pipeline
  void index; void total;
  return parts.join(". ");
}
