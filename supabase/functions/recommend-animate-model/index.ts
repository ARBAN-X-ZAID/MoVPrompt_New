// Recommends the best video model for animating a single storyboard panel
// (image-to-video). Returns { recommended_id, alternatives[], reason }.
// Calls Lovable AI Gateway with the panel context.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Whitelist: only models that accept a starting image (image-to-video) and
// don't require a reference video. Keep in sync with src/lib/director/videoModels.ts.
const ELIGIBLE_MODELS = [
  // Kling
  { id: "kling-v3-pro",          label: "Kling 3.0 Pro",          family: "kling",    notes: "Newest, native audio, multi-shot, strong identity" },
  { id: "kling-v3-standard",     label: "Kling 3.0 Standard",     family: "kling",    notes: "Native audio, multi-shot, mid-tier" },
  { id: "kling-v3-4k",           label: "Kling 3.0 4K",           family: "kling",    notes: "Native 4K output" },
  { id: "kling-v2.5-turbo-pro",  label: "Kling 2.5 Turbo Pro",    family: "kling",    notes: "Fast pro tier, great for quick iteration" },
  { id: "kling-v2.1-master",     label: "Kling 2.1 Master",       family: "kling",    notes: "Reliable cinematic motion, safe default" },
  { id: "kling-v2-master",       label: "Kling 2 Master",         family: "kling",    notes: "Older master tier" },
  { id: "kling-v1.6-pro",        label: "Kling 1.6 Pro",          family: "kling",    notes: "Stable, balanced" },
  { id: "kling-omni",            label: "Kling 3.0 Omni",         family: "kling",    notes: "Multi-reference identity lock, best for character consistency" },
  // Veo
  { id: "veo-3.1",               label: "Veo 3.1",                family: "veo",      notes: "Latest, native audio, photoreal" },
  { id: "veo-3.1-fast",          label: "Veo 3.1 Fast",           family: "veo",      notes: "Faster Veo 3.1, slightly lower fidelity" },
  { id: "veo-3.1-lite",          label: "Veo 3.1 Lite",           family: "veo",      notes: "Cheapest Veo 3.1" },
  { id: "veo-3",                 label: "Veo 3",                  family: "veo",      notes: "Strong photoreal, no native audio" },
  // Seedance
  { id: "seedance-2.0-ref",      label: "Seedance 2.0 Reference", family: "seedance", notes: "Multi-reference identity lock + native audio (needs ref images)" },
  { id: "seedance-2.0",          label: "Seedance 2.0",           family: "seedance", notes: "Single image-to-video + native audio" },
  { id: "seedance-v1-pro",       label: "Seedance 1 Pro",         family: "seedance", notes: "Stable, good motion" },
  { id: "seedance-v1-lite",      label: "Seedance 1 Lite",        family: "seedance", notes: "Cheaper Seedance" },
  // Hailuo
  { id: "hailuo-02-pro",         label: "Hailuo 02 Pro",          family: "hailuo",   notes: "Expressive characters, dialogue lip-sync" },
  { id: "hailuo-02-standard",    label: "Hailuo 02 Standard",     family: "hailuo",   notes: "Cheaper Hailuo 02" },
  // Runway
  { id: "runway-gen3-turbo",     label: "Runway Gen-3 Turbo",     family: "runway",   notes: "Fast, stylised" },
];

const ELIGIBLE_IDS = ELIGIBLE_MODELS.map((m) => m.id);

