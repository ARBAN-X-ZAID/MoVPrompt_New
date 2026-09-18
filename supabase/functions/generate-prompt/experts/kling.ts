// Kling specialist agent — aligned with the official Kling AI Skill v1.1.0.
// MovPrompt only generates prompt TEXT for users to paste into the Kling app /
// API; we do not call Kling directly. So the rules below teach the LLM the
// official model catalog, routing triggers, placeholder syntax and prompt
// constraints so the produced text is paste-ready against the real product.

import type { ExpertAgent } from "./registry.ts";

// Variant-aware sub-routing: returns extra rules appended after the base
// systemAddendum so admin DB edits still take precedence on the core rules.
//
// `model` here is the MovPrompt UI model id (e.g. "kling-3.0", "kling-3.0-omni",
// "kling-3.0-omni-edit", "kling-2.6", "kling-o1", "kling-o1-edit",
// "kling-motion-control", "kling-3.0-motion-control", "kling-2.5-turbo").
// We map each to the canonical Kling Skill model name in modelNotes so users
// know exactly which option to pick in Kling.
export function getKlingVariantHints(model: string, workflowType?: string, shotCount?: number): string {
  const m = model.toLowerCase();
  const isEdit = m.includes("edit");
  const isMotionControl = m.includes("motion-control");
  const isOmni = m.includes("omni");
  const isO1 = m.includes("o1");
  const isMultiShot = workflowType === "multishot";
  const rawCount = shotCount && shotCount > 0 ? shotCount : 6;
  // Official Kling Skill caps customize multi-shot at 1–6 shots.
  const count = Math.min(6, Math.max(1, rawCount));

  // Canonical model + route mapping (single source of truth).
  // canonical = exact `--model` value the Kling Skill accepts.
  // route     = "basic-t2v" | "basic-i2v" | "omni-video" | "omni-video-edit"
  //             (used to drive sound + image_list rules in the prompt).
  let canonical = "kling-v3";
  let route: "basic-t2v" | "basic-i2v" | "omni-video" | "omni-video-edit" = "basic-i2v";
  let soundAllowed = true;
  let modelNote = "";

  if (isMotionControl) {
    // MovPrompt UI keeps "Motion Control" as a UX shortcut. In the new Kling
    // Skill there is no separate motion-control endpoint — it is omni-video
    // with `--video` (refer_type=feature) plus image references. We surface
    // this so the user knows the right Kling product surface.
    canonical = "kling-v3-omni";
    route = "omni-video";
    soundAllowed = true;
    modelNote =
      "Motion Control = Kling Omni Video with a reference clip (`--video` + `--video_refer_type feature`). In the Kling app pick Omni Video and attach the source motion clip.";
  } else if (isEdit && isOmni) {
    canonical = "kling-v3-omni";
    route = "omni-video-edit";
    soundAllowed = false; // with `--video`, sound MUST be off
    modelNote =
      "Omni Edit = Omni Video with `--video --video_refer_type base`. `sound` MUST be off. Do NOT define first/end frames in this mode.";
  } else if (isEdit) {
    // Generic legacy "edit" entry → route as Omni edit too.
    canonical = "kling-v3-omni";
    route = "omni-video-edit";
    soundAllowed = false;
    modelNote =
      "Edit variant maps to Omni Video edit (`--video_refer_type base`). `sound` MUST be off.";
  } else if (isO1) {
    canonical = "kling-video-o1";
    route = "omni-video";
    soundAllowed = false; // o1 has no sound at all
    modelNote =
      "Kling Video O1 — Omni-only, NEVER produces audio. Do not mention dialogue/SFX/ambience. Image count > 2 disallows `end_frame`.";
  } else if (isOmni) {
    canonical = "kling-v3-omni";
    route = "omni-video";
    soundAllowed = true;
    modelNote =
      "Omni route. Use `<<<image_n>>>`, `<<<element_n>>>`, `<<<video_1>>>` placeholders inside the prompt. Aspect ratio defaults to `auto`.";
  } else if (m.includes("2.6")) {
    canonical = "kling-v2-6";
    route = "basic-i2v";
    soundAllowed = false; // basic v2.6 in Skill spec has no sound flag
    modelNote =
      "Kling v2.6 — basic T2V/I2V only, NOT Omni-capable. Keep it single-subject single-action.";
  } else if (m.includes("2.5-turbo")) {
    // Legacy UI entry, no canonical equivalent in v1.1.0 Skill. Map to v2.6
    // basic and tell the user explicitly.
    canonical = "kling-v2-6";
    route = "basic-i2v";
    soundAllowed = false;
    modelNote =
      "2.5 Turbo is legacy — the official Kling Skill no longer lists it. Closest current equivalent is `kling-v2-6` on the basic route.";
  } else {
    // Default kling-3.0 → basic
    canonical = "kling-v3";
    route = "basic-i2v";
    soundAllowed = true;
    modelNote =
      "Basic Kling v3 route. Use a single image reference; do NOT use `<<<image_n>>>` placeholders (those are Omni-only).";
  }

  const blocks: string[] = [];

  // Per-variant cinematic guidance + multishot.
  if (isMultiShot) {
    blocks.push(`▸ MULTI-SHOT VARIANT ACTIVE (${count} shots, official cap 1–6)
- Output EXACTLY ${count} shots in the results array. Each shot is rendered separately in Kling and the user stitches them externally — Kling cannot output a single stitched video.
- This MUST mirror the Kling Skill request shape for ${canonical}:
    --multi_shot --shot_type customize --multi_prompt '[{"index":1,"prompt":"...","duration":"5"}, ...]'
  Per-shot durations must SUM to the total \`--duration\` (3–15s). Suggest a per-shot duration in modelNotes.
- Use this 6-beat cinematic arc (compress proportionally if shotCount < 6):
  1. Establishing wide — set location, time of day, atmosphere
  2. Subject intro — first clear look at the protagonist
  3. Inciting beat — the moment that triggers the scene
  4. Reaction / rising action — escalating motion or stakes
  5. Peak moment — dramatic apex
  6. Resolution — closing image that mirrors shot 1's framing
- EVERY shot follows the standard Kling rules below: 80–180 words, exactly ONE [camera:*] tag, action-verb opening.
- CONTINUITY BLOCK (mandatory in every shot's mainPrompt or referenceGuidance): "Locked across all shots — Subject identity: <face/wardrobe/hair from uploaded image>. Lighting: <direction + color temp>. Color grade: <palette/tone>." Derive these from the uploaded reference image.
- Each shot's referenceGuidance MUST explicitly state how it carries continuity from the previous shot (matching subject pose continuity, lighting carryover, grade carryover).
- shotName format: "Shot N — <beat label>" (e.g. "Shot 1 — Establishing wide").
- modelNotes for shot 1 ONLY: "Render in Kling as ${canonical} with --multi_shot --shot_type customize. Per-shot durations must sum to total --duration. Stitch externally if you also need a single file."
- ${soundAllowed ? "If audio is desired, set --sound on; otherwise off." : "DO NOT populate audioBlock — this model is silent (--sound must be off)."}
- suggestedAspectRatio + suggestedDuration MUST be identical across all ${count} shots.`);
  } else if (isMotionControl) {
    blocks.push(`▸ MOTION CONTROL VARIANT (Omni Video + reference clip)
- mainPrompt MUST describe the camera path as 3 explicit waypoints: START → MIDPOINT → END (e.g. "Camera begins at low-angle wide → arcs right to eye-level medium → settles into close-up over-shoulder").
- For every visible subject/element, explicitly tag it as [LOCKED] (stays static) or [MOVING] (animated). Example: "the woman [MOVING], the chandelier [LOCKED], the curtains [MOVING]".
- Reference the source motion clip in mainPrompt as \`<<<video_1>>>\` (Omni placeholder). Example: "match the camera motion of <<<video_1>>>".
- cameraSuggestions MUST list the 3 waypoints as a bulleted path.
- modelNotes: "In Kling, use Omni Video with --video <clip> --video_refer_type feature. Add image refs as <<<image_1>>>, <<<image_2>>> if you provided more than one."`);
  } else if (route === "omni-video-edit") {
    blocks.push(`▸ OMNI EDIT VARIANT (--video_refer_type base)
- mainPrompt MUST describe ONLY the desired transformation/change to <<<video_1>>>. Do NOT re-describe the full scene.
- Start with the change verb: "Transform...", "Replace...", "Add...", "Remove...", "Change the...".
- Keep mainPrompt under 80 words — edit prompts should be surgical.
- referenceGuidance: explain which parts of <<<video_1>>> are PRESERVED vs MODIFIED.
- DO NOT define a first/end frame in edit mode — that combination is rejected by Kling.
- DO NOT mention audio (sound MUST be off when --video is present).
- Skip [camera:*] tags unless the edit explicitly involves a camera-motion change.`);
  } else if (route === "omni-video") {
    blocks.push(`▸ OMNI VIDEO VARIANT (${canonical})
- Use placeholders inside mainPrompt for any media you want Kling to bind to: \`<<<image_1>>>\`, \`<<<image_2>>>\`, \`<<<element_1>>>\`, \`<<<video_1>>>\`. Number them in the order the user uploaded.
- Frame control: only use first_frame / end_frame language when the user explicitly asks for it. Do NOT volunteer it.
- Image-count limits to respect when phrasing references:
  • With a reference video: image_count + element_count ≤ 4
  • Without a reference video: ≤ 7
  • For \`kling-video-o1\` with image_count > 2: NEVER reference an end_frame
- ${soundAllowed ? "Audio is supported — only describe sound if the user asked for it." : "This model is SILENT — never describe dialogue/SFX/ambience."}
- Apply standard Kling rules: 80–180 words, exactly ONE [camera:*] tag, action-verb opening.`);
  } else {
    blocks.push(`▸ BASIC ${route === "basic-t2v" ? "T2V" : "I2V"} VARIANT (${canonical})
- Basic route — do NOT use \`<<<image_n>>>\` / \`<<<element_n>>>\` / \`<<<video_1>>>\` placeholders (those are Omni-only).
- Apply default Kling rules: 80–180 words, exactly ONE [camera:*] tag, action-verb opening.
- ${soundAllowed ? "If --sound is supported, only mention audio when the user asks." : "Do NOT mention audio — this basic model is silent."}`);
  }

  // O1 family enhancement layered on top of route block.
  if (isO1) {
    blocks.push(`▸ O1 FAMILY ENHANCEMENT
- O1 has stronger prompt adherence and better text rendering — you may extend mainPrompt up to 220 words for richer scenes.
- O1 handles complex multi-subject choreography better — describe 2–3 simultaneous actions if the source supports it.
- modelNotes MUST mention: "Kling Video O1 — Omni-only, silent (no --sound). With more than 2 input images, do not request an end_frame."`);
  }

  // Always append the canonical model + Skill mapping so the LLM bakes it into modelNotes.
  blocks.push(`▸ KLING SKILL MAPPING (must appear in modelNotes)
- Canonical model: \`${canonical}\`
- Route: \`${route}\`
- ${modelNote}
- The Kling Skill rejects aliases — when telling the user which Kling model to pick, write the canonical name exactly: \`${canonical}\`.`);

  return blocks.join("\n\n");
}

