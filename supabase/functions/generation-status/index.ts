import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  const authorization = request.headers.get("Authorization") || "";
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) return json({ error: "unauthorized" }, 401);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const body = await request.json().catch(() => ({}));
  const { data: run } = await admin.from("creator_render_runs").select("*").eq("id", body.run_id).eq("user_id", userData.user.id).maybeSingle();
  if (!run) return json({ error: "run_not_found" }, 404);
  const { data: job } = await admin.from("video_jobs").select("*").eq("render_run_id", run.id).eq("user_id", userData.user.id).maybeSingle();
  if (!job) return json({ run, job: null });
  if (["completed","failed"].includes(run.status)) {
    const signed = run.output_path ? await admin.storage.from("creator-outputs").createSignedUrl(run.output_path, 60 * 60) : null;
    return json({ run, job: { ...job, video_url: signed?.data?.signedUrl || job.video_url } });
  }
  const providerResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-video`, { method: "POST", headers: { Authorization: authorization, apikey: Deno.env.get("SUPABASE_ANON_KEY")!, "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", job_id: job.id }) });
  const currentJob = await providerResponse.json();
  if (currentJob.status === "failed") {
    await admin.from("creator_render_runs").update({ status: "failed", error_message: currentJob.error || "Generation failed", refund_status: run.charged_credits > 0 ? "refunded" : "not_required", completed_at: new Date().toISOString() }).eq("id", run.id);
    await admin.from("creator_projects").update({ status: "failed" }).eq("id", run.project_id).eq("user_id", run.user_id);
    return json({ run: { ...run, status: "failed" }, job: currentJob });
  }
  if (currentJob.status === "completed" && currentJob.video_url) {
    const outputResponse = await fetch(currentJob.video_url, { signal: AbortSignal.timeout(60_000) });
    if (!outputResponse.ok) return json({ run: { ...run, status: "processing" }, job: { ...currentJob, status: "processing" } });
    const length = Number(outputResponse.headers.get("content-length") || 0);
    if (length > 750_000_000) return json({ error: "output_too_large" }, 502);
    const output = await outputResponse.arrayBuffer();
    const path = `${run.user_id}/${run.project_id}/${run.project_version_id}/${run.id}.mp4`;
    const upload = await admin.storage.from("creator-outputs").upload(path, output, { contentType: outputResponse.headers.get("content-type") || "video/mp4", upsert: true });
    if (upload.error) return json({ error: "output_copy_failed" }, 502);
    await Promise.all([
      admin.from("creator_render_runs").update({ status: "completed", output_bucket: "creator-outputs", output_path: path, completed_at: new Date().toISOString() }).eq("id", run.id),
      admin.from("creator_projects").update({ status: "review", current_accepted_version_id: run.project_version_id }).eq("id", run.project_id).eq("user_id", run.user_id),
    ]);
    const signed = await admin.storage.from("creator-outputs").createSignedUrl(path, 60 * 60);
    return json({ run: { ...run, status: "completed", output_bucket: "creator-outputs", output_path: path }, job: { ...currentJob, video_url: signed.data?.signedUrl || currentJob.video_url } });
  }
  await admin.from("creator_render_runs").update({ status: "processing" }).eq("id", run.id);
  return json({ run: { ...run, status: "processing" }, job: currentJob });
});
