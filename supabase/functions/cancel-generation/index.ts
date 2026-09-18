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
  if (["completed","failed","cancelled"].includes(run.status)) return json({ run });
  const { data: job } = await admin.from("video_jobs").select("id").eq("render_run_id", run.id).eq("user_id", userData.user.id).maybeSingle();
  if (!job) return json({ error: "job_not_found" }, 404);
  await admin.from("creator_render_runs").update({ status: "cancelling" }).eq("id", run.id);
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-video`, { method: "POST", headers: { Authorization: authorization, apikey: Deno.env.get("SUPABASE_ANON_KEY")!, "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel", job_id: job.id }) });
  const result = await response.json();
  if (!response.ok) {
    await admin.from("creator_render_runs").update({ status: "processing" }).eq("id", run.id);
    return json(result, response.status);
  }
  await Promise.all([admin.from("creator_render_runs").update({ status: "cancelled", refund_status: run.charged_credits > 0 ? "refunded" : "not_required", completed_at: new Date().toISOString() }).eq("id", run.id), admin.from("creator_projects").update({ status: "ready" }).eq("id", run.project_id).eq("user_id", run.user_id)]);
  return json({ run: { ...run, status: "cancelled" }, job: result });
});
