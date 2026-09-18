import { supabase } from "@/integrations/supabase/client";
import { compressImageFile } from "@/lib/videoFrames";

export type OnboardingWorkflow = "single" | "twoframe" | "multishot";

/**
 * Minimal one-shot generation used by the onboarding flow.
 * Skips scene breakdown (no element directions) and returns the first prompt string.
 */
export async function runOnboardingGenerate(opts: {
  file: File;
  workflow: OnboardingWorkflow;
  targetModel: string;
}): Promise<string> {
  const b64 = await compressImageFile(opts.file);
  const workflowType = opts.workflow === "twoframe" ? "twoframe" : opts.workflow === "multishot" ? "multishot" : "single";

  const { data, error } = await supabase.functions.invoke("generate-prompt", {
    body: {
      images: [b64],
      workflowType,
      description: "",
      targetModel: opts.targetModel || "any",
    },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  const first = Array.isArray(data?.results) && data.results.length > 0 ? data.results[0] : null;
  if (!first) throw new Error("No prompt returned");
  // results items typically have a `prompt` string field; fall back to the whole stringified shot.
  if (typeof first === "string") return first;
  if (typeof first.prompt === "string") return first.prompt;
  return JSON.stringify(first);
}

/** Persist the generated prompt to prompt_history so it appears in the user's library. */
export async function saveOnboardingResult(opts: {
  userId: string;
  workflow: OnboardingWorkflow;
  targetModel: string;
  prompt: string;
}) {
  const workflowType =
    opts.workflow === "twoframe" ? "twoframe" : opts.workflow === "multishot" ? "multishot" : "single";
  const { error } = await supabase.from("prompt_history").insert({
    user_id: opts.userId,
    target_model: opts.targetModel,
    workflow_type: workflowType,
    results: [{ prompt: opts.prompt }] as any,
  });
  if (error) throw error;
}
