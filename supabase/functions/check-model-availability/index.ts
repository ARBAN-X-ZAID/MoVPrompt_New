// Probes the Lovable AI Gateway for each tracked model id in
// `public.model_availability` and updates the row with the result.
// Called on a 15-minute cron and on-demand from the admin UI.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

type Row = {
  model_id: string;
  display_name: string;
  available: boolean;
  first_available_at: string | null;
};

type ProbeResult = {
  model_id: string;
  was: boolean;
  now: boolean | "unchanged";
  reason: string;
};

async function probeOne(modelId: string, apiKey: string): Promise<{ available: boolean | null; error?: string }> {
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
    });

    if (res.ok) {
      // Drain body to avoid resource leak.
      await res.text();
      return { available: true };
    }

    const bodyText = await res.text();
    const lower = bodyText.toLowerCase();

    // Hard "model doesn't exist" signals → available = false.
    const notFound =
      res.status === 404 ||
      lower.includes("model not found") ||
      lower.includes("unsupported model") ||
      lower.includes("unknown model") ||
      lower.includes("invalid model") ||
      lower.includes("does not exist");

    if (notFound) {
      return { available: false, error: `HTTP ${res.status}: ${bodyText.slice(0, 280)}` };
    }

    // Transient (429, 5xx, auth, etc.) → don't change the flag.
    return { available: null, error: `HTTP ${res.status}: ${bodyText.slice(0, 280)}` };
  } catch (e) {
    return { available: null, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: rows, error: readErr } = await admin
      .from("model_availability")
      .select("model_id, display_name, available, first_available_at");

    if (readErr) throw readErr;

    const results: ProbeResult[] = [];
    const nowIso = new Date().toISOString();

    for (const row of (rows ?? []) as Row[]) {
      const { available, error } = await probeOne(row.model_id, LOVABLE_API_KEY);

      // Transient — only bump last_checked_at.
      if (available === null) {
        await admin
          .from("model_availability")
          .update({ last_checked_at: nowIso, last_error: error ?? null })
          .eq("model_id", row.model_id);
        results.push({ model_id: row.model_id, was: row.available, now: "unchanged", reason: error ?? "transient" });
        continue;
      }

      const patch: Record<string, unknown> = {
        available,
        last_checked_at: nowIso,
        last_error: available ? null : error ?? null,
        updated_at: nowIso,
      };
      if (available && !row.first_available_at) {
        patch.first_available_at = nowIso;
      }

      await admin
        .from("model_availability")
        .update(patch)
        .eq("model_id", row.model_id);

      results.push({
        model_id: row.model_id,
        was: row.available,
        now: available,
        reason: available ? "ok" : error ?? "not_available",
      });
    }

    return new Response(JSON.stringify({ checked_at: nowIso, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-model-availability error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
