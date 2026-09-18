// story-bundle: generate the asset bundle for a story render in parallel.
// 1 character_sheet (or product sheet) + 1 prop sheet + 7 location key frames.
// All 9 generations are kicked off in parallel via the existing
// generate-reference-image function so they share the same identity-lock and
// upload pipeline.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Body = {
  aspect: "16:9" | "9:16" | "1:1";
  character_brief: string;
  character_subject_kind?: "character" | "product";
  prop_brief: string;
  location_briefs: string[]; // length 7
  character_reference_urls?: string[];
};

async function invokeGen(
  authHeader: string,
  body: Record<string, unknown>,
): Promise<{ url: string; storage_path: string } | null> {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-reference-image`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      console.warn("story-bundle: gen failed", resp.status, await resp.text());
      return null;
    }
    const j = await resp.json();
    const img = j?.images?.[0];
    if (!img?.url) return null;
    return { url: img.url, storage_path: img.storage_path };
  } catch (e) {
    console.warn("story-bundle: gen threw", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: userData, error: userErr } = await supabase.auth.getUser(
    auth.replace("Bearer ", ""),
  );
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as Body;
    if (!body.aspect || !body.character_brief || !body.prop_brief || !Array.isArray(body.location_briefs) || body.location_briefs.length !== 7) {
      return new Response(JSON.stringify({ error: "aspect, character_brief, prop_brief, and 7 location_briefs required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const charKind = body.character_subject_kind === "product" ? "product" : "character";
    const charRefs = Array.isArray(body.character_reference_urls)
      ? body.character_reference_urls.filter((u) => typeof u === "string" && u.length > 0)
      : [];

    // Fan out 9 generations in parallel — each one independently charges 5 credits
    // through the existing generate-reference-image flow.
    const jobs: Array<Promise<{ url: string; storage_path: string } | null>> = [];

    // 1) Character/subject sheet
    jobs.push(invokeGen(auth, {
      mode: "character_sheet",
      prompt: body.character_brief,
      reference_urls: charRefs,
      aspect_ratio: body.aspect,
      subject_kind: charKind,
    }));

    // 2) Prop sheet (always product layout)
    jobs.push(invokeGen(auth, {
      mode: "character_sheet",
      prompt: body.prop_brief,
      aspect_ratio: body.aspect,
      subject_kind: "product",
    }));

    // 3..9) 7 location key frames
    for (const loc of body.location_briefs.slice(0, 7)) {
      jobs.push(invokeGen(auth, {
        mode: "single_panel",
        prompt: loc,
        aspect_ratio: body.aspect,
      }));
    }

    const results = await Promise.all(jobs);
    const character = results[0];
    const prop = results[1];
    const locations = results.slice(2, 9);
    const missing = results.filter((r) => !r).length;

    if (!character && !prop && locations.every((l) => !l)) {
      return new Response(JSON.stringify({ error: "All asset generations failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      character,
      prop,
      locations: locations.map((l) => l ?? null),
      missing,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("story-bundle error", e);
    return new Response(JSON.stringify({ error: e?.message || "Story bundle failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
