import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    let imageUrl: string | null = body.imageUrl ?? null;
    const shotType: "face" | "full" = body.shotType === "full" ? "full" : "face";

    if (!imageUrl && body.imagePath) {
      const { data } = await supabase.storage
        .from("director-uploads")
        .createSignedUrl(body.imagePath, 60 * 10);
      imageUrl = data?.signedUrl ?? null;
    }
    if (!imageUrl) return json({ error: "image required" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "missing api key" }, 500);

    const sysFace =
      "You are a casting director writing a reusable character reference for an AI video generator. The uploaded photo is a FACE / HEADSHOT — describe only what is visible above the shoulders so the same person can be re-rendered in any outfit. Cover: apparent age range, gender presentation, ethnicity/skin tone, hair (length, color, texture, style), face shape, eyes (color, shape), eyebrows, nose, lips, distinguishing features (freckles, moles, glasses, jewelry, tattoos), and overall vibe/expression. Do NOT describe body, outfit, or anything below the shoulders. Also propose a short friendly first name and a one-word role (Talent, Founder, Customer, Athlete). Keep description under 420 chars, factual and neutral. Do not name a real person.";

    const sysFull =
      "You are a casting director writing a reusable character reference for an AI video generator. The uploaded photo is a FULL LOOK (head-to-toe) — describe BOTH the person and the exact outfit so the same person AND same outfit can be re-rendered consistently across every shot. Cover face details (age range, gender presentation, ethnicity/skin tone, hair, eyes, distinguishing features), build/height impression, posture, AND wardrobe in detail (every visible garment with color/fabric/fit, footwear, accessories, jewelry). Also propose a short friendly first name and a one-word role (Talent, Founder, Customer, Athlete). Keep description under 500 chars, factual and neutral. Do not name a real person.";

    const sys = shotType === "full" ? sysFull : sysFace;


    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this character reference photo and return fields." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "set_character",
              description: "Return inferred character fields.",
              parameters: {
                type: "object",
                properties: {
                  name: { type: ["string", "null"], description: "Friendly first name suggestion" },
                  role: { type: ["string", "null"], description: "One-word role: Talent, Founder, Customer, Athlete, etc." },
                  description: { type: ["string", "null"], description: "Detailed reusable physical description" },
                },
                required: ["name", "role", "description"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "set_character" } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return json(
        { error: "ai_error", status: aiRes.status, detail: txt },
        aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 500,
      );
    }

    const data = await aiRes.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "{}";
    const parsed = JSON.parse(args);

    return json({
      name: clamp(parsed.name, 60),
      role: clamp(parsed.role, 40),
      description: clamp(parsed.description, 500),
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

function clamp(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
