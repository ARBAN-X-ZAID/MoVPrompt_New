import { supabase } from "@/integrations/supabase/client";

export type AdTemplateJSON = {
  name: string;
  tagline: string;
  goal: string;
  tone: string[];
  duration_seconds: number;
  aspect_ratio: string;
  pacing: string;
  camera_language: { style: string; lens: string; movement: string };
  motion_intensity: string;
  lighting: string;
  color_palette: string;
  sound_design: { music: string; sfx: string; voiceover: string };
  shots: Array<{
    index: number;
    duration_s: number;
    beat: string;
    description: string;
    camera: string;
    on_screen_text: string;
  }>;
  hook_copy: string[];
  cta_copy: string[];
  recommended_models: string[];
  negative_prompt: string;
  tags: string[];
};

export type AdTemplateRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  concept_source: "text" | "video";
  concept_input: string | null;
  concept_video_url: string | null;
  template_json: AdTemplateJSON;
  preview_video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  aspect_ratio: string | null;
  tags: string[] | null;
  status: "draft" | "ready" | "archived";
  created_at: string;
  updated_at: string;
};

export async function analyzeConcept(input: {
  description?: string;
  video_base64?: string;
  video_mime?: string;
  video_url?: string;
  refine_from?: AdTemplateJSON;
  feedback?: string;
}): Promise<AdTemplateJSON> {
  const { data, error } = await supabase.functions.invoke("analyze-ad-concept", { body: input });
  if (error) throw new Error(error.message || "Failed to analyze concept");
  if (!data?.template) throw new Error("No template returned");
  return data.template as AdTemplateJSON;
}

export async function saveTemplate(params: {
  template: AdTemplateJSON;
  concept_source: "text" | "video";
  concept_input?: string | null;
  concept_video_url?: string | null;
  status?: "draft" | "ready";
}): Promise<AdTemplateRow> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("ad_templates")
    .insert({
      user_id: uid,
      name: params.template.name,
      description: params.template.tagline,
      concept_source: params.concept_source,
      concept_input: params.concept_input ?? null,
      concept_video_url: params.concept_video_url ?? null,
      template_json: params.template as any,
      duration_seconds: params.template.duration_seconds,
      aspect_ratio: params.template.aspect_ratio,
      tags: params.template.tags ?? [],
      status: params.status ?? "ready",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as AdTemplateRow;
}

export async function listMyTemplates(): Promise<AdTemplateRow[]> {
  const { data, error } = await supabase
    .from("ad_templates")
    .select("*")
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AdTemplateRow[];
}

export async function deleteTemplate(id: string) {
  const { error } = await supabase.from("ad_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadConceptVideo(file: File): Promise<{ path: string; signedUrl: string }> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Not signed in");
  const ext = file.name.split(".").pop() || "mp4";
  const path = `${uid}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("ad-concepts").upload(path, file, {
    contentType: file.type || "video/mp4",
    upsert: false,
  });
  if (error) throw error;
  const { data: signed, error: signErr } = await supabase.storage
    .from("ad-concepts")
    .createSignedUrl(path, 60 * 60);
  if (signErr) throw signErr;
  return { path, signedUrl: signed.signedUrl };
}

export async function fileToBase64(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      const idx = s.indexOf(",");
      resolve(idx >= 0 ? s.slice(idx + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
