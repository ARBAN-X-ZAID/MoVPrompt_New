import { supabase } from "@/integrations/supabase/client";

export type TasteProfile = {
  likedPrompts: string[];
  dislikedPrompts: string[];
  chipBoosts: Record<string, number>;
  verbosity: "terse" | "balanced" | "detailed";
  chipReliance: "chips_first" | "mixed" | "freeform_friendly";
};

export const EMPTY_TASTE_PROFILE: TasteProfile = {
  likedPrompts: [],
  dislikedPrompts: [],
  chipBoosts: {},
  verbosity: "balanced",
  chipReliance: "mixed",
};

/** Build a per-user taste profile from likes + thumbs feedback. Safe to call without auth. */
export async function loadTasteProfile(userId: string | null): Promise<TasteProfile> {
  if (!userId) return EMPTY_TASTE_PROFILE;

  const [likedJobs, feedback] = await Promise.all([
    supabase
      .from("video_jobs")
      .select("prompt")
      .eq("user_id", userId)
      .eq("liked", true)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("director_message_feedback")
      .select("content_kind, content, rating, chip_label, question_text")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const likedPrompts = (likedJobs.data ?? [])
    .map((r) => (r.prompt || "").trim())
    .filter(Boolean)
    .slice(0, 3);

  const rows = feedback.data ?? [];

  const dislikedPrompts = rows
    .filter((r) => r.rating === -1 && r.content_kind === "prompt" && r.content)
    .map((r) => r.content as string)
    .slice(0, 3);

  // Chip boosts: sum ratings per chip_label (when feedback was on a chip)
  // OR per chip mentioned in the content of liked/disliked recommendations.
  const chipBoosts: Record<string, number> = {};
  for (const r of rows) {
    if (r.chip_label) {
      chipBoosts[r.chip_label] = (chipBoosts[r.chip_label] || 0) + (r.rating ?? 0);
    }
  }

  // Verbosity inference: look at thumbs on questions.
  let qUp = 0;
  let qDown = 0;
  let qLongDown = 0;
  let qShortDown = 0;
  for (const r of rows) {
    if (r.content_kind !== "question") continue;
    if (r.rating === 1) qUp += 1;
    if (r.rating === -1) {
      qDown += 1;
      const len = (r.question_text || r.content || "").length;
      if (len > 140) qLongDown += 1;
      else if (len < 60) qShortDown += 1;
    }
  }
  let verbosity: TasteProfile["verbosity"] = "balanced";
  if (qDown >= 3 && qLongDown > qShortDown) verbosity = "terse";
  else if (qDown >= 3 && qShortDown > qLongDown) verbosity = "detailed";

  // Chip reliance: ratio of chip-related feedback vs question feedback.
  const chipVotes = rows.filter((r) => r.chip_label).length;
  const qVotes = qUp + qDown;
  let chipReliance: TasteProfile["chipReliance"] = "mixed";
  if (chipVotes >= 4 && chipVotes > qVotes * 1.5) chipReliance = "chips_first";
  else if (qVotes >= 4 && qVotes > chipVotes * 1.5) chipReliance = "freeform_friendly";

  return { likedPrompts, dislikedPrompts, chipBoosts, verbosity, chipReliance };
}
