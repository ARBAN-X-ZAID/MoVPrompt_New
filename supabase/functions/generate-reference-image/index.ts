// Director-driven image generation. Uses Lovable AI Gateway image model and uploads
// generated images to the private `director-uploads` bucket. Returns signed URLs.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { chargeCredits, refundCredits, priceFor, InsufficientCreditsError, insufficientResponse } from "../_shared/credits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SIGNED_URL_TTL = 60 * 60;

type Mode = "character_sheet" | "storyboard_panels" | "single_panel" | "multi_angle";
type LockMode = "character" | "scene" | "auto";

// Multi-angle = same subject + same scene, only the camera position changes.
// This lock is harder than IDENTITY_LOCK because it also pins wardrobe, props,
// lighting, background, time of day, and scale.
const ANGLE_LOCK =
  "ANGLE-ONLY VARIATION. Treat the attached reference as the canonical image. Keep the subject identical (face, hair, skin tone, age, body, wardrobe, accessories — or, for products, the exact same object: shape, materials, colors, branding, logos, proportions). Keep the scene identical (same background, same props, same lighting setup, same color temperature, same time of day, same depth of field, same scale of subject in frame). DO NOT change pose action, expression, wardrobe, props, location, or lighting. ONLY the camera angle changes per the beat below.";

type StyleSpec = {
  lens?: string;
  lighting?: string;
  palette?: string;
  film_emulation?: string;
  grade?: string;
  mood?: string;
};

type Quality = "1K" | "2K" | "4K";

type Body = {
  mode?: Mode;
  prompt?: string;
  reference_urls?: string[];
  count?: number;
  aspect_ratio?: "1:1" | "16:9" | "9:16";
  per_shot_prompts?: string[]; // when mode === "storyboard_panels", one per shot
  shot_index?: number; // when regenerating a single panel inside an existing 3x3 grid
  lock_mode?: LockMode; // "character" | "scene" (key-frame extension) | "auto" (default)
  subject_kind?: "character" | "product"; // shapes the character_sheet layout copy
  style_spec?: StyleSpec; // optional locked DP spec injected into every panel prompt
  quality?: Quality; // 1K = native (~1024px), 2K = 2x upscale (free), 4K = 4x upscale (+credits)
};

const UPSCALE_4K_FALLBACK_PRICE = 3; // credits per panel upscaled to 4K

const IDENTITY_LOCK =
  "Same character as the attached reference image. Maintain exact face, hair, skin tone, age, body proportions, and outfit. Do not redesign the character.";

const SCENE_LOCK =
  "Same scene as the attached key frame. Maintain the exact location, lighting setup, color grade, lens, depth of field, camera height, and composition language. Keep subject, props, wardrobe, time of day, and background continuous. Only the action and framing change between frames.";

const HERO_FRAME_SUFFIX =
  " Single polished hero frame: cinematic composition, intentional depth of field, controlled lighting, clean negative space. No text, no captions, no watermark, no UI overlays.";

// Applied to EVERY storyboard panel so panels are finished cinematography stills,
// not draft beats. This is the biggest quality lever for downstream video renders.
const PANEL_POLISH_SUFFIX =
  " Single polished storyboard frame. Cinematic composition with deliberate negative space, lens-correct geometry, controlled depth of field, motivated lighting with clear key/fill/rim separation, consistent film grain, finished color grade. Photographic finish — no draft sketch quality, no rough lines, no concept-art looseness. No text, no captions, no watermark, no UI overlay, no on-image labels, no shot numbers burned in.";

function buildStyleHeader(spec?: StyleSpec): string {
  if (!spec) return "";
  const parts: string[] = [];
  if (spec.lens) parts.push(`lens ${spec.lens}`);
  if (spec.lighting) parts.push(`lighting ${spec.lighting}`);
  if (spec.palette) parts.push(`palette ${spec.palette}`);
  if (spec.film_emulation) parts.push(`stock ${spec.film_emulation}`);
  if (spec.grade) parts.push(`grade ${spec.grade}`);
  if (spec.mood) parts.push(`mood ${spec.mood}`);
  if (parts.length === 0) return "";
  return `LOCKED STYLE — ${parts.join(" · ")}. Apply to this frame verbatim. `;
}

function buildAspectClause(aspect: string): string {
  return ` Frame composed for ${aspect} aspect ratio — fill the full frame, no letterboxing, no pillarboxing, no border bars, no padding.`;
}


