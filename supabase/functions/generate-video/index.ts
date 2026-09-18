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
import { isCapabilityAlias, resolveCapability } from "../_shared/capabilityRegistry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Stable model ids ↔ fal.ai endpoints. Keep in sync with
// src/lib/director/videoModels.ts on the frontend.
const FAL_MODELS: Record<string, string> = {
  // Kling v3
  "kling-v3-pro": "fal-ai/kling-video/v3/pro/text-to-video",
  "kling-v3-standard": "fal-ai/kling-video/v3/standard/text-to-video",
  "kling-v3-4k": "fal-ai/kling-video/v3/4k/text-to-video",
  // Kling 3.0 Omni (o3 family)
  "kling-omni": "fal-ai/kling-video/o3/pro/text-to-video",
  // Kling 3.0 Omni reference-to-video: true multi-reference, keeps character/product/location identity locked.
  "kling-omni-ref": "fal-ai/kling-video/o3/pro/reference-to-video",
  "kling-omni-edit": "fal-ai/kling-video/o3/standard/video-to-video/edit",
  "kling-motion-control": "fal-ai/kling-video/v3/standard/motion-control",
  // Kling (legacy)
  "kling-v2.5-turbo-pro": "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
  "kling-v2.1-master": "fal-ai/kling-video/v2.1/master/text-to-video",
  "kling-v2-master": "fal-ai/kling-video/v2/master/text-to-video",
  "kling-v1.6-pro": "fal-ai/kling-video/v1.6/pro/text-to-video",
  "kling-v1.6-standard": "fal-ai/kling-video/v1.6/standard/text-to-video",
  "kling-v1.5-pro": "fal-ai/kling-video/v1.5/pro/text-to-video",
  "kling-v1-pro": "fal-ai/kling-video/v1/pro/text-to-video",
  "kling-v1-standard": "fal-ai/kling-video/v1/standard/text-to-video",
  // Veo
  "veo-3.1": "fal-ai/veo3.1",
  "veo-3.1-fast": "fal-ai/veo3.1/fast",
  "veo-3.1-lite": "fal-ai/veo3.1/lite",
  "veo-3": "fal-ai/veo3",
  "veo-3-fast": "fal-ai/veo3/fast",
  "veo-2": "fal-ai/veo2",
  // Seedance 2.0 — current generation, native audio, multi-reference.
  // FAL serves these under the bare `bytedance/...` namespace (no `fal-ai/` prefix).
  "seedance-2.0": "bytedance/seedance-2.0/image-to-video",
  "seedance-2.0-fast": "bytedance/seedance-2.0/image-to-video",
  // Multi-reference: up to 9 images + 3 videos + 3 audio (12 total).
  // Refs are addressed inline in the prompt as @Image1, @Image2, …
  "seedance-2.0-ref": "bytedance/seedance-2.0/reference-to-video",
  // Seedance v1 Pro — kept as the text-only fallback (no native audio, but fast/cheap).
  "seedance-v1-pro": "fal-ai/bytedance/seedance/v1/pro/text-to-video",
  "seedance-v1-pro-ref": "fal-ai/bytedance/seedance/v1/pro/image-to-video",
  "seedance-v1-lite": "fal-ai/bytedance/seedance/v1/lite/text-to-video",
  // Hailuo / MiniMax
  "hailuo-02-pro": "fal-ai/minimax/hailuo-02/pro/text-to-video",
  "hailuo-02-standard": "fal-ai/minimax/hailuo-02/standard/text-to-video",
  "hailuo-01": "fal-ai/minimax/video-01",
  // Runway
  "runway-gen3-turbo": "fal-ai/runway-gen3/turbo/text-to-video",
  // LTX
  "ltx-video-13b": "fal-ai/ltx-video-13b-distilled",
  "ltx-video": "fal-ai/ltx-video",
  // Wan
  "wan-pro": "fal-ai/wan-pro/text-to-video",
  "wan-v2.2-a14b": "fal-ai/wan/v2.2-a14b/text-to-video",
  // Legacy aliases (kept so older saved jobs / clients still resolve)
  seedance: "fal-ai/bytedance/seedance/v1/pro/text-to-video",
  veo: "fal-ai/veo3/fast",
  kling: "fal-ai/kling-video/v2/master/text-to-video",
};

