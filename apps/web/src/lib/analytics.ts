import { supabase } from "@/integrations/supabase/client";
import { isFeatureEnabled } from "@/config/features";

export const getSessionId = (): string => {
  let id = localStorage.getItem("movprompt_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("movprompt_session_id", id);
  }
  return id;
};

export const trackPageVisit = async (pagePath: string = "/") => {
  if (isFeatureEnabled("portableAuth")) return;
  try {
    await supabase.from("page_visits").insert({
      page_path: pagePath,
      session_id: getSessionId(),
      user_agent: navigator.userAgent,
    });
  } catch (e) {
    console.error("Failed to track page visit:", e);
  }
};

export const trackGeneration = async (workflowType: string, targetModel: string) => {
  if (isFeatureEnabled("portableAuth")) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("generation_events").insert({
      session_id: getSessionId(),
      workflow_type: workflowType,
      target_model: targetModel,
      user_id: user?.id ?? null,
    });
  } catch (e) {
    console.error("Failed to track generation:", e);
  }
};