function dataUrlToBlob(dataUrl: string): { blob: Blob; mime: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error("Invalid image data URL");
  const mime = m[1];
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { blob: new Blob([bytes], { type: mime }), mime };
}

// Inline an http(s) image as a data URL. The AI Gateway cannot reliably fetch
// Supabase private-bucket signed URLs (returns 400 upstream), so we fetch the
// bytes server-side. Signed URLs occasionally 400 too (token edge cases, URL
// re-encoding in transit). When the URL points at our own storage we fall
// back to a service-role download by parsing the bucket + object path out of
// the URL. This is critical: if the reference image silently fails to inline,
// the model invents a brand-new character instead of matching the user's ref.
const SUPABASE_URL_ENV = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const adminStorage = SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL_ENV, SERVICE_ROLE_KEY).storage
  : null;

function parseStorageObjectPath(url: string): { bucket: string; path: string } | null {
  try {
    const u = new URL(url);
    if (!SUPABASE_URL_ENV || !u.href.startsWith(SUPABASE_URL_ENV)) return null;
    const m = u.pathname.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/]+)\/(.+)$/);
    if (!m) return null;
    return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]) };
  } catch { return null; }
}

function bytesToDataUrl(buf: Uint8Array, mime: string): string {
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return `data:${mime};base64,${btoa(bin)}`;
}

async function toDataUrl(url: string): Promise<string> {
  if (/^data:/i.test(url)) return url;
  try {
    const resp = await fetch(url);
    if (resp.ok) {
      const buf = new Uint8Array(await resp.arrayBuffer());
      const mime = resp.headers.get("content-type") || "image/png";
      return bytesToDataUrl(buf, mime);
    }
    console.warn("ref direct fetch non-ok", resp.status, url.slice(0, 80));
  } catch (e) {
    console.warn("ref direct fetch threw", String(e), url.slice(0, 80));
  }
  // Fallback: service-role download for our own storage URLs.
  const parsed = parseStorageObjectPath(url);
  if (parsed && adminStorage) {
    const { data, error } = await adminStorage.from(parsed.bucket).download(parsed.path);
    if (!error && data) {
      const buf = new Uint8Array(await data.arrayBuffer());
      const mime = data.type || "image/png";
      return bytesToDataUrl(buf, mime);
    }
    console.warn("ref storage fallback failed", parsed.bucket, parsed.path, error?.message);
  }
  throw new Error(`ref_fetch_failed`);
}

async function materializeRefs(urls: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const u of urls) {
    try { out.push(await toDataUrl(u)); }
    catch (e) { console.warn("ref materialize failed; skipping", u, e); }
  }
  return out;
}

async function generateOne(
  apiKey: string,
  prompt: string,
  referenceUrls: string[],
  aspectRatio: string,
): Promise<string> {
  const aspectLine = aspectRatio ? `\n\nAspect ratio: ${aspectRatio}.` : "";
  const userParts: any[] = [{ type: "text", text: prompt + aspectLine }];
  const validRefs = referenceUrls.filter((u) => /^(https?:|data:)/i.test(u));
  const inlined = await materializeRefs(validRefs.slice(0, 4));
  for (const u of inlined) {
    userParts.push({ type: "image_url", image_url: { url: u } });
  }
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image-preview",
      messages: [{ role: "user", content: userParts }],
      modalities: ["image", "text"],
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    const err: any = new Error(`gateway_${resp.status}`);
    err.status = resp.status;
    err.detail = txt;
    throw err;
  }
  const data = await resp.json();
  const msg = data?.choices?.[0]?.message;
  const img =
    msg?.images?.[0]?.image_url?.url ||
    msg?.images?.[0]?.url ||
    null;
  if (!img) throw new Error("no_image_returned");
  return img as string;
}

