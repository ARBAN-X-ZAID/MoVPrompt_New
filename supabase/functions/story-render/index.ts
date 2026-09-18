// story-render: enqueue 8 parallel Seedance 2.0 video jobs for a story render.
// Each act gets the same locked refs (character + prop + location) and the same
// duration / aspect / audio. Charges credits up front; refunds on submit failure.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { fal } from "npm:@fal-ai/client";
import {
  chargeCredits,
  refundCredits,
  videoCost,
  InsufficientCreditsError,
  insufficientResponse,
} from "../_shared/credits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SEEDANCE_REF_MODEL = "bytedance/seedance-2.0/reference-to-video";

type Body = {
  session_id?: string;
  aspect: "16:9" | "9:16" | "1:1";
  duration?: number; // default 15
  character_url?: string;
  prop_url?: string;
  location_url: string;
  act_prompts: string[]; // 4 entries
  title?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: userData, error: userErr } = await userClient.auth.getUser(
    auth.replace("Bearer ", ""),
  );
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const uid = userData.user.id;

  const FAL_KEY = Deno.env.get("FAL_KEY");
  if (!FAL_KEY) {
    return new Response(JSON.stringify({ error: "Video provider not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  fal.config({ credentials: FAL_KEY });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = (await req.json()) as Body;
    if (!body.aspect || !body.location_url || !Array.isArray(body.act_prompts) || body.act_prompts.length !== 4) {
      return new Response(JSON.stringify({ error: "aspect, location_url, and exactly 4 act_prompts required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const duration = Math.max(4, Math.min(15, Math.round(body.duration ?? 15)));
    const refs: string[] = [];
    if (body.character_url) refs.push(body.character_url);
    if (body.prop_url) refs.push(body.prop_url);
    refs.push(body.location_url);

    // Compose @Image tag header so Seedance binds refs correctly.
    const slotLabels = ["@Image1 = character / subject", body.prop_url ? "@Image2 = prop / object" : null, `@Image${refs.length} = location / scene`]
      .filter(Boolean)
      .join("\n");

    const provider = "seedance-2.0-ref";
    const perActCost = await videoCost(provider, duration);
    const totalCost = perActCost * 4;
    try {
      await chargeCredits({
        userId: uid,
        amount: totalCost,
        reason: "story_render",
        metadata: { provider, duration, acts: 4 },
      });
    } catch (e) {
      if (e instanceof InsufficientCreditsError) return insufficientResponse(corsHeaders);
      throw e;
    }

    const storyRenderId = crypto.randomUUID();

    // Insert 4 video_jobs rows up front so the client can poll them by id.
    const rows = body.act_prompts.map((p, i) => ({
      user_id: uid,
      session_id: body.session_id || null,
      provider,
      prompt: `${slotLabels}\n\n${p}`.trim(),
      status: "queued" as const,
      reference_image_urls: refs,
      story_render_id: storyRenderId,
      act_index: i + 1,
    }));
    const { data: inserted, error: insErr } = await admin
      .from("video_jobs")
      .insert(rows)
      .select("id, act_index, prompt, status");
    if (insErr || !inserted || inserted.length !== 4) {
      console.error("story-render insert failed", insErr);
      await refundCredits({ userId: uid, amount: totalCost, reason: "story_render_refund", metadata: { stage: "insert_failed" } });
      return new Response(JSON.stringify({ error: "Could not create jobs" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Submit all 4 to fal in parallel.
    const submitResults = await Promise.all(
      inserted.map(async (row) => {
        try {
          const submit = (await fal.queue.submit(SEEDANCE_REF_MODEL, {
            input: {
              prompt: row.prompt,
              aspect_ratio: body.aspect,
              duration: String(duration),
              resolution: "1080p",
              generate_audio: true,
              image_urls: refs.slice(0, 9),
            },
          })) as Record<string, any>;
          if (!submit?.request_id) throw new Error("no request_id");
          const base = `https://queue.fal.run/${SEEDANCE_REF_MODEL}/requests/${submit.request_id}`;
          await admin
            .from("video_jobs")
            .update({
              fal_request_id: submit.request_id,
              fal_status_url: `${base}/status`,
              fal_response_url: base,
              status: "processing",
            })
            .eq("id", row.id);
          return { id: row.id, act_index: row.act_index, ok: true };
        } catch (e: any) {
          console.error("story-render fal submit failed", row.act_index, e);
          await admin
            .from("video_jobs")
            .update({ status: "failed", error: e?.message || "Provider rejected request" })
            .eq("id", row.id);
          await refundCredits({ userId: uid, amount: perActCost, reason: "story_render_refund", refId: row.id, metadata: { stage: "submit_failed", act_index: row.act_index } });
          return { id: row.id, act_index: row.act_index, ok: false };
        }
      }),
    );

    return new Response(
      JSON.stringify({
        story_render_id: storyRenderId,
        acts: submitResults.map((r) => ({ job_id: r.id, act_index: r.act_index, ok: r.ok })),
        title: body.title || "Story render",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("story-render error", e);
    return new Response(JSON.stringify({ error: e?.message || "Story render failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
