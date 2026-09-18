// Lovable AI: critique a generated cinematic prompt and return a score, weaknesses, and one-click fix suggestions.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 15;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const b = rateBuckets.get(ip);
  if (!b || now > b.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  b.count += 1;
  return b.count > RATE_MAX;
}

const SYSTEM_PROMPT = `You are a senior cinematographer reviewing an AI-generated video prompt for a generative video model.

Score the prompt on cinematography fundamentals: shot grammar, lens / framing clarity, lighting logic (key/fill/practicals/quality/direction), camera movement specificity, mood/tone consistency, continuity (for multi-shot), and concrete subject action. Penalize vague adjectives ("cinematic", "beautiful"), missing lens/lighting cues, vague camera movement ("dynamic shot"), and generic atmosphere.

Return:
- score: 0–100 integer (60 = passable, 80 = strong, 90+ = excellent)
- strengths: 1–3 short bullets (max 12 words each)
- weaknesses: 1–4 short bullets (max 12 words each)
- suggestions: 2–4 actionable fixes. Each suggestion has:
  - dimension: one of "lens" | "lighting" | "movement" | "continuity" | "mood" | "detail"
  - label: ≤6 words, e.g. "Add 35mm lens choice"
  - addendum: ONE concrete instruction (≤220 chars) the prompt-writer can append. Phrase as a directive: "Specify a 35mm anamorphic lens with a shallow depth of field on the subject…". Do NOT rewrite the whole prompt.

Be terse. No fluff. Return via the score_prompt tool only.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const result = body?.result;
    const targetModel: string = typeof body?.targetModel === "string" ? body.targetModel : "unknown";
    const workflowType: string = typeof body?.workflowType === "string" ? body.workflowType : "single";
    const description: string = typeof body?.description === "string" ? body.description.slice(0, 1500) : "";

    if (!result || typeof result.mainPrompt !== "string" || result.mainPrompt.length < 10) {
      return new Response(JSON.stringify({ error: "missing or invalid result" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const truncate = (s: string | undefined, n: number) => (s ?? "").slice(0, n);
    const userText = `Target model: ${targetModel}
Workflow: ${workflowType}
${description ? `User's intent: ${description}\n` : ""}

=== MAIN PROMPT ===
${truncate(result.mainPrompt, 4000)}

${result.negativePrompt ? `=== NEGATIVE ===\n${truncate(result.negativePrompt, 600)}\n` : ""}${result.cameraSuggestions ? `=== CAMERA ===\n${truncate(result.cameraSuggestions, 600)}\n` : ""}${result.audioBlock ? `=== AUDIO ===\n${truncate(result.audioBlock, 400)}\n` : ""}${result.shotStructure ? `=== STRUCTURE ===\n${truncate(result.shotStructure, 800)}\n` : ""}`;

    const tool = {
      type: "function",
      function: {
        name: "score_prompt",
        description: "Return a structured cinematography critique of the prompt.",
        parameters: {
          type: "object",
          properties: {
            score: { type: "integer", minimum: 0, maximum: 100 },
            strengths: { type: "array", items: { type: "string", maxLength: 80 }, maxItems: 3 },
            weaknesses: { type: "array", items: { type: "string", maxLength: 80 }, maxItems: 4 },
            suggestions: {
              type: "array",
              minItems: 2,
              maxItems: 4,
              items: {
                type: "object",
                properties: {
                  dimension: { type: "string", enum: ["lens", "lighting", "movement", "continuity", "mood", "detail"] },
                  label: { type: "string", maxLength: 60 },
                  addendum: { type: "string", maxLength: 240 },
                },
                required: ["dimension", "label", "addendum"],
                additionalProperties: false,
              },
            },
          },
          required: ["score", "strengths", "weaknesses", "suggestions"],
          additionalProperties: false,
        },
      },
    };

    const callAi = (model: string) =>
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userText },
          ],
          tools: [tool],
          tool_choice: { type: "function", function: { name: "score_prompt" } },
        }),
      });

    const PRIMARY = "google/gemini-3.5-flash";
    const FALLBACK = "google/gemini-2.5-flash";
    let aiResp = await callAi(PRIMARY);
    if ([429, 402, 500, 502, 503, 504].includes(aiResp.status)) {
      aiResp = await callAi(FALLBACK);
    }

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("critique gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: `AI gateway error (${aiResp.status})` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    if (!argsStr) {
      console.error("critique: no tool call returned", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let parsed: any;
    try { parsed = JSON.parse(argsStr); } catch {
      return new Response(JSON.stringify({ error: "Bad AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("critique-prompt error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
