// story-stitch: concatenate completed act videos into a single MP4 via
// fal.ai's ffmpeg-api compose endpoint. Verifies caller owns the render and
// all clips are completed before stitching.
//
// Uses fal's queue API (submit + poll) so the request_id is persisted to
// video_jobs.metadata.fal_request_id, enabling server-side cancellation via
// the `story-stitch-cancel` edge function.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { fal } from "npm:@fal-ai/client";
import {
  chargeCredits,
  refundCredits,
  priceFor,
  InsufficientCreditsError,
  insufficientResponse,
} from "../_shared/credits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FAL_ENDPOINT = "fal-ai/ffmpeg-api/compose";

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
    return new Response(JSON.stringify({ error: "Provider not configured" }), {
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
    const { story_render_id, title, session_id, job_ids, durations, transition, overrides, fps } =
      (await req.json()) as {
        story_render_id?: string;
        title?: string;
        session_id?: string;
        job_ids?: string[];
        durations?: number[];
        transition?: "hard_cut" | "crossfade" | "match_cut";
        overrides?: Array<{ offsetFrames?: number; overlapFrames?: number }>;
        fps?: number;
      };
    const transitionKind: "hard_cut" | "crossfade" | "match_cut" =
      transition === "crossfade" || transition === "match_cut" ? transition : "hard_cut";
    const FPS = Number.isFinite(fps) && (fps as number) > 0 ? (fps as number) : 24;
    const FRAME = 1 / FPS;


    if (!story_render_id && (!Array.isArray(job_ids) || job_ids.length === 0)) {
      return new Response(
        JSON.stringify({ error: "story_render_id or job_ids required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let actRows: Array<{
      id: string;
      status: string | null;
      video_url: string | null;
      act_index: number | null;
      user_id: string;
      provider: string | null;
    }>;
    let perActDurations: number[];

    if (story_render_id) {
      const { data: acts, error: actsErr } = await admin
        .from("video_jobs")
        .select("id, status, video_url, act_index, user_id, provider")
        .eq("story_render_id", story_render_id)
        .eq("user_id", uid)
        .order("act_index", { ascending: true });
      if (actsErr || !acts || acts.length === 0) {
        return new Response(JSON.stringify({ error: "Story render not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      actRows = acts.filter((a) => typeof a.act_index === "number");
      if (actRows.length === 0) {
        return new Response(JSON.stringify({ error: "No acts to stitch" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      perActDurations = actRows.map(() => 15);
    } else {
      const ids = (job_ids as string[]).filter(
        (id) => typeof id === "string" && id.length > 0,
      );
      const { data: jobs, error: jobsErr } = await admin
        .from("video_jobs")
        .select("id, status, video_url, act_index, user_id, provider")
        .in("id", ids)
        .eq("user_id", uid);
      if (jobsErr || !jobs || jobs.length === 0) {
        return new Response(JSON.stringify({ error: "No matching jobs" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const byId = new Map(jobs.map((j) => [j.id, j]));
      actRows = ids
        .map((id) => byId.get(id))
        .filter((j): j is NonNullable<typeof j> => !!j);
      perActDurations = ids.map((_, i) => {
        const d = Array.isArray(durations) ? Number(durations[i]) : NaN;
        return Number.isFinite(d) && d > 0 ? Math.round(d) : 10;
      });
    }

    const incomplete = actRows.filter((a) => a.status !== "completed" || !a.video_url);
    if (incomplete.length > 0) {
      return new Response(JSON.stringify({ error: `Cannot stitch — ${incomplete.length} clip(s) not yet complete` }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency — only meaningful when stitching a tracked story_render.
    if (story_render_id) {
      const { data: existing } = await admin
        .from("video_jobs")
        .select("id, video_url, status")
        .eq("story_render_id", story_render_id)
        .eq("user_id", uid)
        .is("act_index", null)
        .eq("provider", "stitch")
        .maybeSingle();
      if (existing?.video_url) {
        return new Response(JSON.stringify({ job_id: existing.id, video_url: existing.video_url, status: existing.status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const stitchCost = await priceFor("story_stitch", 10);
    try {
      await chargeCredits({
        userId: uid,
        amount: stitchCost,
        reason: "story_stitch",
        metadata: story_render_id ? { story_render_id } : { job_ids },
      });
    } catch (e) {
      if (e instanceof InsufficientCreditsError) return insufficientResponse(corsHeaders);
      throw e;
    }

    const { data: stitchRow, error: stitchInsErr } = await admin
      .from("video_jobs")
      .insert({
        user_id: uid,
        session_id: session_id || null,
        provider: "stitch",
        prompt: title || "Stitched story",
        status: "processing",
        story_render_id: story_render_id ?? null,
        metadata: story_render_id
          ? { transition: transitionKind, fps: FPS }
          : { stitched_job_ids: job_ids, transition: transitionKind, fps: FPS, overrides: overrides ?? null },
      })
      .select("*")
      .single();
    if (stitchInsErr || !stitchRow) {
      await refundCredits({ userId: uid, amount: stitchCost, reason: "story_stitch_refund", metadata: { stage: "insert_failed" } });
      return new Response(JSON.stringify({ error: "Could not create stitch job" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build compose input. Each boundary (between clip i and clip i+1) has an
    // overlap window in seconds plus an optional offset that shifts the cut
    // point earlier (-) or later (+). When the client doesn't send overrides
    // we fall back to the transition preset's default overlap for every
    // boundary, offset = 0.
    //   hard_cut  : 0  frames overlap
    //   crossfade : 12 frames @ 24fps (0.5s)
    //   match_cut : 4  frames @ 24fps (~167ms)
    const sorted = story_render_id
      ? [...actRows].sort((a, b) => (a.act_index ?? 0) - (b.act_index ?? 0))
      : actRows;
    const defaultOverlapFrames =
      transitionKind === "crossfade" ? 12 : transitionKind === "match_cut" ? 4 : 0;

    // Resolve per-boundary overlap/offset in seconds, clamped to the adjacent
    // clip durations so we never request a negative-length slot.
    const boundaries: Array<{ overlapSec: number; offsetSec: number }> = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const ov = Array.isArray(overrides) ? overrides[i] : undefined;
      const overlapFrames =
        ov && Number.isFinite(ov.overlapFrames)
          ? Math.max(0, Math.round(ov.overlapFrames as number))
          : defaultOverlapFrames;
      const offsetFrames =
        ov && Number.isFinite(ov.offsetFrames)
          ? Math.round(ov.offsetFrames as number)
          : 0;
      const prevDur = perActDurations[i] ?? 10;
      const nextDur = perActDurations[i + 1] ?? 10;
      const maxOverlapF = Math.max(0, Math.floor(Math.min(prevDur, nextDur) * FPS) - 1);
      const clampedOverlapF = Math.min(overlapFrames, maxOverlapF);
      const overlapSec = clampedOverlapF * FRAME;
      // Offset can shift the cut anywhere from "1 frame into A" to
      // "1 frame before A ends after overlap is removed".
      const offsetSlack = Math.max(0, prevDur - overlapSec - FRAME);
      const minOffsetF = Math.ceil(-offsetSlack * FPS);
      const maxOffsetF = Math.floor(offsetSlack * FPS);
      const clampedOffsetF = Math.min(maxOffsetF, Math.max(minOffsetF, offsetFrames));
      boundaries.push({
        overlapSec,
        offsetSec: clampedOffsetF * FRAME,
      });
    }

    let cursor = 0;
    const slots = sorted.map((a, i) => {
      const fullDur = perActDurations[i] ?? 10;
      let start: number;
      if (i === 0) {
        start = 0;
      } else {
        const b = boundaries[i - 1];
        // Cursor is the end of the previous clip; pull back by overlap and
        // then shift by the user-tuned offset for this boundary.
        start = Math.max(0, cursor - b.overlapSec + b.offsetSec);
      }
      const slot = { url: a.video_url!, timestamp: start, duration: fullDur };
      cursor = start + fullDur;
      return slot;
    });
    const composeInput = {
      tracks: [
        { id: "video-track", type: "video", keyframes: slots },
        { id: "audio-track", type: "audio", keyframes: slots.map((s) => ({ ...s })) },
      ],
    };


    // Helper: idempotent refund guarded by metadata.refunded flag on the row.
    const refundOnce = async (stage: string) => {
      const { data: row } = await admin
        .from("video_jobs")
        .select("metadata")
        .eq("id", stitchRow.id)
        .maybeSingle();
      const meta = (row?.metadata as Record<string, unknown> | null) || {};
      if (meta.refunded === true) return;
      await refundCredits({
        userId: uid,
        amount: stitchCost,
        reason: "story_stitch_refund",
        refId: stitchRow.id,
        metadata: { stage },
      });
      await admin
        .from("video_jobs")
        .update({ metadata: { ...meta, refunded: true } })
        .eq("id", stitchRow.id);
    };

    try {
      // Submit to fal queue so we get a request_id we can cancel.
      const submitted = (await fal.queue.submit(FAL_ENDPOINT, {
        input: composeInput,
      })) as { request_id: string };
      const requestId = submitted.request_id;

      // Persist request_id so the cancel endpoint can target it.
      {
        const { data: row } = await admin
          .from("video_jobs")
          .select("metadata")
          .eq("id", stitchRow.id)
          .maybeSingle();
        const meta = (row?.metadata as Record<string, unknown> | null) || {};
        await admin
          .from("video_jobs")
          .update({
            metadata: {
              ...meta,
              fal_request_id: requestId,
              fal_endpoint: FAL_ENDPOINT,
            },
          })
          .eq("id", stitchRow.id);
      }

      // Poll loop — check DB cancellation flag between fal status polls.
      const MAX_WAIT_MS = 10 * 60 * 1000; // 10 min hard cap
      const startedAt = Date.now();
      let stitchedUrl: string | undefined;

      while (true) {
        if (Date.now() - startedAt > MAX_WAIT_MS) {
          throw new Error("Stitch timed out after 10 minutes");
        }
        await new Promise((r) => setTimeout(r, 2500));

        // Cancellation check — `story-stitch-cancel` sets status='cancelled'.
        const { data: rowNow } = await admin
          .from("video_jobs")
          .select("status")
          .eq("id", stitchRow.id)
          .maybeSingle();
        if (rowNow?.status === "cancelled") {
          try {
            await fal.queue.cancel(FAL_ENDPOINT, { requestId });
          } catch (cancelErr) {
            console.warn("fal.queue.cancel failed (likely already finished)", cancelErr);
          }
          await refundOnce("cancelled");
          return new Response(
            JSON.stringify({ job_id: stitchRow.id, status: "cancelled", cancelled: true }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        const statusResp = (await fal.queue.status(FAL_ENDPOINT, {
          requestId,
        })) as { status?: string };
        const s = statusResp?.status;
        if (s === "COMPLETED") {
          const result = (await fal.queue.result(FAL_ENDPOINT, {
            requestId,
          })) as Record<string, any>;
          const data = result?.data ?? result;
          stitchedUrl =
            data?.video_url ||
            data?.video?.url ||
            result?.video_url ||
            result?.video?.url;
          if (!stitchedUrl) throw new Error("compose returned no video_url");
          break;
        }
        // IN_QUEUE / IN_PROGRESS → keep polling. Anything else is an error.
        if (s && s !== "IN_QUEUE" && s !== "IN_PROGRESS") {
          throw new Error(`fal queue returned status ${s}`);
        }
      }

      await admin
        .from("video_jobs")
        .update({
          status: "completed",
          video_url: stitchedUrl,
          completed_at: new Date().toISOString(),
        })
        .eq("id", stitchRow.id);
      return new Response(
        JSON.stringify({ job_id: stitchRow.id, video_url: stitchedUrl, status: "completed" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (e: any) {
      console.error("story-stitch ffmpeg error", e);
      // Don't clobber a 'cancelled' status with 'failed'.
      const { data: rowNow } = await admin
        .from("video_jobs")
        .select("status")
        .eq("id", stitchRow.id)
        .maybeSingle();
      if (rowNow?.status !== "cancelled") {
        await admin
          .from("video_jobs")
          .update({
            status: "failed",
            error: e?.message || "Stitch failed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", stitchRow.id);
        await refundOnce("compose_failed");
      }
      return new Response(JSON.stringify({ error: e?.message || "Stitch failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e: any) {
    console.error("story-stitch error", e);
    return new Response(JSON.stringify({ error: e?.message || "Story stitch failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
