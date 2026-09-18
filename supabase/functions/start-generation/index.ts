import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { resolveCapability } from "../_shared/capabilityRegistry.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  const authorization = request.headers.get("Authorization") || "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: "unauthorized" }, 401);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  try {
    const body = await request.json();
    const idempotencyKey = String(body.idempotency_key || "");
    if (idempotencyKey.length < 8) return json({ error: "invalid_idempotency_key" }, 400);
    const existing = await admin.from("creator_render_runs").select("*").eq("user_id", user.id).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing.data) {
      const job = await admin.from("video_jobs").select("*").eq("render_run_id", existing.data.id).maybeSingle();
      return json({ run: existing.data, job: job.data });
    }
    const capability = resolveCapability(String(body.capability || "video.seedance.latest"), "video");
    const [projectResult, versionResult, quoteResult] = await Promise.all([
      admin.from("creator_projects").select("id,user_id").eq("id", body.project_id).eq("user_id", user.id).maybeSingle(),
      admin.from("creator_project_versions").select("id,project_id,user_id,configuration").eq("id", body.project_version_id).eq("project_id", body.project_id).eq("user_id", user.id).maybeSingle(),
      admin.from("creator_generation_quotes").select("*").eq("id", body.quote_id).maybeSingle(),
    ]);
    if (!projectResult.data || !versionResult.data) return json({ error: "project_not_found" }, 404);
    const quote = quoteResult.data;
    if (!quote || (quote.user_id && quote.user_id !== user.id) || new Date(quote.expires_at).getTime() <= Date.now() || quote.capability_alias !== capability.alias) return json({ error: "quote_expired", message: "Refresh the price before generating." }, 409);
    if (body.rights_attested !== true) return json({ error: "rights_attestation_required" }, 400);
    const { data: run, error: runError } = await admin.from("creator_render_runs").insert({ project_id: body.project_id, project_version_id: body.project_version_id, user_id: user.id, idempotency_key: idempotencyKey, capability_alias: capability.alias, quote_id: quote.id, quoted_credits: quote.credits, status: "submitting" }).select("*").single();
    if (runError || !run) {
      const raced = await admin.from("creator_render_runs").select("*").eq("user_id", user.id).eq("idempotency_key", idempotencyKey).maybeSingle();
      if (raced.data) return json({ run: raced.data, job: null });
      throw runError || new Error("render_run_create_failed");
    }
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-video`, { method: "POST", headers: { Authorization: authorization, apikey: Deno.env.get("SUPABASE_ANON_KEY")!, "Content-Type": "application/json" }, body: JSON.stringify({ prompt: body.prompt, provider: capability.alias, options: body.options, reference_image_urls: body.reference_image_urls, metadata: { ...(body.metadata || {}), beginner_flow: body.mode === "template", pending_generation_id: idempotencyKey, creator_render_run_id: run.id } }) });
    const generation = await response.json();
    if (!response.ok || !generation?.id) {
      await admin.from("creator_render_runs").update({ status: "failed", error_code: generation?.error || "provider_submit_failed", error_message: generation?.message || generation?.error || "Could not submit generation" }).eq("id", run.id);
      return json(generation, response.status || 502);
    }
    const chargedCredits = Number(generation.metadata?.charged_credits) || 0;
    const starterUsed = generation.metadata?.starter_entitlement_used === true;
    await Promise.all([
      admin.from("video_jobs").update({ render_run_id: run.id }).eq("id", generation.id).eq("user_id", user.id),
      admin.from("creator_render_runs").update({ status: generation.status === "processing" ? "processing" : "queued", provider_request_id: generation.fal_request_id || null, charged_credits: chargedCredits, starter_entitlement_used: starterUsed, charged_at: chargedCredits > 0 || starterUsed ? new Date().toISOString() : null }).eq("id", run.id),
      admin.from("creator_projects").update({ status: "generating" }).eq("id", body.project_id).eq("user_id", user.id),
    ]);
    return json({ run: { ...run, status: generation.status === "processing" ? "processing" : "queued", charged_credits: chargedCredits, starter_entitlement_used: starterUsed }, job: { ...generation, render_run_id: run.id } }, 202);
  } catch (error) {
    console.error("start-generation", error);
    return json({ error: error instanceof Error ? error.message : "start_generation_failed" }, 500);
  }
});
