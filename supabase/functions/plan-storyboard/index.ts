// plan-storyboard: text-only Director call that returns a structured shot plan
// for the user to review/edit BEFORE paying credits to render panels.
//
// Input: { story, shot_count, location?, tone?, subject_summary?, style_spec? }
// Output: { shared_style, grammar_note, shots: [{title, beat, shot_type, camera_move, lens, lighting, mood}] }
//
// Charges a small text-reasoning credit; refunds on failure.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  chargeCredits,
  refundCredits,
  priceFor,
  InsufficientCreditsError,
  insufficientResponse,
} from "../_shared/credits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_FALLBACK_PRICE = 1;

type Body = {
  story?: string;
  shot_count?: 3 | 6 | 9;
  location?: string;
  tone?: string;
  subject_summary?: string;
  style_spec?: Record<string, string | undefined>;
};

type PlanShot = {
  title: string;
  beat: string;
  shot_type?: string;
  camera_move?: string;
  lens?: string;
  lighting?: string;
  mood?: string;
};

function buildSystem(shotCount: number): string {
  return `You are MovPrompt's AI Director of Photography drafting a cinematic storyboard PLAN (no image generation yet).
Return ONLY strict JSON matching this schema:
{
  "shared_style": string,            // one short paragraph: locked look/lens/lighting/grade shared by every shot
  "grammar_note": string,            // one line shot-to-shot edit grammar (e.g. "WS → MCU → insert → OTS → MS → WS, light moves clockwise")
  "shots": [ // exactly ${shotCount} items, in narrative order
    {
      "title": string,               // 2–5 words ("Cold Open", "First Sip", "Reveal")
      "beat": string,                // 1 present-tense sentence describing subject + micro-action
      "shot_type": string,           // WS / MS / MCU / CU / OTS / insert
      "camera_move": string,         // static / slow push / dolly in / pan / handheld micro-drift / crane
      "lens": string,                // focal length range e.g. "35mm", "85mm"
      "lighting": string,            // key direction + practicals + time of day + color temp
      "mood": string                 // exactly 3 words, comma-separated
    }
  ]
}
Hard rules:
- Output VALID JSON only. No markdown fences, no commentary, no trailing text.
- Exactly ${shotCount} shots, ordered as a watchable mini-edit.
- Cuts must feel deliberate — vary shot type and camera move between adjacent shots; do not repeat the same framing twice in a row.
- Lock the visual style across every shot (same lens family, same lighting logic, same color grade).
- Beats are concrete and shootable — no vague ideas like "moody scene".`;
}

function buildUser(body: Body, shotCount: number): string {
  const lines: string[] = [];
  lines.push(`STORY / LOGLINE:\n${(body.story || "").trim()}`);
  lines.push(`SHOT COUNT: ${shotCount}`);
  if (body.location) lines.push(`LOCATION: ${body.location.trim()}`);
  if (body.tone) lines.push(`TONE: ${body.tone.trim()}`);
  if (body.subject_summary) lines.push(`SUBJECT (locked, every shot must feature this exact subject):\n${body.subject_summary.trim()}`);
  if (body.style_spec && Object.keys(body.style_spec).length) {
    const spec = Object.entries(body.style_spec)
      .filter(([, v]) => !!v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    if (spec) lines.push(`LOCKED VISUAL SPEC (echo verbatim in every shot's lens/lighting/mood):\n${spec}`);
  }
  return lines.join("\n\n");
}

function extractJson(raw: string): unknown {
  // Strip code fences and any prose surrounding the JSON object.
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const body = fence ? fence[1] : raw;
  const first = body.indexOf("{");
  const last = body.lastIndexOf("}");
  if (first === -1 || last === -1) throw new Error("no_json_in_response");
  return JSON.parse(body.slice(first, last + 1));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      auth: { persistSession: false },
    });
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    const story = (body.story || "").trim();
    if (!story) {
      return new Response(JSON.stringify({ error: "story required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const shotCount: 3 | 6 | 9 =
      body.shot_count === 3 || body.shot_count === 9 ? body.shot_count : 6;

    const price = await priceFor("storyboard_plan", PLAN_FALLBACK_PRICE);
    try {
      if (price > 0) {
        await chargeCredits({ userId, amount: price, reason: "storyboard_plan", metadata: { shot_count: shotCount } });
      }
    } catch (e) {
      if (e instanceof InsufficientCreditsError) return insufficientResponse(corsHeaders);
      throw e;
    }

    let plan: { shared_style: string; grammar_note: string; shots: PlanShot[] };
    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: buildSystem(shotCount) },
            { role: "user", content: buildUser(body, shotCount) },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        throw new Error(`ai_${resp.status}: ${t.slice(0, 200)}`);
      }
      const j = await resp.json();
      const raw = j?.choices?.[0]?.message?.content;
      if (typeof raw !== "string") throw new Error("no_content");
      const parsed = extractJson(raw) as any;
      if (!parsed || !Array.isArray(parsed.shots)) throw new Error("malformed");
      // Coerce to exactly shotCount shots
      const shots: PlanShot[] = (parsed.shots as any[]).slice(0, shotCount).map((s) => ({
        title: String(s.title || "").slice(0, 80),
        beat: String(s.beat || "").slice(0, 600),
        shot_type: s.shot_type ? String(s.shot_type).slice(0, 60) : undefined,
        camera_move: s.camera_move ? String(s.camera_move).slice(0, 80) : undefined,
        lens: s.lens ? String(s.lens).slice(0, 40) : undefined,
        lighting: s.lighting ? String(s.lighting).slice(0, 200) : undefined,
        mood: s.mood ? String(s.mood).slice(0, 80) : undefined,
      }));
      if (shots.length < Math.min(3, shotCount)) throw new Error("too_few_shots");
      plan = {
        shared_style: String(parsed.shared_style || "").slice(0, 600),
        grammar_note: String(parsed.grammar_note || "").slice(0, 240),
        shots,
      };
    } catch (e) {
      console.error("plan-storyboard failed", e);
      if (price > 0) {
        try {
          await refundCredits({ userId, amount: price, reason: "storyboard_plan_refund", metadata: { reason: String((e as Error).message).slice(0, 120) } });
        } catch (re) {
          console.error("plan-storyboard refund failed", re);
        }
      }
      return new Response(JSON.stringify({ error: "plan_failed", detail: String((e as Error).message).slice(0, 200) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(plan), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("plan-storyboard error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message).slice(0, 200) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
