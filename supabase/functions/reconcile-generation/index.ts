import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

serve(async (request) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (request.headers.get("Authorization") !== `Bearer ${serviceKey}`) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: runs, error } = await admin.from("creator_render_runs").select("*").in("status", ["submitting","queued","processing","cancelling"]).lt("updated_at", new Date(Date.now() - 15_000).toISOString()).order("updated_at", { ascending: true }).limit(20);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  const results: Array<{ id: string; status: string }> = [];
  for (const run of runs || []) {
    const { data: job } = await admin.from("video_jobs").select("*").eq("render_run_id", run.id).maybeSingle();
    if (!job) { results.push({ id: run.id, status: "waiting_for_job" }); continue; }
    const response = await fetch(`${url}/functions/v1/generate-video`, { method: "POST", headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "x-internal-user-id": run.user_id, "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", job_id: job.id }) });
    const current = await response.json();
    if (current.status === "failed") {
      await Promise.all([admin.from("creator_render_runs").update({ status: "failed", error_message: current.error || "Generation failed", refund_status: run.charged_credits > 0 ? "refunded" : "not_required", completed_at: new Date().toISOString() }).eq("id", run.id), admin.from("creator_projects").update({ status: "failed" }).eq("id", run.project_id).eq("user_id", run.user_id)]);
      results.push({ id: run.id, status: "failed" });
      continue;
    }
    if (current.status === "completed" && current.video_url) {
      try {
        const outputResponse = await fetch(current.video_url, { signal: AbortSignal.timeout(60_000) });
        if (!outputResponse.ok) throw new Error("output_fetch_failed");
        const output = await outputResponse.arrayBuffer();
        if (output.byteLength > 750_000_000) throw new Error("output_too_large");
        const path = `${run.user_id}/${run.project_id}/${run.project_version_id}/${run.id}.mp4`;
        const upload = await admin.storage.from("creator-outputs").upload(path, output, { contentType: outputResponse.headers.get("content-type") || "video/mp4", upsert: true });
        if (upload.error) throw upload.error;
        await Promise.all([admin.from("creator_render_runs").update({ status: "completed", output_bucket: "creator-outputs", output_path: path, completed_at: new Date().toISOString() }).eq("id", run.id), admin.from("creator_projects").update({ status: "review", current_accepted_version_id: run.project_version_id }).eq("id", run.project_id).eq("user_id", run.user_id)]);
        results.push({ id: run.id, status: "completed" });
      } catch (copyError) {
        console.warn("reconcile output copy", run.id, copyError);
        results.push({ id: run.id, status: "copy_retry" });
      }
      continue;
    }
    await admin.from("creator_render_runs").update({ status: "processing" }).eq("id", run.id);
    results.push({ id: run.id, status: "processing" });
  }
  return new Response(JSON.stringify({ reconciled: results.length, results }), { headers: { "Content-Type": "application/json" } });
});
