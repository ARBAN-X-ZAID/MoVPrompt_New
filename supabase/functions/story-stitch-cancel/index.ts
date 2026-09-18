// story-stitch-cancel: cancel an in-progress stitch job. Marks the
// video_jobs row as 'cancelled' (which the story-stitch poll loop watches
// for) AND best-effort calls fal.queue.cancel to actually stop the
// ffmpeg-api compose request server-side.
//
// Body: { job_id?: string, session_id?: string }
//   - job_id: explicit stitch video_jobs row id, OR
//   - session_id: cancel the most recent processing stitch row for the user
//     in that session.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { fal } from "npm:@fal-ai/client";
import { refundCredits, priceFor } from "../_shared/credits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
  if (FAL_KEY) fal.config({ credentials: FAL_KEY });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { job_id, session_id } = (await req.json()) as {
      job_id?: string;
      session_id?: string;
    };
    if (!job_id && !session_id) {
      return new Response(
        JSON.stringify({ error: "job_id or session_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Find the target stitch row.
    let query = admin
      .from("video_jobs")
      .select("id, status, metadata, provider, user_id")
      .eq("user_id", uid)
      .eq("provider", "stitch");
    if (job_id) {
      query = query.eq("id", job_id);
    } else {
      query = query
        .eq("session_id", session_id!)
        .eq("status", "processing")
        .order("created_at", { ascending: false })
        .limit(1);
    }
    const { data: rows, error: rowsErr } = await query;
    if (rowsErr) {
      return new Response(JSON.stringify({ error: rowsErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const row = rows?.[0];
    if (!row) {
      return new Response(
        JSON.stringify({ error: "No active stitch job to cancel" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (row.status === "completed") {
      return new Response(
        JSON.stringify({ job_id: row.id, status: "completed", cancelled: false }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (row.status === "cancelled") {
      return new Response(
        JSON.stringify({ job_id: row.id, status: "cancelled", cancelled: true }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const meta = (row.metadata as Record<string, unknown> | null) || {};
    const falRequestId =
      typeof meta.fal_request_id === "string" ? (meta.fal_request_id as string) : null;
    const falEndpoint =
      typeof meta.fal_endpoint === "string"
        ? (meta.fal_endpoint as string)
        : "fal-ai/ffmpeg-api/compose";

    // 1) Flip status FIRST so the polling story-stitch loop sees it on its
    //    next tick (≤ 2.5s) and stops waiting on fal.
    await admin
      .from("video_jobs")
      .update({
        status: "cancelled",
        error: "Cancelled by user",
        completed_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    // 2) Best-effort: tell fal to stop the queued/running compose request.
    if (falRequestId && FAL_KEY) {
      try {
        await fal.queue.cancel(falEndpoint, { requestId: falRequestId });
      } catch (cancelErr) {
        console.warn("fal.queue.cancel failed (job may have already finished)", cancelErr);
      }
    }

    // 3) Refund credits — guarded by metadata.refunded so we don't double-refund
    //    if the polling loop also reaches the cancellation branch.
    if (meta.refunded !== true) {
      try {
        const stitchCost = await priceFor("story_stitch", 10);
        await refundCredits({
          userId: uid,
          amount: stitchCost,
          reason: "story_stitch_refund",
          refId: row.id,
          metadata: { stage: "user_cancelled" },
        });
        await admin
          .from("video_jobs")
          .update({ metadata: { ...meta, refunded: true, cancelled_at: new Date().toISOString() } })
          .eq("id", row.id);
      } catch (refundErr) {
        console.error("refund on cancel failed", refundErr);
      }
    }

    return new Response(
      JSON.stringify({ job_id: row.id, status: "cancelled", cancelled: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e: any) {
    console.error("story-stitch-cancel error", e);
    return new Response(
      JSON.stringify({ error: e?.message || "Cancel failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
