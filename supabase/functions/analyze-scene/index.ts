import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 10;
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): { limited: boolean; retryAfter?: number } {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW);
  requestLog.set(ip, timestamps);
  if (timestamps.length >= RATE_LIMIT_MAX) {
    const oldest = timestamps[0];
    const retryAfter = Math.ceil((oldest + RATE_LIMIT_WINDOW - now) / 1000);
    return { limited: true, retryAfter };
  }
  timestamps.push(now);
  return { limited: false };
}

function badRequest(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `You are an expert scene analyst for cinematic video production. You will be given one or more images. Analyze EACH image separately and return the results grouped by frame index.

For each image (frame), decompose it into distinct visual elements that a director would consider when planning camera movement and animation.

For each element, provide:
- id: a unique short identifier prefixed with frame index (e.g. "f0_subject_1", "f1_bg_1")
- category: one of "Subject", "Background", "Lighting", "Atmosphere", "Objects", "Colors"
- description: a concise label (e.g. "Woman in red dress", "Golden hour side lighting")
- details: 1-2 sentences elaborating on the element's current state, texture, position, and animation potential

Analyze each image thoroughly. Return 4-8 elements per frame covering the most important visual components. Focus on elements that are relevant for deciding what should stay static vs what should be animated in a video.

IMPORTANT: Return results as a "frames" array where each frame has a frameIndex (0-based) and its own elements array. Even for a single image, wrap it in the frames structure.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { limited, retryAfter } = isRateLimited(clientIp);
  if (limited) {
    return new Response(JSON.stringify({ error: "Too many requests. Please wait and try again." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(retryAfter) },
    });
  }

  try {
    const body = await req.json();
    const { images } = body;

    if (!Array.isArray(images) || images.length === 0 || images.length > 2) {
      return badRequest("Invalid images: must be an array of 1-2 items");
    }
    for (const img of images) {
      if (typeof img !== "string" || img.length > 2_000_000) {
        return badRequest("Each image must be a base64 string under 2MB");
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY env var is missing");
      return new Response(JSON.stringify({ error: "Service misconfigured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent: any[] = [
      { type: "text", text: `Analyze ${images.length === 1 ? "this image" : "these " + images.length + " images separately"} and decompose each into distinct scene elements for cinematic direction. ${images.length > 1 ? "Image 1 is the first frame, Image 2 is the second frame. Analyze each independently." : ""}` },
    ];
    for (const img of images) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${img}` },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "scene_breakdown",
              description: "Return structured scene elements from image analysis, grouped by frame",
              parameters: {
                type: "object",
                properties: {
                  frames: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        frameIndex: { type: "number", description: "Zero-based frame index" },
                        elements: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id: { type: "string", description: "Unique element identifier" },
                              category: {
                                type: "string",
                                enum: ["Subject", "Background", "Lighting", "Atmosphere", "Objects", "Colors"],
                                description: "Element category",
                              },
                              description: { type: "string", description: "Concise label for the element" },
                              details: { type: "string", description: "Elaborated description with animation potential" },
                            },
                            required: ["id", "category", "description", "details"],
                            additionalProperties: false,
                          },
                          description: "Array of 4-8 scene elements for this frame",
                        },
                      },
                      required: ["frameIndex", "elements"],
                      additionalProperties: false,
                    },
                    description: "Array of frames, each containing its scene elements",
                  },
                },
                required: ["frames"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "scene_breakdown" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please wait a moment and try again." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Scene analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "AI returned unexpected format" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-scene error:", e);
    return new Response(JSON.stringify({ error: "Internal server error. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