// Image-to-video variants. When a starting image is provided, we route to
// these endpoints so the model actually SEES the source frame (preserves
// character identity, composition, lighting). Without this map every Kling
// animation collapses to text-to-video and drifts off the source panel.
const FAL_MODELS_I2V: Record<string, string> = {
  "kling-v3-pro": "fal-ai/kling-video/v3/pro/image-to-video",
  "kling-v3-standard": "fal-ai/kling-video/v3/standard/image-to-video",
  "kling-v3-4k": "fal-ai/kling-video/v3/4k/image-to-video",
  "kling-omni": "fal-ai/kling-video/o3/pro/image-to-video",
  "kling-v2.5-turbo-pro": "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
  "kling-v2.1-master": "fal-ai/kling-video/v2.1/master/image-to-video",
  "kling-v2-master": "fal-ai/kling-video/v2/master/image-to-video",
  "kling-v1.6-pro": "fal-ai/kling-video/v1.6/pro/image-to-video",
  "kling-v1.6-standard": "fal-ai/kling-video/v1.6/standard/image-to-video",
  "kling-v1.5-pro": "fal-ai/kling-video/v1.5/pro/image-to-video",
  "kling-v1-pro": "fal-ai/kling-video/v1/pro/image-to-video",
  "kling-v1-standard": "fal-ai/kling-video/v1/standard/image-to-video",
  "veo-3.1": "fal-ai/veo3.1/image-to-video",
  "veo-3.1-fast": "fal-ai/veo3.1/fast/image-to-video",
  "veo-3.1-lite": "fal-ai/veo3.1/lite/image-to-video",
  "veo-3": "fal-ai/veo3/image-to-video",
  "veo-3-fast": "fal-ai/veo3/fast/image-to-video",
  "veo-2": "fal-ai/veo2/image-to-video",
  "hailuo-02-pro": "fal-ai/minimax/hailuo-02/pro/image-to-video",
  "hailuo-02-standard": "fal-ai/minimax/hailuo-02/standard/image-to-video",
  "runway-gen3-turbo": "fal-ai/runway-gen3/turbo/image-to-video",
};

// (Pre-flight content moderation moved to the `moderate-image` function,
// which runs at upload time on the reference image itself.)

async function readJsonResponse(resp: Response) {
  const text = await resp.text();
  if (!text.trim()) {
    return { text, data: null as Record<string, any> | null };
  }

  try {
    return { text, data: JSON.parse(text) as Record<string, any> };
  } catch {
    return { text, data: null as Record<string, any> | null };
  }
}

function stringifyFalDetail(detail: unknown): string | undefined {
  if (!detail) return undefined;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    // FastAPI 422 shape: [{ loc: [...], msg, type, input }]
    return detail
      .map((d: any) => {
        if (!d) return null;
        if (typeof d === "string") return d;
        const loc = Array.isArray(d.loc) ? d.loc.filter((x: any) => x !== "body").join(".") : "";
        const msg = d.msg || d.message || d.detail;
        return loc ? `${loc}: ${msg}` : msg;
      })
      .filter(Boolean)
      .join("; ") || undefined;
  }
  if (typeof detail === "object") {
    const d = detail as any;
    return d.msg || d.message || d.error || JSON.stringify(d);
  }
  return String(detail);
}

function extractFalError(error: unknown): { status?: number; message: string } {
  if (error instanceof Error) {
    const maybe = error as Error & { status?: number; body?: { detail?: unknown; error?: unknown; message?: unknown } };
    const fromBody =
      stringifyFalDetail(maybe.body?.detail) ||
      stringifyFalDetail(maybe.body?.error) ||
      stringifyFalDetail(maybe.body?.message);
    return {
      status: maybe.status,
      message: fromBody || maybe.message || "Unknown provider error",
    };
  }
  if (typeof error === "object" && error !== null) {
    const maybe = error as { status?: number; detail?: unknown; error?: unknown; message?: unknown; body?: { detail?: unknown; error?: unknown; message?: unknown } };
    const fromBody =
      stringifyFalDetail(maybe.body?.detail) ||
      stringifyFalDetail(maybe.body?.error) ||
      stringifyFalDetail(maybe.body?.message) ||
      stringifyFalDetail(maybe.detail) ||
      stringifyFalDetail(maybe.error) ||
      stringifyFalDetail(maybe.message);
    return {
      status: typeof maybe.status === "number" ? maybe.status : undefined,
      message: fromBody || "Unknown provider error",
    };
  }
  return { message: "Unknown provider error" };
}