// Upscale a data URL (or http url) via FAL clarity-upscaler. Returns a data URL
// to keep the rest of the pipeline (dataUrlToBlob) unchanged.
async function upscaleViaFal(
  falKey: string,
  sourceUrl: string,
  scale: 2 | 4,
): Promise<string> {
  const resp = await fetch("https://fal.run/fal-ai/clarity-upscaler", {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: sourceUrl,
      upscale_factor: scale,
      creativity: 0.2,
      // FAL clarity-upscaler caps `resemblance` at 1.0 — sending >1 returns 422
      // and the whole 4K request crashes back to 1K. Keep this <= 1.
      resemblance: 1.0,
      num_inference_steps: 18,
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    const err: any = new Error(`fal_upscale_${resp.status}`);
    err.status = resp.status;
    err.detail = txt;
    throw err;
  }
  const data = await resp.json();
  const outUrl: string | undefined = data?.image?.url || data?.images?.[0]?.url;
  if (!outUrl) throw new Error("fal_no_image");
  // Fetch as bytes and re-encode as data URL so dataUrlToBlob works downstream.
  const imgResp = await fetch(outUrl);
  if (!imgResp.ok) throw new Error(`fal_fetch_${imgResp.status}`);
  const buf = new Uint8Array(await imgResp.arrayBuffer());
  const mime = imgResp.headers.get("content-type") || "image/png";
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return `data:${mime};base64,${btoa(bin)}`;
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
  const userId = userData.user.id;

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "Service misconfigured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as Body & {
      op?: "edit";
      source_url?: string;
      mask_url?: string;
      edit_mode?: "prompt" | "paint" | "swap" | "erase";
    };

    // -------- Edit branch (prompt / paint-mask / swap / erase) --------
    if (body.op === "edit") {
      const sourceUrl = (body.source_url || "").trim();
      const maskUrl = (body.mask_url || "").trim();
      const editMode = body.edit_mode || "prompt";
      const userPrompt = (body.prompt || "").trim();
      const aspectE = body.aspect_ratio || "16:9";
      if (!sourceUrl) {
        return new Response(JSON.stringify({ error: "source_url required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (editMode !== "erase" && !userPrompt) {
        return new Response(JSON.stringify({ error: "prompt required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const needsMask = editMode === "paint" || editMode === "swap" || editMode === "erase";
      if (needsMask && !maskUrl) {
        return new Response(JSON.stringify({ error: "mask_url required for this edit mode" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const editQuality: Quality =
        body.quality === "2K" || body.quality === "4K" ? body.quality : "1K";
      const FAL_KEY_EDIT = editQuality === "1K" ? null : Deno.env.get("FAL_KEY") || null;
      const effectiveEditQuality: Quality =
        editQuality !== "1K" && !FAL_KEY_EDIT ? "1K" : editQuality;

      const editPrice = await priceFor("image_generation", 5);
      const upscalePrice4KEdit = await priceFor("image_upscale_4k", UPSCALE_4K_FALLBACK_PRICE);
      const editSurcharge = effectiveEditQuality === "4K" ? upscalePrice4KEdit : 0;
      const totalEditCharge = editPrice + editSurcharge;
      try {
        await chargeCredits({
          userId,
          amount: totalEditCharge,
          reason: "image_edit",
          metadata: { mode: editMode, quality: effectiveEditQuality },
        });
      } catch (e) {
        if (e instanceof InsufficientCreditsError) return insufficientResponse(corsHeaders);
        throw e;
      }

      const instr = (() => {
        const aspectLine = ` Output frame must fill a ${aspectE} aspect ratio (no letterboxing).`;
        if (editMode === "prompt") {
          return `Edit the attached image. Apply this transformation to the entire image while preserving the subject identity and overall composition: ${userPrompt}.${aspectLine} Return only the edited image — no text, captions, watermarks, or borders.`;
        }
        if (editMode === "paint") {
          return `You are given TWO images. Image 1 is the source. Image 2 is a binary mask — WHITE pixels mark the region to edit; BLACK pixels must remain pixel-identical. Inside the white region, render: ${userPrompt}. Outside the white region keep the source image unchanged. Blend the edit seamlessly with surrounding lighting, color, focus, and grain.${aspectLine} Return only the edited image — no text.`;
        }
        if (editMode === "swap") {
          return `You are given TWO images. Image 1 is the source. Image 2 is a binary mask — WHITE pixels mark the subject to replace. Replace the subject inside the white region with: ${userPrompt}. Keep lighting direction, color grade, shadows, perspective, scale, and surrounding environment perfectly consistent. The rest of the image (black mask region) must remain pixel-identical.${aspectLine} Return only the edited image.`;
        }
        // erase
        return `You are given TWO images. Image 1 is the source. Image 2 is a binary mask — WHITE pixels mark content to REMOVE. Cleanly remove everything inside the white region and reconstruct a plausible background that matches surrounding lighting, texture, focus, and perspective. The rest of the image (black mask region) must remain pixel-identical.${aspectLine} Return only the edited image — no text.`;
      })();

      const inlinedSource = await toDataUrl(sourceUrl).catch((e) => { throw Object.assign(new Error("source_fetch_failed"), { cause: e }); });
      const inlinedMask = maskUrl ? await toDataUrl(maskUrl).catch(() => maskUrl) : "";
      const userParts: any[] = [{ type: "text", text: instr }, { type: "image_url", image_url: { url: inlinedSource } }];
      if (inlinedMask) userParts.push({ type: "image_url", image_url: { url: inlinedMask } });

      let outDataUrl: string;
      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-image-preview",
            messages: [{ role: "user", content: userParts }],
            modalities: ["image", "text"],
          }),
        });
        if (!resp.ok) {
          const txt = await resp.text();
          console.error("edit gateway error", resp.status, txt);
          throw Object.assign(new Error(`gateway_${resp.status}`), { status: resp.status, detail: txt });
        }
        const data = await resp.json();
        const msg = data?.choices?.[0]?.message;
        const img = msg?.images?.[0]?.image_url?.url || msg?.images?.[0]?.url || null;
        if (!img) throw new Error("no_image_returned");
        outDataUrl = img as string;
      } catch (e) {
        try { await refundCredits({ userId, amount: totalEditCharge, reason: "image_edit_refund", metadata: { mode: editMode } }); } catch {}
        throw e;
      }

      // Optional upscale for 2K / 4K
      let appliedEditQuality: Quality = "1K";
      if (effectiveEditQuality !== "1K" && FAL_KEY_EDIT) {
        try {
          const scale = effectiveEditQuality === "4K" ? 4 : 2;
          outDataUrl = await upscaleViaFal(FAL_KEY_EDIT, outDataUrl, scale);
          appliedEditQuality = effectiveEditQuality;
        } catch (e) {
          console.error("edit upscale failed; falling back to 1K", e);
          if (effectiveEditQuality === "4K" && upscalePrice4KEdit > 0) {
            try {
              await refundCredits({ userId, amount: upscalePrice4KEdit, reason: "image_upscale_refund", metadata: { stage: "edit_upscale_failed" } });
            } catch (re) { console.error("upscale refund failed", re); }
          }
        }
      }

      const { blob, mime } = dataUrlToBlob(outDataUrl);
      const ext = (mime.split("/")[1] || "png").split("+")[0];
      const path = `${userId}/edit-${crypto.randomUUID().slice(0, 8)}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("director-uploads")
        .upload(path, blob, { contentType: mime, upsert: false });
      if (upErr) {
        try { await refundCredits({ userId, amount: totalEditCharge, reason: "image_edit_refund", metadata: { mode: editMode, stage: "upload" } }); } catch {}
        throw upErr;
      }
      const { data: signed, error: signErr } = await supabase.storage
        .from("director-uploads").createSignedUrl(path, SIGNED_URL_TTL);
      if (signErr || !signed?.signedUrl) {
        try { await refundCredits({ userId, amount: totalEditCharge, reason: "image_edit_refund", metadata: { mode: editMode, stage: "sign" } }); } catch {}
        throw signErr || new Error("sign_failed");
      }

      return new Response(
        JSON.stringify({
          mode: "single_panel",
          images: [{ url: signed.signedUrl, storage_path: path, quality: appliedEditQuality }],
          edit: { mode: editMode, prompt: userPrompt, parent_url: sourceUrl },
          quality: appliedEditQuality,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // -------- end edit branch --------

    const mode: Mode = body.mode || "single_panel";
    const basePrompt = (body.prompt || "").trim();
    if (!basePrompt && !(body.per_shot_prompts?.length)) {
      return new Response(JSON.stringify({ error: "prompt required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const referenceUrls = Array.isArray(body.reference_urls)
      ? body.reference_urls.filter((u) => typeof u === "string" && u.length > 0)
      : [];
    const aspect = body.aspect_ratio || "16:9";

    const hasReference = referenceUrls.length > 0;
    const lockMode: LockMode = body.lock_mode || "auto";
    const effectiveLock: "character" | "scene" | "none" = !hasReference
      ? "none"
      : lockMode === "scene"
        ? "scene"
        : lockMode === "character"
          ? "character"
          : "character"; // auto with ref defaults to character (backwards compatible)
    const lockPhrase =
      effectiveLock === "character" ? IDENTITY_LOCK : effectiveLock === "scene" ? SCENE_LOCK : "";
    const lockPrefix = lockPhrase ? `${lockPhrase} ` : "";

    // shot_index lets the caller regenerate a single panel inside an existing
    // 3x3 grid without touching the other 8 cells. We still keep mode="storyboard_panels"
    // so the output rides the same role/shot_index pipeline downstream.
    const regenIndex =
      mode === "storyboard_panels" &&
      typeof body.shot_index === "number" &&
      body.shot_index >= 1 &&
      body.shot_index <= 9
        ? body.shot_index
        : null;

    let prompts: string[];
    let shotIndices: number[]; // per-prompt shot_index for storyboard_panels and multi_angle
    const isChain =
      (mode === "storyboard_panels" && !regenIndex) ||
      (mode === "multi_angle" && (body.per_shot_prompts?.length ?? 0) > 1);
    const styleHeader = buildStyleHeader(body.style_spec);
    const aspectClause = buildAspectClause(aspect);
    if (mode === "multi_angle") {
      // Multi-angle: 6 panels max, each rendered with a hard ANGLE-ONLY lock so
      // the model re-angles the reference instead of redesigning it. We accept
      // per_shot_prompts from the client (the canonical 6 angle beats) but cap
      // at 6 and fall back to a generic 6-angle rotation if none provided.
      const FALLBACK_ANGLES = [
        "Front-on, eye-level.",
        "Three-quarter angle from the left, eye-level.",
        "Pure left profile, eye-level.",
        "Back / reverse angle, eye-level.",
        "Three-quarter angle from the right, eye-level.",
        "Low hero angle from front-below looking up.",
      ];
      const raw =
        Array.isArray(body.per_shot_prompts) && body.per_shot_prompts.length > 0
          ? body.per_shot_prompts.slice(0, 6)
          : FALLBACK_ANGLES;
      const total = raw.length;
      prompts = raw.map((beat, i) => {
        return `${styleHeader}${ANGLE_LOCK} Angle ${i + 1} of ${total}: ${beat}${aspectClause}${PANEL_POLISH_SUFFIX}`;
      });
      shotIndices = prompts.map((_, i) => i + 1);
    } else if (mode === "storyboard_panels") {
      const raw =
        Array.isArray(body.per_shot_prompts) && body.per_shot_prompts.length > 0
          ? body.per_shot_prompts.slice(0, 9)
          : Array.from(
              { length: Math.min(Math.max(body.count || 9, 1), 9) },
              () => basePrompt,
            );
      const total = regenIndex ? 9 : raw.length;
      const continuityClause = isChain
        ? " Match the previous panel exactly: same character, wardrobe, hair, face, props, lens, focal length, lighting direction, color grade, film stock, contrast, atmospheric density, time of day, and weather. Only the action and framing change between frames."
        : "";
      const subjectClause = referenceUrls.length >= 2
        ? " Match the subject (character or product) shown in the first attached reference sheet — keep face, wardrobe, hair, branding, and proportions exact."
        : "";
      prompts = raw.map((beat, i) => {
        const shotNum = regenIndex ?? i + 1;
        return `${styleHeader}${lockPrefix}Shot ${shotNum} of ${total}: ${beat}${continuityClause}${subjectClause}${aspectClause}${PANEL_POLISH_SUFFIX}`;
      });
      shotIndices = regenIndex
        ? prompts.map(() => regenIndex)
        : prompts.map((_, i) => i + 1);
    } else if (mode === "character_sheet") {
      const subjectKind = body.subject_kind === "product" ? "product" : "character";
      const sheetLock = hasReference
        ? subjectKind === "product"
          ? "Use the attached reference image as the canonical product. Every view on this sheet (closeup + 4 angles) must show the EXACT same object — same shape, materials, colors, branding, proportions, logos, and details as the reference. Do not redesign the product; only re-angle the same item. "
          : "Use the attached reference image as the canonical identity. Every view on this sheet (closeup + 4 angles) must show the EXACT same person — same face, hair, skin tone, age, eye color, facial features, and body proportions as the reference. Do not redesign the character; only re-pose and re-angle the same person. If the description below does not specify wardrobe, keep the outfit from the reference. "
        : "";
      const sheetTemplate =
        subjectKind === "product"
          ? `${styleHeader}${sheetLock}Product / object reference sheet, single image, split composition. Left half: a large, left-aligned detailed closeup of the item showing material, texture, and craftsmanship. Right half: a multi-angle view of the same item showing four angles in this order — front, right side, left side, and back (or top if the item is rotationally symmetrical). All views on a seamless pure white background, even soft studio lighting, no hands, no people, no props, no shadows beneath the item. Absolutely no text, no labels, no captions, no annotations, no measurements, no watermarks, no logos overlay, no borders, no soft gradients, no color swatches. Photorealistic. ${basePrompt}`
          : `${styleHeader}${sheetLock}Character reference sheet, single image, split composition. Left half: a large, left-aligned closeup portrait of the character (head and shoulders, outfit visible at the top, neutral expression, looking at camera). Right half: a full-body multi-angle view of the same character showing four poses in this order — front view, right side profile, left side profile, and back view. Consistent identity, wardrobe, hair, and proportions across every view. All views on a seamless pure white background, even soft studio lighting, no harsh shadows under the feet, no extra props beyond what the character wears. Absolutely no text, no labels, no captions, no annotations, no watermarks, no borders, no soft gradients, no color swatches. Photorealistic. ${basePrompt}`;
      prompts = [sheetTemplate];
      shotIndices = [];
    } else {
      const count = Math.min(Math.max(body.count || 1, 1), 9);
      // Without a reference image, treat single_panel as a hero/key frame and
      // append a polish suffix so the model treats it as a finished still
      // rather than a draft.
      const suffix = !hasReference ? HERO_FRAME_SUFFIX : "";
      prompts = Array.from(
        { length: count },
        () => `${styleHeader}${lockPrefix}${basePrompt}${suffix}${aspectClause}`,
      );
      shotIndices = [];
    }


    const quality: Quality = body.quality === "2K" || body.quality === "4K" ? body.quality : "1K";
    const FAL_KEY = quality === "1K" ? null : Deno.env.get("FAL_KEY") || null;
    if (quality !== "1K" && !FAL_KEY) {
      // Upscaler unavailable — silently fall back to 1K rather than failing.
      console.warn("FAL_KEY missing; falling back to 1K");
    }
    const effectiveQuality: Quality = quality !== "1K" && !FAL_KEY ? "1K" : quality;

    const perImage = await priceFor("image_generation", 5);
    const upscalePrice4K = await priceFor("image_upscale_4k", UPSCALE_4K_FALLBACK_PRICE);
    const upscaleSurcharge = effectiveQuality === "4K" ? upscalePrice4K * prompts.length : 0;
    const totalCharge = perImage * prompts.length + upscaleSurcharge;
    try {
      await chargeCredits({ userId, amount: totalCharge, reason: "image_generation", metadata: { count: prompts.length, mode, quality: effectiveQuality } });
    } catch (e) {
      if (e instanceof InsufficientCreditsError) return insufficientResponse(corsHeaders);
      throw e;
    }

    const runOne = async (p: string, i: number, refs: string[]) => {
      let dataUrl = await generateOne(LOVABLE_API_KEY, p, refs, aspect);
      let appliedQuality: Quality = "1K";
      if (effectiveQuality !== "1K" && FAL_KEY) {
        try {
          const scale = effectiveQuality === "4K" ? 4 : 2;
          dataUrl = await upscaleViaFal(FAL_KEY, dataUrl, scale);
          appliedQuality = effectiveQuality;
        } catch (e) {
          console.error("upscale failed; falling back to 1K for panel", i + 1, e);
          // refund 4K surcharge for this panel
          if (effectiveQuality === "4K" && upscalePrice4K > 0) {
            try {
              await refundCredits({ userId, amount: upscalePrice4K, reason: "image_upscale_refund", metadata: { panel: i + 1, reason: "upscale_failed" } });
            } catch (re) {
              console.error("upscale refund failed", re);
            }
          }
        }
      }
      const { blob, mime } = dataUrlToBlob(dataUrl);
      const ext = mime.split("/")[1] || "png";
      const safeName = `${mode}-${Date.now()}-${i + 1}.${ext}`;
      const path = `${userId}/gen-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("director-uploads")
        .upload(path, blob, { contentType: mime, upsert: false });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage
        .from("director-uploads")
        .createSignedUrl(path, SIGNED_URL_TTL);
      if (signErr || !signed?.signedUrl) throw signErr || new Error("sign_failed");
      return {
        url: signed.signedUrl,
        storage_path: path,
        shot_index: (mode === "storyboard_panels" || mode === "multi_angle") ? shotIndices[i] : undefined,
        quality: appliedQuality,
      };
    };

    type Settled<T> = { status: "fulfilled"; value: T } | { status: "rejected"; reason: unknown };


    if (isChain && prompts.length > 1) {
      // Stream NDJSON so the client can show panels as they finish.
      // referenceUrls convention: [subjectSheet?, sceneAnchor, ...extras].
      // If the caller only sent one ref it acts as both sticky + anchor.
      // Panels run in PARALLEL (lock_mode:scene anchors continuity via the key
      // frame) so wall-clock is ~T instead of N×T — keeps the single HTTP
      // stream inside the gateway timeout for 6–8 panels.
      const sticky = referenceUrls[0];
      const sceneAnchor = referenceUrls[1] ?? sticky;
      const extras = referenceUrls.slice(2, 3);
      const sharedRefs = Array.from(
        new Set(
          [
            ...(sticky ? [sticky] : []),
            ...(sceneAnchor && sceneAnchor !== sticky ? [sceneAnchor] : []),
            ...extras,
          ],
        ),
      ).slice(0, 4);

      const encoder = new TextEncoder();
      let clientGone = false;
      const stream = new ReadableStream({
        async start(controller) {
          const safeEnqueue = (obj: unknown): boolean => {
            if (clientGone) return false;
            if (controller.desiredSize === null) {
              clientGone = true;
              return false;
            }
            try {
              controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
              return true;
            } catch (_e) {
              clientGone = true;
              return false;
            }
          };

          safeEnqueue({ type: "start", mode, total: prompts.length });

          // Fire all panels in parallel and emit each as it settles.
          let okCount = 0;
          let errCount = 0;
          const tasks = prompts.map((p, i) =>
            runOne(p, i, sharedRefs)
              .then((value) => {
                okCount++;
                safeEnqueue({ type: "panel", index: i + 1, value });
              })
              .catch((reason: any) => {
                errCount++;
                console.error("panel error", i + 1, reason);
                safeEnqueue({
                  type: "panel_error",
                  index: i + 1,
                  error: String(reason?.message || reason),
                });
              }),
          );
          await Promise.all(tasks);

          const missing = prompts.length - okCount;
          if (missing > 0) {
            try {
              const refundAmount =
                perImage * missing +
                (effectiveQuality === "4K" ? upscalePrice4K * missing : 0);
              await refundCredits({
                userId,
                amount: refundAmount,
                reason: "image_generation_refund",
                metadata: { missing, errCount, clientGone, quality: effectiveQuality },
              });
            } catch (e) {
              console.error("refund failed", e);
            }
          }
          safeEnqueue({ type: "done", mode, missing });
          if (!clientGone) {
            try {
              controller.close();
            } catch (_e) {
              /* already closed */
            }
          }
        },
        cancel() {
          // Client disconnected — stop sending; in-flight generations finish
          // and any refund happens in start()'s missing-count path because the
          // not-yet-emitted panels stay uncounted in okCount.
          clientGone = true;
        },
      });
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "application/x-ndjson" },
      });
    }

    const results: Settled<{ url: string; storage_path: string; shot_index?: number; quality?: Quality }>[] =
      await Promise.allSettled(prompts.map((p, i) => runOne(p, i, referenceUrls)));

    const out: Array<{ url: string; storage_path: string; shot_index?: number; quality?: Quality }> = [];
    let firstError: unknown = null;
    for (const r of results) {
      if (r.status === "fulfilled") out.push(r.value);
      else if (!firstError) firstError = r.reason;
    }
    const missing = prompts.length - out.length;
    if (missing > 0) {
      const refundAmount =
        perImage * missing + (effectiveQuality === "4K" ? upscalePrice4K * missing : 0);
      await refundCredits({ userId, amount: refundAmount, reason: "image_generation_refund", metadata: { missing, quality: effectiveQuality } });
    }
    if (out.length === 0 && firstError) throw firstError;

    return new Response(
      JSON.stringify({ mode, images: out }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("generate-reference-image error", e);
    const status = e?.status === 429 ? 429 : e?.status === 402 ? 402 : 502;
    const msg =
      status === 429
        ? "Image generation rate-limited. Try again shortly."
        : status === 402
          ? "AI credits exhausted. Add credits in Workspace → Usage."
          : e?.message || "Image generation failed";
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