function fallback(aspectRatio: string | undefined, mode: string) {
  // Sensible default if AI fails. For multi-panel storyboards prefer
  // multi-reference Omni for identity lock. For singles prefer audio-capable
  // Kling 3.0 Standard (cheaper than Pro, has native audio + image-to-video).
  if (mode === "all") {
    return {
      recommended_id: "kling-omni",
      alternatives: ["kling-v3-standard", "seedance-2.0-ref"],
      reason: `Kling 3.0 Omni keeps the SAME character across all ${aspectRatio || "16:9"} panels via multi-reference identity lock, with native audio. Seedance 2.0 Ref is the closest alternative.`,
    };
  }
  return {
    recommended_id: "kling-v3-standard",
    alternatives: ["veo-3.1-fast", "kling-v2.1-master"],
    reason: `Kling 3.0 Standard animates the source frame ${aspectRatio || "16:9"} with native audio and strong identity preservation. Veo 3.1 Fast for sync dialogue; Kling 2.1 Master if you want the legacy cinematic look (silent).`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const aspectRatio = body.aspectRatio || "16:9";
    const directorsNote = (body.directorsNote || "").toString().slice(0, 2000);
    const shotIndex = body.shotIndex;
    const mode = body.mode || "single"; // "single" | "all"
    const totalPanels = body.totalPanels;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify(fallback(aspectRatio, mode)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const catalog = ELIGIBLE_MODELS
      .map((m) => `- ${m.id} — ${m.label} (${m.family}): ${m.notes}`)
      .join("\n");

    const contextLines = [
      `Aspect ratio: ${aspectRatio}`,
      mode === "all"
        ? `Mode: animate ALL ${totalPanels ?? "N"} panels of a storyboard (identity & style must stay consistent across panels)`
        : `Mode: animate a single panel${shotIndex ? ` (shot #${shotIndex})` : ""}`,
      directorsNote ? `Director's note: ${directorsNote}` : "",
    ].filter(Boolean).join("\n");

    const systemPrompt = `You are an AI Director of Photography recommending the best image-to-video model for animating a storyboard panel. Pick from the eligible catalog only.

PRIORITY ORDER:
1. CHARACTER IDENTITY — When mode is "all" (multi-panel storyboard), the SAME character must appear across every panel. Strongly prefer multi-reference models: kling-omni (best), seedance-2.0-ref. Never recommend a legacy text-to-video-only model for "all" mode.
2. NATIVE AUDIO — Models with native audio (veo-3.1*, kling-v3-pro, kling-v3-standard, kling-v3-4k, kling-omni, seedance-2.0, seedance-2.0-ref, hailuo-02-pro) sound coherent out of the box. Prefer these unless the user explicitly wants the legacy Kling 2.x look.
3. LOOK & MOTION — Once identity and audio are covered, pick on cinematic quality vs speed/cost.

Avoid kling-v2.1-master and other legacy Kling models unless the user explicitly asks for that look — they produce silent clips and lock identity less reliably than v3/omni.

Always return EXACTLY ONE id from the catalog as the recommendation plus 2 alternatives, and a one-sentence reason that mentions the audio status ("native audio" or "silent — post-mux audio").`;

    const userPrompt = `Eligible models:\n${catalog}\n\nContext:\n${contextLines}\n\nReturn your pick.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "recommend_video_model",
            description: "Return the recommended video model id plus 2 alternatives.",
            parameters: {
              type: "object",
              properties: {
                recommended_id: { type: "string", enum: ELIGIBLE_IDS },
                alternatives: {
                  type: "array",
                  items: { type: "string", enum: ELIGIBLE_IDS },
                  minItems: 2,
                  maxItems: 3,
                },
                reason: { type: "string", description: "One concise sentence (≤180 chars) explaining why the recommendation fits this panel." },
              },
              required: ["recommended_id", "alternatives", "reason"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "recommend_video_model" } },
      }),
    });

    if (!aiResp.ok) {
      console.error("AI recommend failed", aiResp.status, await aiResp.text().catch(() => ""));
      return new Response(JSON.stringify(fallback(aspectRatio, mode)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify(fallback(aspectRatio, mode)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const args = JSON.parse(toolCall.function.arguments);
    const rec = ELIGIBLE_IDS.includes(args.recommended_id) ? args.recommended_id : (mode === "all" ? "kling-omni" : "kling-v3-standard");
    const alts = Array.isArray(args.alternatives)
      ? args.alternatives.filter((id: string) => ELIGIBLE_IDS.includes(id) && id !== rec).slice(0, 3)
      : [];

    return new Response(JSON.stringify({
      recommended_id: rec,
      alternatives: alts.length ? alts : ["veo-3.1", "seedance-2.0"].filter((id) => id !== rec),
      reason: (args.reason || "").toString().slice(0, 240) || "Recommended for this shot's aspect ratio and content.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recommend-animate-model error", e);
    return new Response(JSON.stringify(fallback(undefined, "single")), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