// Map raw fal/provider errors to a user-friendly message.
// Catches audio/visual moderation rejections so the UI can guide the user
// (e.g. retry with audio off) instead of showing the opaque
// `Provider rejected the job (422): ...` string.
function friendlyFalError(status: number | undefined, message: string): string {
  const raw = (message || "").toLowerCase();
  const isAudioModeration =
    raw.includes("output audio has sensitive content") ||
    raw.includes("audio has sensitive content") ||
    (raw.includes("audio") && raw.includes("sensitive"));
  if (isAudioModeration) {
    return "The provider's safety filter flagged the generated audio. Re-render with audio set to Off (or Music only) — your video frames will be unchanged.";
  }
  const isVisualModeration =
    raw.includes("sensitive content") ||
    raw.includes("safety") ||
    raw.includes("nsfw") ||
    raw.includes("content policy");
  if (isVisualModeration) {
    return "The provider's safety filter flagged this render. Try softening references to people, brands, or sensitive imagery and retry.";
  }
  if (status === 404) {
    return "The provider completed the render but did not return the video result. Please retry with the same prompt.";
  }
  return `Provider rejected the job (${status ?? "error"}): ${message || "validation error"}`;
}

function normalizeFalQueueUrl(
  url: string | null | undefined,
  kind: "status" | "response" | "cancel",
): string | null {
  if (!url) return null;
  const trimmed = url.replace(/\/+$/, "");

  if (kind === "response") {
    if (trimmed.endsWith("/status")) return trimmed.replace(/\/status$/, "");
    if (trimmed.endsWith("/cancel")) return trimmed.replace(/\/cancel$/, "");
    if (trimmed.endsWith("/response")) return trimmed.replace(/\/response$/, "");
    return trimmed;
  }

  if (trimmed.endsWith(`/${kind}`)) return trimmed;
  if (trimmed.endsWith("/status")) return trimmed.replace(/\/status$/, `/${kind}`);
  if (trimmed.endsWith("/response")) return trimmed.replace(/\/response$/, `/${kind}`);
  if (trimmed.endsWith("/cancel")) return trimmed.replace(/\/cancel$/, `/${kind}`);
  return `${trimmed}/${kind}`;
}

function getFallbackFalUrls(model: string, requestId: string) {
  const base = `https://queue.fal.run/${model}/requests/${requestId}`;
  return {
    statusUrl: `${base}/status`,
    responseUrl: base,
    cancelUrl: `${base}/cancel`,
  };
}

type VideoOptions = {
  aspect_ratio?: string;
  duration?: number | "auto";
  resolution?: string;
  audio?: boolean;
  cfg_scale?: number;
  prompt_optimizer?: boolean;
};

