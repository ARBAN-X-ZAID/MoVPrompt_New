import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { BASE_SYSTEM_PROMPT, timelineAddendum } from "./experts/_base.ts";
import { getAgent } from "./experts/registry.ts";
import { getAgentProfile } from "./experts/profile-loader.ts";
import { getKlingVariantHints } from "./experts/kling.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory sliding window rate limiter (secondary defence)
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 5;
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

const ALLOWED_WORKFLOWS = new Set(["single", "twoframe", "multishot"]);
const ALLOWED_MODELS = new Set([
  "any",
  "hailuo-2.3-fast", "hailuo-2.3", "hailuo-02-fast", "hailuo-02",
  "kling-3.0", "kling-3.0-pro", "kling-3.0-standard", "kling-3.0-4k",
  "kling-3.0-omni", "kling-3.0-omni-edit", "kling-3.0-motion-control",
  "kling-2.6", "kling-2.5-turbo", "kling-2.1-master", "kling-2-master",
  "kling-o1-video", "kling-o1-video-edit",
  "kling-1.6-pro", "kling-1.6-standard", "kling-motion-control",
  "sora-2", "sora-2-pro", "sora-2-max", "sora-2-pro-max",
  "veo-3.1-lite", "veo-3.1-fast", "veo-3.1", "veo-3-fast", "veo-3", "veo-2",
  "gemini-omni-flash",
  "higgsfield-lite", "higgsfield-standard", "higgsfield-turbo",
  "wan-2.7", "wan-2.6", "wan-2.5", "wan-2.5-fast", "wan-2.2", "wan-2.2-fast",
  "seedance-2.0-fast", "seedance-2.0", "seedance-1.5-pro", "seedance-pro", "seedance-pro-fast",
  "grok-imagine", "grok-imagine-edit",
]);