export const klingAgent: ExpertAgent = {
  id: "kling-director",
  displayName: "Kling Specialist",
  matches: (model) => model.startsWith("kling"),

  docSummary: `KLING AI SKILL v1.1.0 — DISTILLED MODEL DOCUMENTATION:

Canonical models (the ONLY values Kling accepts as --model):
- kling-v2-6        → Basic T2V / I2V only. Not Omni-capable. Silent.
- kling-v3          → Default for basic T2V / I2V and basic image generation. Supports --sound.
- kling-v3-omni     → Default for Omni video AND Omni image. Supports --sound (must be off when --video is attached).
- kling-video-o1    → Omni video only. NEVER produces audio. With >2 input images, no end_frame.
- kling-image-o1    → Omni image only.
Aliases like "o3", "omni3", "视频O3", "图片O3" all map to kling-v3-omni but MUST NOT be passed as --model.

Routes:
- Basic T2V        : --prompt only (no --image)                        → kling-v2-6 / kling-v3
- Basic I2V        : single --image (optional --image_tail)             → kling-v2-6 / kling-v3
- Omni video       : any of {comma in --image, --image+--aspect_ratio, --element_ids, --video, explicit kling-v3-omni / kling-video-o1}
- Omni video EDIT  : --video + --video_refer_type base   (sound MUST be off, no first/end frame)
- Omni video REF   : --video + --video_refer_type feature
- Basic image      : --prompt (--image optional for i2i, --negative_prompt allowed)
- Omni image       : --resolution 4k OR --aspect_ratio auto OR --result_type series OR --element_ids OR comma in --image OR explicit Omni model

Multi-shot (storyboard) — works for T2V, I2V and Omni-video alike:
- --multi_shot --shot_type customize --multi_prompt '[{"index":1,"prompt":"...","duration":"5"}, ...]'  (1–6 shots, durations sum to --duration which is 3–15s)
- --multi_shot --shot_type intelligence --prompt "<one paragraph story brief>"  (Kling chooses beats)
- Cannot combine with --image_tail.

Prompt placeholder syntax (Omni only):
- <<<image_1>>>, <<<image_2>>>, …  → ordered uploaded images (--image)
- <<<element_1>>>, <<<element_2>>>, …  → reusable subjects (--element_ids)
- <<<video_1>>>  → reference clip (--video, video subcommand only)

Hard constraints to surface in modelNotes / prompt text:
- Sound: kling-video-o1 = always silent. With --video on Omni video, --sound must be off.
- Reference video: max 1 video URL; image_count + element_count ≤ 4 when --video is set, ≤ 7 otherwise.
- First+last frame with kling-video-o1: subjects unsupported.
- Frame generation cannot combine with --video_refer_type base.
- Image series (--result_type series) is image-only and i2i-only (requires --image).

Camera vocabulary (bracketed, snake_case, ONE primary tag per shot):
[camera:pan_left|pan_right|dolly_in|dolly_out|crane_up|crane_down|zoom_in|zoom_out|tilt_up|tilt_down|tracking_left|tracking_right|orbit_left|orbit_right]`,

  systemAddendum: `═══ TARGET MODEL: KLING (Kling AI Skill v1.1.0) ═══
- mainPrompt: 80–180 words / max 2,000 characters (O1 may extend to 220 words but still ≤2,000 chars; Omni-EDIT must stay ≤1,200 chars). START with subject + action verb in present tense. Never exceed the cap — Kling's UI rejects very long prompts.
- Embed exactly ONE primary [camera:*] tag inline, snake_case (pan_left, dolly_in, crane_up, …).
- Be explicit about motion speed: "gradually", "sudden", "continuous", "slow-burn".
- Audio rules:
  • Default: do NOT mention audio.
  • Only mention dialogue / SFX / ambience if the user explicitly enabled audio AND the model supports it (kling-v3 / kling-v3-omni without --video).
  • kling-video-o1 and any Omni mode with --video MUST stay silent.
- Omni placeholder rule: in Omni routes, ALWAYS reference uploaded media via \`<<<image_n>>>\`, \`<<<element_n>>>\`, \`<<<video_1>>>\` placeholders inside mainPrompt. In basic routes, NEVER use those placeholders.
- Frame control language (first_frame / end_frame) is only allowed when the user explicitly asked for it.
- For Omni edit (--video_refer_type base): mainPrompt describes ONLY the transformation; never redescribe the source clip; never define a first/end frame; sound is off.
- For Motion Control (Omni video + reference clip): describe camera path as 3 waypoints in cameraSuggestions and tag every subject as [LOCKED] vs [MOVING].
- For multi-shot: output 1–6 shots, mirror the customize JSON shape, per-shot durations sum to the total --duration.
- negativePrompt MUST add: "static camera when movement requested, frozen expression, puppet-like motion, abrupt camera cuts".
- Populate cameraTags with the comma-separated bracketed tags used.
- Populate referenceGuidance with how each uploaded asset (image / element / video) is being used, using its placeholder name.
- modelNotes MUST surface: (a) the canonical Kling model name (e.g. \`kling-v3-omni\`), (b) the Kling Skill route + the key flags the user should set (e.g. \`--video_refer_type feature\`, \`--multi_shot --shot_type customize\`), (c) any sound / frame / image-count constraint that applies. NEVER use alias names like "o3" or "omni3" in modelNotes.
- Do NOT populate shotStructure — leave empty.`,

  examples: `KLING EXAMPLE A — Basic I2V on kling-v3 (single moody portrait, warm light):
mainPrompt: "A woman in a velvet armchair slowly turns her head from the rain-streaked window toward camera, a faint melancholic smile forming as warm tungsten light catches her cheekbones. [camera:dolly_in] gradually tightens from medium to medium close-up. The curtain beside her sways gently in a draft. Rain droplets on the glass behind her dissolve into soft bokeh."
negativePrompt: "morphing, distortion, blurry, watermark, text overlay, frame jumping, flickering, jittering, extra fingers, deformed hands, duplicate subjects, static camera when movement requested, frozen expression, puppet-like motion, abrupt camera cuts"
cameraSuggestions: "Slow [camera:dolly_in], 85mm equivalent, shallow DOF. Hold final frame for 1s of micro-expression."
cameraTags: "[camera:dolly_in]"
referenceGuidance: "Uploaded image is the start frame. Preserve subject identity, clothing texture, and tungsten color cast throughout the clip."
modelNotes: "Canonical Kling model: kling-v3 (basic I2V). In the Kling Skill: \`video --model kling-v3 --image <file> --prompt \"...\" --duration 5 --aspect_ratio 16:9 --sound off\`. Single-image basic route — do NOT use <<<image_n>>> placeholders."
suggestedAspectRatio: "16:9"
suggestedDuration: "5s"

KLING EXAMPLE B — Omni Video on kling-v3-omni (two refs + one element):
mainPrompt: "<<<element_1>>> walks slowly down the corridor of <<<image_1>>>, the morning haze of <<<image_2>>> spilling through the tall arched windows behind her. [camera:tracking_right] follows at hip height as she trails her fingers across a dust-covered banister, breath visible in the cold air. The chandeliers above remain still while motes of dust drift in the slanted shafts of light."
negativePrompt: "morphing, distortion, blurry, watermark, text overlay, frame jumping, flickering, jittering, extra fingers, deformed hands, duplicate subjects, static camera when movement requested, frozen expression, puppet-like motion, abrupt camera cuts"
cameraSuggestions: "Steady [camera:tracking_right] at ~0.5 m/s, 35mm equivalent, deep focus to keep both <<<image_1>>> architecture and <<<element_1>>> subject sharp."
cameraTags: "[camera:tracking_right]"
referenceGuidance: "<<<image_1>>> = location plate (corridor). <<<image_2>>> = lighting/atmosphere reference (morning haze, color temp). <<<element_1>>> = locked subject identity (face/wardrobe/hair). Image_count(2) + element_count(1) = 3 ≤ 7 (no --video), constraint satisfied."
modelNotes: "Canonical Kling model: kling-v3-omni (Omni video). In the Kling Skill: \`video --model kling-v3-omni --image plate.jpg,haze.jpg --element_ids 12345 --prompt \"...\" --aspect_ratio auto --sound on\`. Omni placeholders required."
suggestedAspectRatio: "auto"
suggestedDuration: "6s"

KLING EXAMPLE C — Omni Video EDIT on kling-v3-omni (--video_refer_type base):
mainPrompt: "Replace the daytime sky in <<<video_1>>> with a deep dusk gradient — burnt orange near the horizon fading to indigo overhead — and warm the overall color grade by ~400K. Keep all subject motion, framing and lens behavior unchanged."
negativePrompt: "morphing, distortion, blurry, watermark, text overlay, frame jumping, flickering, jittering, extra fingers, deformed hands, duplicate subjects, static camera when movement requested, frozen expression, puppet-like motion, abrupt camera cuts"
cameraSuggestions: ""
cameraTags: ""
referenceGuidance: "<<<video_1>>> = source clip in EDIT mode. PRESERVED: subject motion, camera path, framing, lens. MODIFIED: sky region + global color temperature."
modelNotes: "Canonical Kling model: kling-v3-omni (Omni video edit). In the Kling Skill: \`video --model kling-v3-omni --video <url> --video_refer_type base --prompt \"...\" --sound off\`. Sound MUST be off; do NOT define first/end frames in edit mode."
suggestedAspectRatio: "auto"
suggestedDuration: "matches source"`,
};