function buildFalPayload(
  provider: string,
  prompt: string,
  opts: VideoOptions = {},
  referenceImages: string[] = [],
  useI2V = false,
) {
  const payload: Record<string, unknown> = { prompt };
  const family = provider.split("-")[0]; // kling | veo | seedance | hailuo | runway | ltx | wan
  const set = (k: string, v: unknown) => {
    if (v !== undefined && v !== null) payload[k] = v;
  };
  const startingFrame = useI2V && referenceImages.length > 0 ? referenceImages[0] : null;

  switch (family) {
    case "veo":
      set("aspect_ratio", opts.aspect_ratio);
      if (opts.duration !== undefined) set("duration", `${opts.duration}s`);
      set("resolution", opts.resolution);
      if (opts.audio !== undefined) set("generate_audio", opts.audio);
      if (startingFrame) set("image_url", startingFrame);
      break;
    case "kling":
      set("aspect_ratio", opts.aspect_ratio);
      if (opts.duration !== undefined) set("duration", String(opts.duration));
      set("cfg_scale", opts.cfg_scale);
      // Kling v3 + Omni (o3) support native audio via `generate_audio`. Legacy Kling silently ignores it.
      if (
        (provider.startsWith("kling-v3") || provider.startsWith("kling-omni")) &&
        opts.audio !== undefined
      ) {
        set("generate_audio", opts.audio);
      }
      // Kling Omni reference-to-video accepts up to 7 ref images for identity lock.
      if (provider === "kling-omni-ref" && referenceImages.length > 0) {
        set("reference_images", referenceImages.slice(0, 7).map((url) => ({ image_url: url })));
      }
      // Image-to-video: pass the starting frame so character identity is preserved.
      if (startingFrame) set("image_url", startingFrame);
      break;
    case "seedance":
      set("aspect_ratio", opts.aspect_ratio);
      // Seedance 2.0 wants duration as a string enum: "auto" or "4"–"15".
      // v1 accepts a numeric string. Clamp into 4–15 when numeric so 2.0 doesn't reject it.
      if (opts.duration !== undefined) {
        if (typeof opts.duration === "number") {
          const clamped = Math.min(15, Math.max(4, Math.round(opts.duration)));
          set("duration", String(clamped));
        } else {
          set("duration", String(opts.duration));
        }
      }
      set("resolution", opts.resolution);
      if (opts.audio !== undefined) set("generate_audio", opts.audio);
      if (provider === "seedance-2.0-ref" && referenceImages.length > 0) {
        // Seedance 2.0 reference-to-video: up to 9 ref images, refs are bound by
        // @Image1, @Image2, … tags in the prompt (composed client-side).
        set("image_urls", referenceImages.slice(0, 9));
      } else if (provider === "seedance-2.0" && referenceImages.length > 0) {
        // Seedance 2.0 image-to-video: single start frame, optional end frame.
        set("image_url", referenceImages[0]);
        if (referenceImages[1]) set("end_image_url", referenceImages[1]);
      } else if (provider.endsWith("-ref") && referenceImages.length > 0) {
        // Legacy Seedance v1 Pro image-to-video: single starting frame.
        set("image_url", referenceImages[0]);
      }
      break;
    case "hailuo":
      if (opts.duration !== undefined) set("duration", String(opts.duration));
      set("resolution", opts.resolution);
      if (opts.prompt_optimizer !== undefined) set("prompt_optimizer", opts.prompt_optimizer);
      if (startingFrame) set("image_url", startingFrame);
      break;
    case "runway":
      set("aspect_ratio", opts.aspect_ratio);
      if (opts.duration !== undefined) set("duration", String(opts.duration));
      if (startingFrame) set("image_url", startingFrame);
      break;
    case "ltx":
      set("aspect_ratio", opts.aspect_ratio);
      break;
    case "wan":
      set("aspect_ratio", opts.aspect_ratio);
      set("resolution", opts.resolution);
      if (typeof opts.duration === "number") set("num_frames", opts.duration === 10 ? 161 : 81);
      break;
  }
  return payload;
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

  const bearerToken = auth.replace("Bearer ", "");
  const internalUserId = req.headers.get("x-internal-user-id");
  let uid: string;
  if (bearerToken === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") && internalUserId && /^[0-9a-f-]{36}$/i.test(internalUserId)) {
    uid = internalUserId;
  } else {
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(bearerToken);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    uid = claims.claims.sub as string;
  }

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
    const url = new URL(req.url);
    let body: any = {};
    try {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    } catch (_e) {
      body = {};
    }
    const action = url.searchParams.get("action") || body.action || "submit";

    if (action === "status") {
      const jobId = url.searchParams.get("job_id") || body.job_id;
      if (!jobId) {
        return new Response(JSON.stringify({ error: "job_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: job, error } = await admin
        .from("video_jobs")
        .select("*")
        .eq("id", jobId)
        .eq("user_id", uid)
        .maybeSingle();
      if (error || !job) {
        return new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Already finished — return as-is
      if (job.status === "completed" || job.status === "failed") {
        return new Response(JSON.stringify(job), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Poll fal
      const model = FAL_MODELS[job.provider];
      if (!model || !job.fal_request_id) {
        return new Response(JSON.stringify(job), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const fallbackUrls = getFallbackFalUrls(model, job.fal_request_id);
      const statusUrl =
        normalizeFalQueueUrl((job as { fal_status_url?: string | null }).fal_status_url, "status") ||
        fallbackUrls.statusUrl;
      let statusData: Record<string, any> | null = null;
      try {
        statusData = await fal.queue.status(model, {
          requestId: job.fal_request_id,
          logs: true,
        }) as Record<string, any>;
      } catch (error) {
        const falError = extractFalError(error);
        console.warn("fal status response unreadable", falError.status, falError.message);
        // Any 4xx from fal (except 408 timeout / 429 rate-limit) is a terminal
        // input/validation failure — surface it instead of polling forever.
        const isTerminal4xx =
          typeof falError.status === "number" &&
          falError.status >= 400 &&
          falError.status < 500 &&
          falError.status !== 408 &&
          falError.status !== 429;
        if (isTerminal4xx) {
          const friendly = friendlyFalError(falError.status, falError.message);
          await admin
            .from("video_jobs")
            .update({
              status: "failed",
              error: friendly,
              completed_at: new Date().toISOString(),
            })
            .eq("id", jobId);
          return new Response(JSON.stringify({
            ...job,
            status: "failed",
            error: friendly,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ...job, status: "processing" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (statusData.status === "COMPLETED") {
        let result: Record<string, any> | null = null;
        try {
          const response = await fal.queue.result(model, {
            requestId: job.fal_request_id,
          }) as Record<string, any>;
          result = (response.data ?? response) as Record<string, any>;
        } catch (error) {
          const falError = extractFalError(error);
          console.warn("fal result response unreadable", falError.status, falError.message);
          const isTerminal4xx =
            typeof falError.status === "number" &&
            falError.status >= 400 &&
            falError.status < 500 &&
            falError.status !== 408 &&
            falError.status !== 429;
          if (isTerminal4xx) {
            const friendly = friendlyFalError(falError.status, falError.message);
            await admin
              .from("video_jobs")
              .update({
                status: "failed",
                error: friendly,
                completed_at: new Date().toISOString(),
              })
              .eq("id", jobId);
            const refundAmt = Number(job.metadata?.charged_credits) || await videoCost(job.provider, 5);
            const operationId = String(job.metadata?.credit_operation_id || jobId);
            if (job.metadata?.starter_entitlement_used) await admin.rpc("restore_starter_render", { _user_id: uid, _operation_key: operationId });
            else await refundCredits({ userId: uid, amount: refundAmt, reason: "video_render_refund", refId: jobId, idempotencyKey: `${operationId}:refund`, metadata: { stage: "terminal_4xx" } });
            return new Response(
              JSON.stringify({
                ...job,
                status: "failed",
                error: friendly,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }

        if (!result) {
          return new Response(JSON.stringify({ ...job, status: "processing" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const firstOutput = Array.isArray(result.output) ? result.output[0] : result.output;
        const videoUrl = result.video?.url || firstOutput?.url || firstOutput || result.video_url;
        if (typeof videoUrl !== "string" || !/^https?:\/\//i.test(videoUrl)) {
          const refundAmt = Number(job.metadata?.charged_credits) || await videoCost(job.provider, 5);
          const operationId = String(job.metadata?.credit_operation_id || jobId);
          await admin.from("video_jobs").update({ status: "failed", error: "Provider completed without a valid video output", completed_at: new Date().toISOString() }).eq("id", jobId);
          if (job.metadata?.starter_entitlement_used) await admin.rpc("restore_starter_render", { _user_id: uid, _operation_key: operationId });
          else await refundCredits({ userId: uid, amount: refundAmt, reason: "video_render_refund", refId: jobId, idempotencyKey: `${operationId}:refund`, metadata: { stage: "missing_output" } });
          return new Response(JSON.stringify({ ...job, status: "failed", error: "The provider did not return a usable video. Your credits were restored." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        await admin
          .from("video_jobs")
          .update({
            status: "completed",
            video_url: videoUrl,
            fal_response_url: normalizeFalQueueUrl(statusData.response_url as string | null | undefined, "response") || fallbackUrls.responseUrl,
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobId);
        return new Response(
          JSON.stringify({ ...job, status: "completed", video_url: videoUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (statusData.status === "FAILED" || statusData.status === "ERROR") {
        await admin
          .from("video_jobs")
          .update({
            status: "failed",
            error: statusData.error || "Provider error",
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobId);
        const refundAmt = Number(job.metadata?.charged_credits) || await videoCost(job.provider, 5);
        const operationId = String(job.metadata?.credit_operation_id || jobId);
        if (job.metadata?.starter_entitlement_used) await admin.rpc("restore_starter_render", { _user_id: uid, _operation_key: operationId });
        else await refundCredits({ userId: uid, amount: refundAmt, reason: "video_render_refund", refId: jobId, idempotencyKey: `${operationId}:refund`, metadata: { stage: "provider_failed" } });
        return new Response(
          JSON.stringify({ ...job, status: "failed", error: statusData.error }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ ...job, status: "processing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "cancel") {
      const jobId = url.searchParams.get("job_id") || body.job_id;
      if (!jobId) {
        return new Response(JSON.stringify({ error: "job_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: job, error } = await admin
        .from("video_jobs")
        .select("*")
        .eq("id", jobId)
        .eq("user_id", uid)
        .maybeSingle();
      if (error || !job) {
        return new Response(JSON.stringify({ error: "Job not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (job.status === "completed" || job.status === "failed") {
        return new Response(JSON.stringify(job), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Best-effort cancel on fal
      const model = FAL_MODELS[job.provider];
      let providerCancelled = false;
      if (model && job.fal_request_id) {
        const cancelUrl =
          normalizeFalQueueUrl((job as { fal_status_url?: string | null }).fal_status_url, "cancel") ||
          normalizeFalQueueUrl((job as { fal_response_url?: string | null }).fal_response_url, "cancel") ||
          getFallbackFalUrls(model, job.fal_request_id).cancelUrl;
        try {
          const cancelResponse = await fetch(cancelUrl, {
            method: "PUT",
            headers: { Authorization: `Key ${FAL_KEY}` },
          });
          providerCancelled = cancelResponse.ok;
        } catch (e) {
          console.warn("fal cancel failed", e);
        }
      }
      if (!providerCancelled && job.fal_request_id) {
        return new Response(JSON.stringify({ error: "cancellation_unconfirmed", message: "The provider has not confirmed cancellation yet. The render remains active." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: updated } = await admin
        .from("video_jobs")
        .update({
          status: "failed",
          error: "Canceled by user",
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .select("*")
        .maybeSingle();
      const refundAmt = Number(job.metadata?.charged_credits) || await videoCost(job.provider, 5);
      const operationId = String(job.metadata?.credit_operation_id || jobId);
      if (job.metadata?.starter_entitlement_used) await admin.rpc("restore_starter_render", { _user_id: uid, _operation_key: operationId });
      else await refundCredits({ userId: uid, amount: refundAmt, reason: "video_render_refund", refId: jobId, idempotencyKey: `${operationId}:refund`, metadata: { stage: "provider_cancelled" } });
      return new Response(JSON.stringify(updated || { ...job, status: "failed", error: "Canceled by user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Submit new job
    let { prompt, provider = "seedance-v1-pro", session_id, options, reference_image_urls, storyboard_session_id, storyboard_shot_index, metadata } = body as {
      prompt?: string;
      provider?: string;
      session_id?: string;
      options?: VideoOptions;
      reference_image_urls?: string[];
      storyboard_session_id?: string;
      storyboard_shot_index?: number;
      metadata?: Record<string, unknown> | null;
    };

    const beginnerFlow = metadata?.beginner_flow === true;
    if (beginnerFlow && !isCapabilityAlias(provider)) {
      return new Response(JSON.stringify({ error: "unapproved_capability", message: "This creator only accepts approved capability aliases." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (isCapabilityAlias(provider)) {
      try {
        provider = resolveCapability(provider, "video").externalModelId!;
      } catch (error) {
        const code = error instanceof Error ? error.message : "capability_unavailable";
        return new Response(JSON.stringify({ error: code, message: code === "capability_unavailable" ? "This approved capability is temporarily unavailable." : "The requested capability is not approved." }), { status: code === "capability_unavailable" ? 409 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    const refImages = Array.isArray(reference_image_urls)
      ? reference_image_urls.filter((u): u is string => typeof u === "string" && u.length > 0)
      : [];
    const pendingGenerationId = typeof metadata?.pending_generation_id === "string" ? metadata.pending_generation_id : null;
    if (pendingGenerationId) {
      const { data: existingJob } = await admin.from("video_jobs").select("*").eq("user_id", uid).contains("metadata", { pending_generation_id: pendingGenerationId }).maybeSingle();
      if (existingJob) return new Response(JSON.stringify(existingJob), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const creditOperationId = pendingGenerationId || crypto.randomUUID();
    let safeMetadata = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { ...metadata } : {};

    if ((!prompt || !prompt.trim()) && session_id) {
      const { data: session } = await admin
        .from("director_sessions")
        .select("final_prompt")
        .eq("id", session_id)
        .eq("user_id", uid)
        .maybeSingle();
      prompt = typeof session?.final_prompt === "string" ? session.final_prompt : prompt;
    }

    let normalizedPrompt = typeof prompt === "string" ? prompt.trim() : "";

    if (!normalizedPrompt || normalizedPrompt.length > 8000) {
      return new Response(JSON.stringify({ error: "Valid prompt required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strip image-reference tokens (e.g. "@Image1", "[Image 2]", "[image_3]",
    // "image_1") from the prompt when fewer reference images are attached than
    // the tokens reference. Otherwise fal returns
    // 422 "Invalid reference index N for image. Only M images provided."
    // and the job hangs in 'processing' forever.
    const refCount = refImages.length;
    normalizedPrompt = normalizedPrompt.replace(
      /(?:@|\[)?\s*image[\s_-]*#?(\d+)\s*\]?/gi,
      (match, idxStr: string) => {
        const idx = parseInt(idxStr, 10);
        return idx > refCount ? "" : match;
      },
    ).replace(/\s{2,}/g, " ").trim();

    // Kling 3.0 exposes 4K via a dedicated endpoint. If the user picked "4k"
    // resolution on Pro/Standard/Omni, transparently route to the 4K variant.
    if (
      options?.resolution === "4k" &&
      (provider === "kling-v3-pro" ||
        provider === "kling-v3-standard" ||
        provider === "kling-omni")
    ) {
      provider = "kling-v3-4k";
    }
    // If a starting frame is attached and the provider has an image-to-video
    // variant, route to it so the model actually sees the source image
    // (preserves character identity, composition, lighting). Without this,
    // animating a storyboard panel falls back to text-to-video and the
    // generated character drifts off the source.
    const useI2V = refImages.length > 0 && !!FAL_MODELS_I2V[provider];
    const model = useI2V ? FAL_MODELS_I2V[provider] : FAL_MODELS[provider];
    if (!model) {
      return new Response(JSON.stringify({ error: `Unknown provider: ${provider}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Charge credits up-front based on provider + duration.
    const durationSec =
      typeof options?.duration === "number"
        ? options.duration
        : 5;
    const quotedCreditCost = await videoCost(provider, durationSec);
    let starterEntitlementUsed = false;
    if (beginnerFlow) {
      const { data } = await admin.rpc("claim_starter_render", { _user_id: uid, _operation_key: creditOperationId });
      starterEntitlementUsed = data === true;
    }
    const creditCost = starterEntitlementUsed ? 0 : quotedCreditCost;
    safeMetadata = { ...safeMetadata, charged_credits: creditCost, quoted_credits: quotedCreditCost, credit_operation_id: creditOperationId, starter_entitlement_used: starterEntitlementUsed };
    try {
      if (!starterEntitlementUsed) await chargeCredits({
        userId: uid,
        amount: creditCost,
        reason: "video_render",
        refId: creditOperationId,
        idempotencyKey: `${creditOperationId}:charge`,
        metadata: { provider, duration: durationSec, pending_generation_id: pendingGenerationId },
      });
    } catch (e) {
      if (e instanceof InsufficientCreditsError) return insufficientResponse(corsHeaders);
      console.error("charge_credits failed", e);
      return new Response(JSON.stringify({ error: "Credit charge failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create job row
    const { data: job, error: insErr } = await admin
      .from("video_jobs")
      .insert({
        user_id: uid,
        session_id: session_id || null,
        provider,
        prompt: normalizedPrompt,
        status: "queued",
        reference_image_urls: refImages.length > 0 ? refImages : null,
        storyboard_session_id: typeof storyboard_session_id === "string" && storyboard_session_id.length > 0 ? storyboard_session_id : null,
        storyboard_shot_index: typeof storyboard_shot_index === "number" && Number.isFinite(storyboard_shot_index) ? storyboard_shot_index : null,
        metadata: safeMetadata,
      })
      .select("*")
      .single();
    if (insErr || !job) {
      console.error("insert video_job failed", insErr);
      if (pendingGenerationId) {
        const { data: concurrentJob } = await admin.from("video_jobs").select("*").eq("user_id", uid).contains("metadata", { pending_generation_id: pendingGenerationId }).maybeSingle();
        if (concurrentJob) return new Response(JSON.stringify(concurrentJob), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (starterEntitlementUsed) await admin.rpc("restore_starter_render", { _user_id: uid, _operation_key: creditOperationId });
      else await refundCredits({ userId: uid, amount: creditCost, reason: "video_render_refund", refId: creditOperationId, idempotencyKey: `${creditOperationId}:refund`, metadata: { stage: "insert_failed" } });
      return new Response(JSON.stringify({ error: "Could not create job" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Submit to fal queue
    let submitData: Record<string, any> | null = null;
    try {
      submitData = await fal.queue.submit(model, {
        input: buildFalPayload(provider, normalizedPrompt, options, refImages, useI2V),
      }) as Record<string, any>;
    } catch (error) {
      const falError = extractFalError(error);
      console.error("fal submit error", falError.status, falError.message, error);
      const friendlySubmit =
        typeof falError.status === "number" && falError.status >= 400 && falError.status < 500
          ? friendlyFalError(falError.status, falError.message)
          : (falError.message || "Provider error");
      await admin
        .from("video_jobs")
        .update({ status: "failed", error: friendlySubmit })
        .eq("id", job.id);
      if (starterEntitlementUsed) await admin.rpc("restore_starter_render", { _user_id: uid, _operation_key: creditOperationId });
      else await refundCredits({ userId: uid, amount: creditCost, reason: "video_render_refund", refId: job.id, idempotencyKey: `${creditOperationId}:refund`, metadata: { stage: "submit_error" } });
      return new Response(JSON.stringify({ error: friendlySubmit }), {
        status: typeof falError.status === "number" && falError.status >= 400 && falError.status < 500 ? falError.status : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!submitData?.request_id) {
      console.error("fal submit response unreadable", submitData);
      await admin
        .from("video_jobs")
        .update({ status: "failed", error: "Provider returned an invalid submission response" })
        .eq("id", job.id);
      if (starterEntitlementUsed) await admin.rpc("restore_starter_render", { _user_id: uid, _operation_key: creditOperationId });
      else await refundCredits({ userId: uid, amount: creditCost, reason: "video_render_refund", refId: job.id, idempotencyKey: `${creditOperationId}:refund`, metadata: { stage: "submit_invalid" } });
      return new Response(JSON.stringify({ error: "Provider rejected request" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const fallbackUrls = getFallbackFalUrls(model, submitData.request_id);
    if (starterEntitlementUsed) await admin.rpc("consume_starter_render", { _user_id: uid, _operation_key: creditOperationId });
    const normalizedStatusUrl =
      normalizeFalQueueUrl(submitData.status_url as string | null | undefined, "status") ||
      fallbackUrls.statusUrl;
    const normalizedResponseUrl =
      normalizeFalQueueUrl(submitData.response_url as string | null | undefined, "response") ||
      normalizedStatusUrl.replace(/\/status$/, "");

    await admin
      .from("video_jobs")
      .update({
        fal_request_id: submitData.request_id,
        fal_status_url: normalizedStatusUrl,
        fal_response_url: normalizedResponseUrl,
        status: "processing",
      })
      .eq("id", job.id);

    return new Response(
      JSON.stringify({
        ...job,
        fal_request_id: submitData.request_id,
        fal_status_url: normalizedStatusUrl,
        fal_response_url: normalizedResponseUrl,
        status: "processing",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-video error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
