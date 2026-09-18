// Lovable AI: rewrite a user's short scene description into a clear, vivid director's brief.
// Generic cinematic style — model-agnostic.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiter (per-IP).
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_MAX;
}

const SYSTEM_PROMPT = `You rewrite a user's short scene description into a clear, vivid director's brief for an AI video generator. Preserve the user's intent and any \`@N\` mentions verbatim. Add concrete cinematic details only where the draft is vague: subject action, camera move, framing, lighting quality + direction, mood, pacing. Keep it 2–4 sentences, plain prose, no lists, no headings, no emojis. Do not invent characters, locations, or objects the user didn't imply. Output only the rewritten description text — no preamble.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const sceneSummary =
      typeof body?.sceneSummary === "string" ? body.sceneSummary.trim().slice(0, 1000) : "";

    if (description.length < 3) {
      return new Response(JSON.stringify({ error: "description too short" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (description.length > 4000) {
      return new Response(JSON.stringify({ error: "description too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent = sceneSummary
      ? `Scene elements: ${sceneSummary}\n\nUser's draft:\n${description}`
      : `User's draft:\n${description}`;

    const callAi = (model: string) =>
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
        }),
      });

    const PRIMARY_MODEL = "google/gemini-3.5-flash";
    const FALLBACK_MODEL = "google/gemini-2.5-flash";
    const SHOULD_FALLBACK = (s: number) => s === 429 || s === 402 || s === 500 || s === 502 || s === 503 || s === 504;
    let aiResp = await callAi(PRIMARY_MODEL);
    let usedFallback = false;
    if (SHOULD_FALLBACK(aiResp.status)) {
      console.warn(`enhance: primary ${PRIMARY_MODEL} returned ${aiResp.status}, retrying with ${FALLBACK_MODEL}`);
      aiResp = await callAi(FALLBACK_MODEL);
      usedFallback = true;
    }

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, text);
      const isUnavailable = aiResp.status === 503 || aiResp.status === 502 || aiResp.status === 500 || aiResp.status === 504;
      return new Response(JSON.stringify({ error: isUnavailable ? "AI service is temporarily unavailable. Please try again in a moment." : `AI gateway error (${aiResp.status})` }), {
        status: isUnavailable ? 503 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const enhanced: string = data?.choices?.[0]?.message?.content?.trim?.() ?? "";
    if (!enhanced) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = { ...corsHeaders, "Content-Type": "application/json" };
    if (usedFallback) headers["X-Used-Fallback"] = "1";
    return new Response(JSON.stringify({ enhanced, usedFallback }), { headers });
  } catch (err) {
    console.error("enhance-description error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