function badRequest(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// System prompt is now composed at request time from BASE_SYSTEM_PROMPT + the
// resolved expert agent's docSummary, systemAddendum, and examples.

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // --- Authentication ---
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

  // Rate limiting by client IP (secondary defence)
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
    const { images, workflowType, description, targetModel, sceneBreakdown, audioEnabled, references, elements, autoInjectElements, multiShotCount, elementMentions, compactMode, addendum, feedback, timelineEnabled, targetDuration, targetAspectRatio } = body;
    const isCompact = compactMode === true;
    const refinementAddendum: string =
      typeof addendum === "string" ? addendum.trim().slice(0, 600) : "";
    const feedbackLiked: boolean | null =
      feedback && typeof feedback.liked === "boolean" ? feedback.liked : null;
    const feedbackReasons: string[] = Array.isArray(feedback?.reasons)
      ? (feedback.reasons as unknown[])
          .filter((r): r is string => typeof r === "string" && r.trim().length > 0)
          .map((r) => r.trim().slice(0, 60))
          .slice(0, 6)
      : [];
    const feedbackNote: string =
      feedback && typeof feedback.note === "string" ? feedback.note.trim().slice(0, 300) : "";

    // --- Input Validation ---
    // Allow 0 images when elements are provided (element-only mode, e.g. Seedance 2.0).
    const hasElements = Array.isArray(elements) && elements.length > 0;
    if (!Array.isArray(images) || images.length > 2 || (images.length === 0 && !hasElements)) {
      return badRequest("Invalid images: must be an array of 1-2 items (or 0 with elements)");
    }
    for (const img of images) {
      if (typeof img !== "string" || img.length > 2_000_000) {
        return badRequest("Each image must be a base64 string under 2MB");
      }
    }
    if (!workflowType || !ALLOWED_WORKFLOWS.has(workflowType)) {
      return badRequest("Invalid workflowType");
    }
    if (!targetModel || !ALLOWED_MODELS.has(targetModel)) {
      return badRequest("Invalid targetModel");
    }
    if (description && (typeof description !== "string" || description.length > 4000)) {
      return badRequest("Description must be a string under 4000 characters");
    }

    // Validate multiShotCount: integer 3..10 (default 10 only used in multishot)
    let resolvedShotCount = 10;
    if (multiShotCount !== undefined) {
      if (!Number.isInteger(multiShotCount) || multiShotCount < 3 || multiShotCount > 10) {
        return badRequest("multiShotCount must be an integer between 3 and 10");
      }
      resolvedShotCount = multiShotCount;
    }

    // If user is in multishot AND uploaded multiple elements, scale shot count to match
    // (one shot per element, capped 3..10). Server-side guard so the AI is told the right count
    // even if the client forgot to pass it.
    if (workflowType === "multishot" && hasElements) {
      const elementCount = (elements as unknown[]).length;
      if (elementCount >= 3) {
        resolvedShotCount = Math.max(resolvedShotCount, Math.min(10, elementCount));
      }
    }

    // Validate references (optional, max 10, ~8MB combined image payload)
    const ALLOWED_REF_KINDS = new Set(["image", "video", "audio"]);
    const ALLOWED_REF_ROLES = new Set(["style", "lighting", "composition", "motion", "mood"]);
    const validRefs: any[] = [];
    if (references !== undefined) {
      if (!Array.isArray(references) || references.length > 10) {
        return badRequest("references must be an array of at most 10 items");
      }
      let totalRefImageBytes = 0;
      for (const r of references) {
        if (!r || typeof r !== "object") return badRequest("Invalid reference entry");
        if (!ALLOWED_REF_KINDS.has(r.kind)) return badRequest("Invalid reference kind");
        if (!ALLOWED_REF_ROLES.has(r.role)) return badRequest("Invalid reference role");
        if (r.note !== undefined && (typeof r.note !== "string" || r.note.length > 300)) {
          return badRequest("Reference note must be a string under 300 chars");
        }
        if (r.filename !== undefined && (typeof r.filename !== "string" || r.filename.length > 200)) {
          return badRequest("Reference filename too long");
        }
        if (r.images !== undefined) {
          if (!Array.isArray(r.images) || r.images.length > 3) {
            return badRequest("Reference images must be an array of up to 3");
          }
          for (const img of r.images) {
            if (typeof img !== "string" || img.length > 2_000_000) {
              return badRequest("Each reference image must be base64 under 2MB");
            }
            totalRefImageBytes += img.length;
          }
        }
        validRefs.push(r);
      }
      if (totalRefImageBytes > 8_000_000) {
        return badRequest("Combined reference images exceed 8MB");
      }
    }

    // Validate elements (Seedance @Element flow). Same shape as references but max 10, role optional.
    const validElements: any[] = [];
    if (elements !== undefined) {
      if (!Array.isArray(elements) || elements.length > 10) {
        return badRequest("elements must be an array of at most 10 items");
      }
      let totalElBytes = 0;
      for (const e of elements) {
        if (!e || typeof e !== "object") return badRequest("Invalid element entry");
        if (!ALLOWED_REF_KINDS.has(e.kind)) return badRequest("Invalid element kind");
        if (e.note !== undefined && (typeof e.note !== "string" || e.note.length > 300)) {
          return badRequest("Element note must be a string under 300 chars");
        }
        if (e.filename !== undefined && (typeof e.filename !== "string" || e.filename.length > 200)) {
          return badRequest("Element filename too long");
        }
        if (e.images !== undefined) {
          if (!Array.isArray(e.images) || e.images.length > 3) {
            return badRequest("Element images must be an array of up to 3");
          }
          for (const img of e.images) {
            if (typeof img !== "string" || img.length > 2_000_000) {
              return badRequest("Each element image must be base64 under 2MB");
            }
            totalElBytes += img.length;
          }
        }
        validElements.push(e);
      }
      if (totalElBytes > 8_000_000) {
        return badRequest("Combined element images exceed 8MB");
      }
    }

    // Validate elementMentions (resolved scene-breakdown @N references from the client)
    const validElementMentions: { index: number; category: string; description: string }[] = [];
    if (elementMentions !== undefined) {
      if (!Array.isArray(elementMentions) || elementMentions.length > 50) {
        return badRequest("elementMentions must be an array of at most 50 items");
      }
      for (const m of elementMentions) {
        if (!m || typeof m !== "object") return badRequest("Invalid elementMention entry");
        if (!Number.isInteger(m.index) || m.index < 1 || m.index > 200) {
          return badRequest("elementMention.index must be an integer 1..200");
        }
        if (typeof m.category !== "string" || m.category.length > 60) {
          return badRequest("elementMention.category invalid");
        }
        if (typeof m.description !== "string" || m.description.length > 500) {
          return badRequest("elementMention.description invalid");
        }
        validElementMentions.push({ index: m.index, category: m.category, description: m.description });
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

    const modelLabels: Record<string, string> = {
      "any": "Any Model (Universal)",
      "hailuo-2.3-fast": "Minimax Hailuo 2.3 Fast",
      "hailuo-2.3": "Minimax Hailuo 2.3",
      "hailuo-02-fast": "Minimax Hailuo 02 Fast",
      "hailuo-02": "Minimax Hailuo 02",
      "kling-3.0": "Kling 3.0",
      "kling-3.0-omni": "Kling 3.0 Omni",
      "kling-3.0-omni-edit": "Kling 3.0 Omni Edit",
      "kling-2.6": "Kling 2.6",
      "kling-o1-video": "Kling O1 Video",
      "kling-o1-video-edit": "Kling O1 Video Edit",
      "kling-motion-control": "Kling Motion Control",
      "kling-3.0-motion-control": "Kling 3.0 Motion Control",
      "sora-2": "OpenAI Sora 2",
      "sora-2-pro": "OpenAI Sora 2 Pro",
      "sora-2-max": "OpenAI Sora 2 Max",
      "sora-2-pro-max": "OpenAI Sora 2 Pro Max",
      "veo-3.1-lite": "Google Veo 3.1 Lite",
      "veo-3.1-fast": "Google Veo 3.1 Fast",
      "veo-3.1": "Google Veo 3.1",
      "veo-3-fast": "Google Veo 3 Fast",
      "veo-3": "Google Veo 3",
      "higgsfield-lite": "Higgsfield Lite",
      "higgsfield-standard": "Higgsfield Standard",
      "higgsfield-turbo": "Higgsfield Turbo",
      "wan-2.7": "Wan 2.7",
      "wan-2.6": "Wan 2.6",
      "wan-2.5": "Wan 2.5",
      "wan-2.5-fast": "Wan 2.5 Fast",
      "wan-2.2": "Wan 2.2",
      "wan-2.2-fast": "Wan 2.2 Fast",
      "seedance-2.0-fast": "Seedance 2.0 Fast",
      "seedance-2.0": "Seedance 2.0",
      "seedance-1.5-pro": "Seedance 1.5 Pro",
      "seedance-pro": "Seedance Pro",
      "seedance-pro-fast": "Seedance Pro Fast",
      "grok-imagine": "Grok Imagine",
      "grok-imagine-edit": "Grok Imagine Edit",
    };

    // Resolve specialist agent for this target model (in-code defaults)
    const agent = getAgent(targetModel);

    // Try to load admin-edited overrides from agent_profiles table (cached 60s)
    let docSummary = agent.docSummary;
    let systemAddendum = agent.systemAddendum;
    let examples = agent.examples;
    let displayName = agent.displayName;
    try {
      const profile = await getAgentProfile(agent.id.replace(/-director$/, ""));
      if (profile && profile.is_active) {
        if (profile.doc_summary?.trim()) docSummary = profile.doc_summary;
        if (profile.system_addendum?.trim()) systemAddendum = profile.system_addendum;
        if (profile.examples?.trim()) examples = profile.examples;
        if (profile.display_name?.trim()) displayName = profile.display_name;
      }
    } catch (err) {
      console.error("agent_profiles lookup failed, using in-code defaults:", err);
    }

    // Variant-aware sub-routing (currently Kling only — extend to Veo/Seedance later if needed)
    let variantHints = "";
    if (agent.id === "kling-director") {
      variantHints = getKlingVariantHints(targetModel, workflowType, resolvedShotCount);
    }
    const variantBlock = variantHints ? `\n\n═══ VARIANT-SPECIFIC RULES ═══\n${variantHints}` : "";

    // Timeline Prompting addendum — appended when the user enables the toggle.
    // Duration sourced from user-selected targetDuration; defaults to 10s.
    // HARD RULE: Seedance always uses Timeline Prompting structure regardless of caller flag.
    const resolvedDuration = typeof targetDuration === "number" && targetDuration > 0 ? targetDuration : 10;
    const isSeedance = typeof targetModel === "string" && targetModel.startsWith("seedance");
    const timelineActive = timelineEnabled === true || isSeedance;
    const timelineBlock = timelineActive
      ? timelineAddendum({ defaultDuration: resolvedDuration, perShot: workflowType === "multishot" })
      : "";

    const composedSystemPrompt = `${BASE_SYSTEM_PROMPT}\n\n${docSummary}\n\n${systemAddendum}${variantBlock}${timelineBlock}\n\n═══ FEW-SHOT EXAMPLE ═══\n${examples}`;

    let userText = `Workflow: ${workflowType}\nTarget Model: ${modelLabels[targetModel] || targetModel}\nActive Agent: ${displayName}\n\n`;
    if (description?.trim()) {
      // Normalize shorthand @N → @Element N so the model sees a single canonical form
      const normalizedDescription = description.trim().replace(/@(\d+)\b/g, "@Element $1");
      userText += `User's creative vision: ${normalizedDescription}\n\n`;
    }
    // Inject scene breakdown if provided by user (frame-grouped)
    if (Array.isArray(sceneBreakdown) && sceneBreakdown.length > 0) {
      userText += `Scene Breakdown (user-directed):\n`;
      for (const frame of sceneBreakdown) {
        if (sceneBreakdown.length > 1) {
          userText += `\n--- ${frame.frameLabel || "Frame " + (frame.frameIndex + 1)} ---\n`;
        }
        if (Array.isArray(frame.elements)) {
          for (const el of frame.elements) {
            const actionLabel = el.action === "lock" ? "LOCK (keep static)" : "MOVE (animate)";
            userText += `- ${el.category}: "${el.description}" → ${actionLabel}`;
            if (el.note?.trim()) userText += ` | Note: "${el.note.trim()}"`;
            userText += `\n`;
          }
        }
      }
      userText += `\nRespect the user's lock/move directions precisely. Locked elements should remain static. Move elements should be animated.\n\n`;
    }

    // Resolved @N mentions from the description (scene-breakdown elements)
    if (validElementMentions.length > 0) {
      userText += `\n═══ USER @-MENTIONED SCENE ELEMENTS ═══\n`;
      userText += `In the user's creative vision above, every \`@N\` token refers to a specific analyzed scene element listed below. Apply the user's wording immediately following each \`@N\` to THAT element only — do not generalize the directive to the whole scene.\n`;
      for (const m of validElementMentions) {
        userText += `@${m.index} — ${m.category}: "${m.description}"\n`;
      }
      userText += `\n`;
    }

    if (typeof audioEnabled === "boolean") {
      userText += audioEnabled
        ? `Audio: ENABLED — generate a synced audio direction (ambient sound, music cues, dialogue/SFX as appropriate). Populate the audioBlock field.\n\n`
        : `Audio: DISABLED — produce a SILENT video. Do not include any audio direction. Set audioBlock to "Silent — no audio".\n\n`;
    }

    if (timelineActive) {
      const reason = isSeedance && timelineEnabled !== true
        ? `Timeline Prompting: ENABLED (auto — Seedance always uses Timeline structure). Every mainPrompt MUST follow the TIMELINE / EFFECTS INVENTORY / DENSITY MAP / ENERGY ARC structure defined in the system prompt. Clock-pinned beats are required.\n\n`
        : `Timeline Prompting: ENABLED — every mainPrompt MUST follow the TIMELINE / EFFECTS INVENTORY / DENSITY MAP / ENERGY ARC structure defined in the system prompt. Clock-pinned beats are required.\n\n`;
      userText += reason;
    }

    if (typeof targetDuration === "number" && targetDuration > 0) {
      userText += `Target video duration: ${targetDuration}s — set suggestedDuration to "${targetDuration}s" and pace beats/action to fit exactly this length.\n\n`;
    } else if (targetDuration === "auto") {
      userText += `Target video duration: AUTO — pick the most cinematic duration for this scene.\n\n`;
    }

    if (typeof targetAspectRatio === "string" && /^\d{1,2}:\d{1,2}$/.test(targetAspectRatio)) {
      userText += `Target aspect ratio: ${targetAspectRatio} — set suggestedAspectRatio to "${targetAspectRatio}" and frame/compose the scene for this exact ratio.\n\n`;
    }



    // Refinement guidance: from auto-fix chips, AI critique suggestions, or thumbs-down feedback.
    // These are USER-DIRECTED corrections to the previous attempt. Honor them precisely without rewriting other parts.
    if (refinementAddendum || feedbackLiked === false || feedbackReasons.length > 0 || feedbackNote) {
      userText += `═══ REFINEMENT GUIDANCE (highest priority) ═══\nThis is a refinement of a previous attempt. Apply these corrections precisely without weakening already-good elements.\n`;
      if (refinementAddendum) {
        userText += `- Required adjustment: ${refinementAddendum}\n`;
      }
      if (feedbackLiked === false) {
        userText += `- The previous output was marked DISLIKED by the user. Materially change the approach, do not produce a near-duplicate.\n`;
      } else if (feedbackLiked === true) {
        userText += `- The previous output was marked LIKED. Preserve its strengths; refine only what the guidance below targets.\n`;
      }
      if (feedbackReasons.length > 0) {
        userText += `- Specific complaints to fix: ${feedbackReasons.join("; ")}\n`;
      }
      if (feedbackNote) {
        userText += `- User's free-text note: "${feedbackNote}"\n`;
      }
      userText += `\n`;
    }

    // Build a Reference Brief if user attached references
    const ROLE_LABELS: Record<string, string> = {
      style: "Style — mirror artistic treatment only",
      lighting: "Lighting — mirror lighting/color temperature only",
      composition: "Composition — mirror framing/balance only",
      motion: "Motion — mirror camera/subject motion pacing only",
      mood: "Mood/Audio — inform tone and audioBlock energy only",
    };
    const refImageBlocks: { label: string; b64: string }[] = [];
    if (validRefs.length > 0) {
      userText += `\n\nREFERENCE MEDIA (use as guidance per role, do NOT copy their content):\n`;
      validRefs.forEach((r, idx) => {
        const refNum = idx + 1;
        const noteSuffix = r.note ? ` — note: "${r.note}"` : "";
        const fileSuffix = r.filename ? ` [${r.filename}]` : "";
        if (r.kind === "image") {
          userText += `- Ref #${refNum} (${ROLE_LABELS[r.role]}, image)${fileSuffix}${noteSuffix}\n`;
          if (Array.isArray(r.images) && r.images[0]) {
            refImageBlocks.push({ label: `Reference #${refNum} (${r.role}, image)`, b64: r.images[0] });
          }
        } else if (r.kind === "video") {
          const frameCount = Array.isArray(r.images) ? r.images.length : 0;
          userText += `- Ref #${refNum} (${ROLE_LABELS[r.role]}, video — ${frameCount} keyframes)${fileSuffix}${noteSuffix}\n`;
          if (Array.isArray(r.images)) {
            r.images.forEach((b64: string, fIdx: number) => {
              refImageBlocks.push({ label: `Reference #${refNum} (${r.role}, video keyframe ${fIdx + 1}/${frameCount})`, b64 });
            });
          }
        } else if (r.kind === "audio") {
          userText += `- Ref #${refNum} (${ROLE_LABELS[r.role]}, audio)${fileSuffix}${noteSuffix || ' — no description provided'}\n`;
        }
      });
      userText += `\n`;
    }

    // Build the @Element brief (Seedance 2.0 / 2.0 Fast multi-reference flow)
    const elementImageBlocks: { label: string; b64: string }[] = [];
    if (validElements.length > 0) {
      userText += `\n\n═══ NUMBERED ELEMENTS (user-uploaded references) ═══\n`;
      validElements.forEach((e, idx) => {
        const n = idx + 1;
        const noteSuffix = e.note ? ` — note: "${e.note}"` : "";
        const fileSuffix = e.filename ? ` [${e.filename}]` : "";
        if (e.kind === "image") {
          userText += `- @Element ${n} (image)${fileSuffix}${noteSuffix}\n`;
          if (Array.isArray(e.images) && e.images[0]) {
            elementImageBlocks.push({ label: `@Element ${n} (image${e.filename ? ", filename: " + e.filename : ""})`, b64: e.images[0] });
          }
        } else if (e.kind === "video") {
          const frameCount = Array.isArray(e.images) ? e.images.length : 0;
          userText += `- @Element ${n} (video — ${frameCount} keyframes)${fileSuffix}${noteSuffix}\n`;
          if (Array.isArray(e.images)) {
            e.images.forEach((b64: string, fIdx: number) => {
              elementImageBlocks.push({ label: `@Element ${n} (video keyframe ${fIdx + 1}/${frameCount})`, b64 });
            });
          }
        } else if (e.kind === "audio") {
          userText += `- @Element ${n} (audio)${fileSuffix}${noteSuffix || " — mood reference"}\n`;
        }
      });
      if (autoInjectElements) {
        userText += `\nELEMENT MENTION PROTOCOL — In your mainPrompt:\n`;
        userText += `1. Preserve every \`@Element N\` token from the user's brief verbatim — Seedance parses these as reference anchors.\n`;
        userText += `2. If the user did NOT mention an Element, you MUST still incorporate it naturally and tag it inline as \`(@Element N: <one-word role: subject/outfit/style/lighting/motion/mood>)\` the first time it appears.\n`;
        userText += `3. Never describe an Element's content literally without its \`@Element N\` tag — the anchor is required to bind generation to the upload.\n`;
        userText += `4. Result: the user can copy your mainPrompt directly into Seedance and every upload is correctly referenced.\n\n`;
      }
    }

    userText += `Analyze the image(s) using the Scene Decomposition Protocol, then generate cinematic prompts optimized for the target model.`;

    if (workflowType === "multishot") {
      userText += ` Generate EXACTLY ${resolvedShotCount} shot${resolvedShotCount === 1 ? "" : "s"} in the results array.`;
      if (resolvedShotCount === 3) {
        userText += ` These 3 shots will be STITCHED into one continuous video — design them as a narrative sequence (Shot 1 = opening, Shot 2 = middle action, Shot 3 = resolution) with consistent subject, wardrobe, lighting, color grade, and lens character so they cut together seamlessly.`;
      }
    }

    const isSeedance20 = targetModel === "seedance-2.0" || targetModel === "seedance-2.0-fast";
    if (isSeedance20 && workflowType !== "multishot") {
      userText += ` Return EXACTLY ONE entry in the results array. The full shooting script — every sequence block and numbered cut — lives INSIDE the single mainPrompt of that one entry. Do NOT split cuts into separate results.`;
    }

    if (isCompact) {
      const targetLimit = ({
        "seedance-2.0-fast": 1800, "seedance-2.0": 1800, "seedance-1.5-pro": 1800, "seedance-pro": 1800, "seedance-pro-fast": 1800,
        "hailuo-2.3-fast": 1800, "hailuo-2.3": 1800, "hailuo-02-fast": 1800, "hailuo-02": 1800,
        "sora-2": 950, "sora-2-pro": 950, "sora-2-max": 950, "sora-2-pro-max": 950,
        "higgsfield-lite": 500, "higgsfield-standard": 500, "higgsfield-turbo": 500,
        "veo-3.1-lite": 1500, "veo-3.1-fast": 1500, "veo-3.1": 1500, "veo-3-fast": 1500, "veo-3": 1500,
        "kling-3.0": 2000, "kling-3.0-omni": 2000, "kling-3.0-omni-edit": 1200, "kling-2.6": 2000,
        "kling-o1-video": 2000, "kling-o1-video-edit": 1200, "kling-motion-control": 2000, "kling-3.0-motion-control": 2000,
        "wan-2.7": 1500, "wan-2.6": 1500, "wan-2.5": 1500, "wan-2.5-fast": 1500, "wan-2.2": 1500, "wan-2.2-fast": 1500,
        "grok-imagine": 1200, "grok-imagine-edit": 1200, "any": 1500,
      } as Record<string, number>)[targetModel] ?? 1500;
      const tight = Math.floor(targetLimit * 0.7);
      userText += `\n\nCOMPACT MODE — STRICT LENGTH BUDGET: Each \`mainPrompt\` MUST stay under ${tight} characters (≈${Math.floor(tight/6)} words). Cut every redundant adjective, merge sentences, drop optional flavor lines, and keep only the load-bearing scene/subject/camera/motion beats. Do NOT exceed ${tight} chars even if it means dropping a section. Treat this as a hard ceiling.`;
    }

    const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: "text", text: userText },
    ];

    for (const img of images) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${img}` },
      });
    }
    // Append reference images (each preceded by a labeled text block)
    for (const ref of refImageBlocks) {
      userContent.push({ type: "text", text: ref.label });
      userContent.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${ref.b64}` },
      });
    }
    // Append element images (Seedance @Element flow)
    for (const el of elementImageBlocks) {
      userContent.push({ type: "text", text: el.label });
      userContent.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${el.b64}` },
      });
    }

    const RECOMMENDABLE_MODELS = [
      "kling-3.0", "kling-3.0-omni", "kling-3.0-omni-edit", "kling-2.6", "kling-2.5-turbo",
      "kling-o1-video", "kling-o1-video-edit", "kling-motion-control", "kling-3.0-motion-control",
      "veo-3.1-lite", "veo-3.1-fast", "veo-3.1", "veo-3-fast", "veo-3",
      "seedance-2.0-fast", "seedance-2.0", "seedance-1.5-pro", "seedance-pro", "seedance-pro-fast",
    ] as const;
    const isAnyModel = targetModel === "any";
    const shotSchema: any = {
      type: "object" as const,
      properties: {
        shotName: { type: "string" as const, description: "Name of the shot" },
        mainPrompt: { type: "string" as const, description: "The main cinematic prompt optimized for the target model's syntax" },
        negativePrompt: { type: "string" as const, description: "What to avoid, including model-specific negatives" },
        cameraSuggestions: { type: "string" as const, description: "Camera movement and lens suggestions" },
        modelNotes: { type: "string" as const, description: "Model-specific tips and settings" },
        suggestedAspectRatio: { type: "string" as const, description: "Recommended aspect ratio: 16:9, 9:16, or 1:1" },
        suggestedDuration: { type: "string" as const, description: "Recommended clip duration: 5s or 10s" },
        audioBlock: { type: "string" as const, description: "Audio direction (DIALOGUE / SFX / AMBIENT). Empty string if model has no audio." },
        cameraTags: { type: "string" as const, description: "Bracketed camera tags (Kling-style). Empty string if not applicable." },
        referenceGuidance: { type: "string" as const, description: "How the uploaded image(s) are used as reference. Empty string if not applicable." },
        shotStructure: { type: "string" as const, description: "Multi-shot timing breakdown (Seedance-style). Empty string if not applicable." },
        ...(isAnyModel ? {
          recommendedModel: { type: "string" as const, enum: RECOMMENDABLE_MODELS, description: "Universal mode only: the single best specialist model for this scene. Populate on the FIRST shot." },
          recommendedModelReason: { type: "string" as const, description: "ONE sentence, ≤25 words, tying the recommendation to a concrete scene attribute." },
        } : {}),
      },
      required: isAnyModel
        ? ["mainPrompt", "negativePrompt", "cameraSuggestions", "modelNotes", "suggestedAspectRatio", "suggestedDuration", "recommendedModel", "recommendedModelReason"]
        : ["mainPrompt", "negativePrompt", "cameraSuggestions", "modelNotes", "suggestedAspectRatio", "suggestedDuration"],
    };

    const buildAiBody = (model: string) => JSON.stringify({
      model,
      // Generous output budget so multi-shot tool calls (up to 10 detailed shots,
      // each with several long string fields) don't get silently truncated.
      max_tokens: 16000,
      messages: [
        { role: "system", content: composedSystemPrompt },
        { role: "user", content: userContent },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "generate_cinematic_prompts",
            description: "Generate structured cinematic video prompts from analyzed images",
            parameters: {
              type: "object",
              properties: {
                results: {
                  type: "array",
                  items: shotSchema,
                  description: "Array of shot results. 1 for single/twoframe; for multishot, exactly the number of shots requested in the user message (default 10, may be 3 for stitched-sequence mode).",
                },
              },
              required: ["results"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "generate_cinematic_prompts" } },
    });

    const callAi = (model: string) => fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: buildAiBody(model),
    });

    const PRIMARY_MODEL = "google/gemini-3.5-flash";
    const FALLBACK_MODEL = "google/gemini-2.5-flash";
    const SHOULD_FALLBACK = (s: number) => s === 429 || s === 402 || s === 500 || s === 502 || s === 503 || s === 504;
    let response = await callAi(PRIMARY_MODEL);
    let usedFallback = false;
    if (SHOULD_FALLBACK(response.status)) {
      console.warn(`generate-prompt: primary ${PRIMARY_MODEL} returned ${response.status}, retrying with ${FALLBACK_MODEL}`);
      response = await callAi(FALLBACK_MODEL);
      usedFallback = true;
    }

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

      if (response.status === 503 || response.status === 502 || response.status === 500 || response.status === 504) {
        return new Response(JSON.stringify({ error: "AI service is temporarily unavailable. Please try again in a moment." }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: `AI generation failed (${response.status})` }), {
        status: 502,
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

    if (isSeedance20 && workflowType !== "multishot" && Array.isArray(parsed.results) && parsed.results.length > 1) {
      parsed.results = parsed.results.slice(0, 1);
    }

    // Truncation guard: warn the user if the AI returned fewer shots than requested.
    if (
      workflowType === "multishot" &&
      Array.isArray(parsed.results) &&
      parsed.results.length < resolvedShotCount
    ) {
      console.warn(
        `generate-prompt: requested ${resolvedShotCount} shots but received ${parsed.results.length} (possible AI output truncation).`,
      );
      const last = parsed.results[parsed.results.length - 1];
      if (last && typeof last === "object") {
        const note = `\n\n⚠ Output truncated: requested ${resolvedShotCount} shots but the AI returned only ${parsed.results.length}. Try Regenerate, or upload fewer elements.`;
        last.modelNotes = (typeof last.modelNotes === "string" ? last.modelNotes : "") + note;
      }
    }

    // Server-side safety net: hard-trim mainPrompt to the model's documented input cap.
    // Mirrors src/lib/modelLimits.ts so the UI counter and the trim agree.
    const MODEL_CHAR_LIMITS: Record<string, number> = {
      "seedance-2.0-fast": 1800, "seedance-2.0": 1800, "seedance-1.5-pro": 1800, "seedance-pro": 1800, "seedance-pro-fast": 1800,
      "hailuo-2.3-fast": 1800, "hailuo-2.3": 1800, "hailuo-02-fast": 1800, "hailuo-02": 1800,
      "sora-2": 950, "sora-2-pro": 950, "sora-2-max": 950, "sora-2-pro-max": 950,
      "higgsfield-lite": 500, "higgsfield-standard": 500, "higgsfield-turbo": 500,
      "veo-3.1-lite": 1500, "veo-3.1-fast": 1500, "veo-3.1": 1500, "veo-3-fast": 1500, "veo-3": 1500,
      "kling-3.0": 2000, "kling-3.0-omni": 2000, "kling-3.0-omni-edit": 1200, "kling-2.6": 2000,
      "kling-o1-video": 2000, "kling-o1-video-edit": 1200, "kling-motion-control": 2000, "kling-3.0-motion-control": 2000,
      "wan-2.7": 1500, "wan-2.6": 1500, "wan-2.5": 1500, "wan-2.5-fast": 1500, "wan-2.2": 1500, "wan-2.2-fast": 1500,
      "grok-imagine": 1200, "grok-imagine-edit": 1200, "any": 1500,
    };
    const baseLimit = MODEL_CHAR_LIMITS[targetModel];
    const limit = baseLimit && isCompact ? Math.floor(baseLimit * 0.7) : baseLimit;
    if (limit && Array.isArray(parsed.results)) {
      for (const shot of parsed.results) {
        if (typeof shot?.mainPrompt === "string" && shot.mainPrompt.length > limit) {
          // Trim at last sentence boundary inside the cap to keep the prompt clean.
          const slice = shot.mainPrompt.slice(0, limit);
          const lastBoundary = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("\n"));
          shot.mainPrompt = (lastBoundary > limit * 0.6 ? slice.slice(0, lastBoundary + 1) : slice).trimEnd();
          const warn = `\n\n⚠ Auto-trimmed to fit ${modelLabels[targetModel] || targetModel} input limit (${limit} chars).`;
          shot.modelNotes = (typeof shot.modelNotes === "string" ? shot.modelNotes : "") + warn;
        }
      }
    }

    if (usedFallback && Array.isArray(parsed.results)) {
      for (const shot of parsed.results) {
        const note = "\n\n⚠ Generated with fallback model (primary was rate-limited).";
        shot.modelNotes = (typeof shot.modelNotes === "string" ? shot.modelNotes : "") + note;
      }
    }

    return new Response(JSON.stringify({ ...parsed, agent: agent.id, agentName: displayName, usedFallback }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-prompt error:", e);
    return new Response(JSON.stringify({ error: "Internal server error. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
