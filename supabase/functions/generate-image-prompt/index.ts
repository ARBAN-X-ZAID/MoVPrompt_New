// Edge function: generate a pro, structured image prompt usable across image generators.
// Uses Lovable AI Gateway (no extra secrets needed) and returns structured JSON.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MODEL = "google/gemini-3.5-flash";

type ReqBody = {
  description?: string;
  attachments?: { url: string; kind: "image" | "video_keyframes" }[];
  aspect?: string;
};

const SYSTEM = `You are an elite Art Director writing PRO image-generation prompts.
Given the user's brief (and optional reference image URLs), produce ONE highly-structured image prompt the user can paste into ANY image generator (Midjourney v6, Flux 1.1 Pro, SDXL, DALL·E 3, Google Nano Banana, Ideogram).

HARD RULES
- Be concrete. Replace vague words ("beautiful", "cinematic") with named lenses, lighting setups, palettes, materials, moods.
- Never invent unrelated subjects; stay faithful to the brief. References inform STYLE/LIGHTING only, not subject content.
- No copyrighted artist names unless the user explicitly requested one.
- Each section is 1–3 dense sentences, no bullet points.

Return STRICT JSON ONLY matching this schema (no markdown, no commentary):
{
  "concept": "one-line creative concept",
  "sections": {
    "subject": "...",
    "scene": "...",
    "composition": "...",
    "lighting": "...",
    "color_mood": "...",
    "style_refs": "...",
    "lens_camera": "...",
    "technical": "...",
    "negative": "comma-separated negatives"
  },
  "variants": {
    "midjourney": "single-line MJ v6 prompt ending with --ar X:Y --style raw --stylize 250",
    "flux": "single-line Flux 1.1 Pro prompt, natural language, dense, photographic",
    "sdxl": "comma-separated SDXL tag prompt, weighted (token:1.2) where helpful, ending with a Negative: ... clause",
    "dalle": "single-line DALL·E 3 prompt, natural-language paragraph, descriptive",
    "nano_banana": "single-line prompt tuned for Google Nano Banana (Gemini image), descriptive natural language",
    "ideogram": "single-line Ideogram prompt; if text is in the image, include it in quotes",
    "universal": "single-line generator-agnostic prompt that works as a safe default"
  }
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as ReqBody;
    const description = (body.description || "").trim();
    const aspect = body.aspect || "16:9";
    const imageUrls = (body.attachments || [])
      .filter((a) => a && (a.kind === "image" || a.kind === "video_keyframes") && a.url)
      .slice(0, 4)
      .map((a) => a.url);

    if (!description && imageUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: "Provide a description or at least one reference image." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userContent: any[] = [
      {
        type: "text",
        text:
          `Target aspect ratio: ${aspect}\n` +
          `User brief: ${description || "(no text — derive concept from the reference image)"}\n\n` +
          `Write the structured JSON now.`,
      },
      ...imageUrls.map((url) => ({ type: "image_url", image_url: { url } })),
    ];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      const status = resp.status === 429 || resp.status === 402 ? resp.status : 500;
      return new Response(
        JSON.stringify({ error: `AI gateway error (${resp.status}): ${text.slice(0, 500)}` }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }
    if (!parsed?.sections || !parsed?.variants) {
      return new Response(
        JSON.stringify({ error: "Model returned malformed output", raw }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
