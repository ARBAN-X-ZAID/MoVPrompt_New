import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const subject: "product" | "app" = body.subject === "app" ? "app" : "product";
    let imageUrl: string | null = body.imageUrl ?? null;

    if (!imageUrl && body.imagePath) {
      const { data } = await supabase.storage
        .from("director-uploads")
        .createSignedUrl(body.imagePath, 60 * 10);
      imageUrl = data?.signedUrl ?? null;
    }
    if (!imageUrl) return json({ error: "image required" }, 400);

    // Gemini only accepts PNG/JPEG/WebP/GIF via URL. AVIF (and other formats) fail
    // with a 400. Fetch the image server-side and inline it as a data URL with its
    // actual MIME type so the gateway can pass it through regardless of extension.
    let inlineImage = imageUrl;
    try {
      const imgRes = await fetch(imageUrl);
      if (imgRes.ok) {
        const ct = imgRes.headers.get("content-type") || "image/jpeg";
        const buf = new Uint8Array(await imgRes.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        inlineImage = `data:${ct};base64,${btoa(bin)}`;
      }
    } catch (e) {
      console.warn("analyze-brand-image: inline fetch failed, falling back to URL", e);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "missing api key" }, 500);

    const sys =
      subject === "app"
        ? `You are a brand + product analyst. The image is a mobile app icon or screenshot.
Return a full PRODUCT FACT SHEET so a video AI can render the app faithfully.
- name: brand/app name (visible text or best guess)
- description: ≤120 chars, what the app does
- tagline: ≤60 chars, punchy
- category: ≤40 chars, app type (e.g. "habit tracker", "AI photo editor", "finance dashboard")
- visual_parts: ≤180 chars, what is on the screen — key UI elements, screens, mascot, icon shape (e.g. "rounded square icon, blue gradient, white play triangle, subtle shadow")
- materials: ≤80 chars, finish/feel (e.g. "glassmorphism, soft shadows, glossy") or null
- hero_colors: 3-5 dominant colors as plain English words (e.g. ["electric blue","white","soft purple"])
- packaging: ≤40 chars, form factor (e.g. "iPhone screenshot", "app icon on home screen") or null
If you cannot confidently infer a field, set it to null. Never invent ingredients/parts that aren't visible.`
        : `You are a brand + product analyst. The image is a product photo or logo.
Return a full PRODUCT FACT SHEET so a video AI can render this exact product faithfully.
- name: brand/product name (visible text or best guess)
- description: ≤120 chars, what it is and what it does
- tagline: ≤60 chars, punchy
- category: ≤40 chars, specific product type (e.g. "smash burger", "running sneaker", "vitamin C serum", "cold brew can")
- visual_parts: ≤220 chars, comma-separated list of every visible physical element a video must show — for food list ingredients & build (e.g. "toasted sesame brioche bun, double smash beef patty, melted American cheese, pickles, shredded lettuce"); for objects list components (e.g. "white knit upper, black swoosh, gum sole, white laces").
- materials: ≤100 chars, surface/finish (e.g. "frosted glass bottle with matte black cap", "brushed aluminum can", "soft leather upper") or null
- hero_colors: 3-5 dominant colors as plain English words (e.g. ["golden brown","deep red","cream"])
- packaging: ≤60 chars, what it is served/sold in (e.g. "on parchment paper in red basket", "12oz aluminum can", "30ml glass dropper bottle") or null
If you cannot confidently infer a field, set it to null. NEVER invent ingredients, parts or colors not visible in the image — accuracy matters more than completeness.`;

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
              { type: "text", text: "Analyze this image and return the product fact sheet." },
              { type: "image_url", image_url: { url: inlineImage } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "set_brand",
              description: "Return inferred product fact sheet.",
              parameters: {
                type: "object",
                properties: {
                  name: { type: ["string", "null"] },
                  description: { type: ["string", "null"] },
                  tagline: { type: ["string", "null"] },
                  category: { type: ["string", "null"] },
                  visual_parts: { type: ["string", "null"] },
                  materials: { type: ["string", "null"] },
                  hero_colors: {
                    type: ["array", "null"],
                    items: { type: "string" },
                  },
                  packaging: { type: ["string", "null"] },
                },
                required: [
                  "name",
                  "description",
                  "tagline",
                  "category",
                  "visual_parts",
                  "materials",
                  "hero_colors",
                  "packaging",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "set_brand" } },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return json({ error: "ai_error", status: aiRes.status, detail: txt }, aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 500);
    }

    const data = await aiRes.json();
    const args =
      data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "{}";
    const parsed = JSON.parse(args);

    return json({
      name: clamp(parsed.name, 80),
      description: clamp(parsed.description, 120),
      tagline: clamp(parsed.tagline, 60),
      category: clamp(parsed.category, 40),
      visual_parts: clamp(parsed.visual_parts, 220),
      materials: clamp(parsed.materials, 100),
      hero_colors: clampArr(parsed.hero_colors, 5, 30),
      packaging: clamp(parsed.packaging, 60),
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

function clampArr(v: unknown, maxItems: number, maxLen: number): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((x) => x.length > 0)
    .slice(0, maxItems)
    .map((x) => (x.length > maxLen ? x.slice(0, maxLen) : x));
  return out.length > 0 ? out : null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
