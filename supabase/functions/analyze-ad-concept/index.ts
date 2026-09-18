import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an elite Ad Template Architect for short-form video advertising (Reels, TikTok, YouTube Shorts, in-feed ads).

Your job: turn a user's concept — either a short text description OR a reference concept video — into a REUSABLE, model-agnostic AD TEMPLATE that MovPrompt users can apply to their brand/product later.

An ad template is NOT a finished ad. It is the RECIPE: pacing, structure, camera language, motion, tone, sound design, and copy hooks that can be re-skinned with different brands.

Return a strict JSON via the tool call. Do NOT include brand/product/character specifics from the reference — abstract them into placeholders like {product}, {brand}, {subject}, {location}.`;

const TEMPLATE_TOOL = {
  type: "function",
  function: {
    name: "ad_template",
    description: "Return a reusable ad template extracted or authored from the user's concept",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Short catchy template name, 2-5 words" },
        tagline: { type: "string", description: "One-sentence description of the template's vibe" },
        goal: { type: "string", enum: ["awareness", "conversion", "product_reveal", "storytelling", "ugc", "brand_film"] },
        tone: { type: "array", items: { type: "string" }, description: "3-5 tone descriptors, e.g. 'energetic', 'aspirational'" },
        duration_seconds: { type: "number", description: "Total intended length in seconds (5-30)" },
        aspect_ratio: { type: "string", enum: ["9:16", "1:1", "16:9", "4:5"] },
        pacing: { type: "string", enum: ["slow-build", "steady", "punchy", "rapid-cut"] },
        camera_language: {
          type: "object",
          properties: {
            style: { type: "string", description: "e.g. handheld doc, locked-off tripod, gimbal glide, drone reveal" },
            lens: { type: "string", description: "e.g. wide 24mm, macro, anamorphic 35mm" },
            movement: { type: "string", description: "Dominant movement pattern across the ad" },
          },
          required: ["style", "lens", "movement"],
          additionalProperties: false,
        },
        motion_intensity: { type: "string", enum: ["minimal", "moderate", "high", "extreme"] },
        lighting: { type: "string", description: "Lighting recipe (e.g. 'high-contrast rim + practical neon')" },
        color_palette: { type: "string", description: "Color grade / palette description" },
        sound_design: {
          type: "object",
          properties: {
            music: { type: "string", description: "Music vibe / bpm range" },
            sfx: { type: "string", description: "Signature SFX or beats" },
            voiceover: { type: "string", enum: ["none", "vo_narration", "ugc_selfie", "dialogue"] },
          },
          required: ["music", "sfx", "voiceover"],
          additionalProperties: false,
        },
        shots: {
          type: "array",
          minItems: 3,
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              index: { type: "number" },
              duration_s: { type: "number", description: "Shot length in seconds" },
              beat: { type: "string", enum: ["hook", "setup", "reveal", "benefit", "proof", "cta", "outro"] },
              description: { type: "string", description: "What happens in this shot — use placeholders like {product}, {subject}" },
              camera: { type: "string", description: "Shot-level camera instruction" },
              on_screen_text: { type: "string", description: "Suggested overlay copy (may be empty)" },
            },
            required: ["index", "duration_s", "beat", "description", "camera", "on_screen_text"],
            additionalProperties: false,
          },
        },
        hook_copy: { type: "array", items: { type: "string" }, description: "3 alternative first-3-seconds hook lines" },
        cta_copy: { type: "array", items: { type: "string" }, description: "3 alternative CTA lines" },
        recommended_models: {
          type: "array",
          items: { type: "string" },
          description: "Video model IDs best suited: kling-v3-pro, veo-3.1, seedance-2.0, kling-v2.1-master, etc.",
        },
        negative_prompt: { type: "string", description: "What to avoid across shots" },
        tags: { type: "array", items: { type: "string" }, description: "3-6 discovery tags" },
      },
      required: [
        "name","tagline","goal","tone","duration_seconds","aspect_ratio","pacing",
        "camera_language","motion_intensity","lighting","color_palette","sound_design",
        "shots","hook_copy","cta_copy","recommended_models","negative_prompt","tags",
      ],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json();
    const { description, video_base64, video_mime, video_url, refine_from, feedback } = body ?? {};

    if (!description && !video_base64 && !video_url && !refine_from) {
      return new Response(JSON.stringify({ error: "Provide a description, a video, or a template to refine." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Service misconfigured" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userContent: any[] = [];

    if (refine_from) {
      userContent.push({
        type: "text",
        text: `Refine this existing ad template based on user feedback. Return an updated template that preserves what works and applies the requested changes.\n\nCURRENT TEMPLATE:\n${JSON.stringify(refine_from, null, 2)}\n\nUSER FEEDBACK:\n${feedback ?? "Improve it."}`,
      });
    } else if (video_base64) {
      userContent.push({
        type: "text",
        text: `Analyze this reference concept video and extract a reusable ad template. Abstract product/brand into placeholders. ${description ? `Additional context: ${description}` : ""}`,
      });
      // Gemini via OpenAI-compatible chat supports image_url for images; for video we pass as base64 data URL through image_url too when small, otherwise gateway rejects. Prefer video_url path for larger files.
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${video_mime || "video/mp4"};base64,${video_base64}` },
      });
    } else if (video_url) {
      userContent.push({
        type: "text",
        text: `Analyze the reference concept video at this URL and extract a reusable ad template. Abstract product/brand into placeholders. ${description ? `Additional context: ${description}` : ""}\n\nVIDEO URL: ${video_url}`,
      });
    } else {
      userContent.push({
        type: "text",
        text: `Author a reusable ad template from this concept description:\n\n${description}`,
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-pro-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [TEMPLATE_TOOL],
        tool_choice: { type: "function", function: { name: "ad_template" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please wait a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Workspace > Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Template generation failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "AI returned unexpected format" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const parsed = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ template: parsed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("analyze-ad-concept error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
