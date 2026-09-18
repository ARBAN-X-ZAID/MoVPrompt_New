// Image moderation via Lovable AI (Gemini 2.5 Flash multimodal).
// Called from the chat composer right after a user uploads an image / video keyframe.
// Returns a structured verdict so the UI can mark the attachment as ok / blocked.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a strict commercial-video safety classifier. You receive a single image
that a user wants to use as a reference for an AI-generated video on platforms such as
Seedance 2.0, Veo 3, Kling 2.5, and Hailuo. Apply the union of these platforms'
content policies and reject the image if ANY of the following appear:

- Nudity, sexual content, or sexually suggestive depictions of any person
- Any depiction of a minor in a suggestive, violent, or unsafe context
- Graphic violence, gore, mutilation, dead bodies, self-harm, or suicide imagery
- Real, identifiable public figures or private individuals depicted in a way that
  would impersonate or defame them (deepfake risk)
- Copyrighted characters, logos, or brand marks intended to be reproduced
- Hate symbols, extremist imagery, terrorist content
- Weapons used to threaten people, illegal-drug use, instructions for harm
- Personal identifiable information (visible IDs, credit cards, addresses)

If the image is clearly benign reference material (landscape, food, abstract art,
fully clothed people in non-suggestive poses, animals, products, architecture,
fashion shoots without nudity, etc.), mark it eligible.

Be strict but fair. Do not reject for artistic nudity in classical art, mild
violence in obvious fiction (sci-fi armor, fantasy battles), or minors who are
simply present in a normal everyday scene (school, family, sport).

Respond with ONLY a JSON object matching this exact schema, no prose:
{
  "eligible": boolean,
  "severity": "safe" | "borderline" | "blocked",
  "categories": string[],
  "reason": string
}

- "categories" lists the policy areas that apply (empty array when safe).
- "reason" is a short user-facing explanation (<= 200 chars). Empty string when safe.`;

type Verdict = {
  eligible: boolean;
  severity: "safe" | "borderline" | "blocked";
  categories: string[];
  reason: string;
};

function safeFallback(degraded = true): Verdict & { degraded?: boolean } {
  return {
    eligible: true,
    severity: "safe",
    categories: [],
    reason: "",
    degraded,
  };
}

function parseVerdict(raw: string): Verdict | null {
  // Try direct parse, then strip markdown fences, then find first {...} block.
  const candidates: string[] = [raw, raw.replace(/```json|```/g, "").trim()];
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) candidates.push(m[0]);
  for (const c of candidates) {
    try {
      const j = JSON.parse(c);
      if (typeof j?.eligible !== "boolean") continue;
      return {
        eligible: !!j.eligible,
        severity:
          j.severity === "blocked" || j.severity === "borderline" || j.severity === "safe"
            ? j.severity
            : j.eligible
              ? "safe"
              : "blocked",
        categories: Array.isArray(j.categories) ? j.categories.map(String).slice(0, 8) : [],
        reason: typeof j.reason === "string" ? j.reason.slice(0, 200) : "",
      };
    } catch {
      /* keep trying */
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      console.warn("LOVABLE_API_KEY missing — moderation degraded");
      return new Response(JSON.stringify(safeFallback(true)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // JWT validation: require an authenticated user.
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const imageUrl = typeof body?.image_url === "string" ? body.image_url : "";
    if (!imageUrl || !/^https?:\/\//.test(imageUrl)) {
      return new Response(JSON.stringify({ error: "image_url required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Classify this reference image." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.warn("moderate-image gateway error", aiResp.status, t.slice(0, 300));
      // 429/402 → degraded fail-open so users aren't blocked by infra issues.
      return new Response(JSON.stringify(safeFallback(true)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "";
    const verdict = parseVerdict(typeof raw === "string" ? raw : JSON.stringify(raw));
    if (!verdict) {
      console.warn("moderate-image: could not parse verdict", String(raw).slice(0, 300));
      return new Response(JSON.stringify(safeFallback(true)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(verdict), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("moderate-image error", e);
    return new Response(JSON.stringify(safeFallback(true)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
