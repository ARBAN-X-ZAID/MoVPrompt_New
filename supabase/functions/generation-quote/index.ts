import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { resolveCapability } from "../_shared/capabilityRegistry.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = await request.json();
    const capability = resolveCapability(String(body.capability || "video.seedance.latest"), "video");
    const duration = Math.max(3, Math.min(30, Math.round(Number(body.duration_seconds) || 8)));
    const credits = Math.max(1, duration * (capability.creditsPerSecond || 18));
    const authHeader = request.headers.get("Authorization") || "";
    let userId: string | null = null;
    if (authHeader.startsWith("Bearer ")) {
      const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
      const { data } = await client.auth.getUser();
      userId = data.user?.id || null;
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    let entitlementEligible = !userId;
    if (userId) {
      const { data } = await admin.from("creator_entitlements").select("status").eq("user_id", userId).eq("entitlement_type", "starter_template_render").maybeSingle();
      entitlementEligible = data?.status === "available";
    }
    const now = Date.now();
    const expiresAt = new Date(now + 5 * 60_000).toISOString();
    const hashBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ capability: capability.alias, duration, templateVersionId: body.template_version_id || body.template_id || null })));
    const configurationHash = Array.from(new Uint8Array(hashBytes)).map((value) => value.toString(16).padStart(2, "0")).join("");
    const { data: quoteRow, error: quoteError } = await admin.from("creator_generation_quotes").insert({ user_id: userId, template_version_id: body.template_version_id || null, capability_alias: capability.alias, credits, entitlement_eligible: entitlementEligible, breakdown: [{ label: `${duration} seconds of video`, credits }], configuration_hash: configurationHash, expires_at: expiresAt }).select("id").single();
    if (quoteError || !quoteRow) throw new Error("quote_persistence_failed");
    return new Response(JSON.stringify({ quoteId: quoteRow.id, capability: capability.alias, credits, entitlementEligible, expiresAt, breakdown: [{ label: `${duration} seconds of video`, credits }] }), { headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "quote_failed";
    return new Response(JSON.stringify({ error: message }), { status: message === "capability_unavailable" ? 409 : 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
