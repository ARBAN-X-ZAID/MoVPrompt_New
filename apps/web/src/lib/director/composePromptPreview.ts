// MUST stay in sync with supabase/functions/generate-reference-image/index.ts
// (prompt composition section: IDENTITY_LOCK / SCENE_LOCK / HERO_FRAME_SUFFIX /
// PANEL_POLISH_SUFFIX / buildStyleHeader / buildAspectClause / continuityClause /
// subjectClause). If you change one, change the other.
import type { StyleSpec } from "./api";

const IDENTITY_LOCK =
  "Same character as the attached reference image. Maintain exact face, hair, skin tone, age, body proportions, and outfit. Do not redesign the character.";

const SCENE_LOCK =
  "Same scene as the attached key frame. Maintain the exact location, lighting setup, color grade, lens, depth of field, camera height, and composition language. Keep subject, props, wardrobe, time of day, and background continuous. Only the action and framing change between frames.";

const HERO_FRAME_SUFFIX =
  " Single polished hero frame: cinematic composition, intentional depth of field, controlled lighting, clean negative space. No text, no captions, no watermark, no UI overlays.";

const PANEL_POLISH_SUFFIX =
  " Single polished storyboard frame. Cinematic composition with deliberate negative space, lens-correct geometry, controlled depth of field, motivated lighting with clear key/fill/rim separation, consistent film grain, finished color grade. Photographic finish — no draft sketch quality, no rough lines, no concept-art looseness. No text, no captions, no watermark, no UI overlay, no on-image labels, no shot numbers burned in.";

const CONTINUITY_CLAUSE =
  " Match the previous panel exactly: same character, wardrobe, hair, face, props, lens, focal length, lighting direction, color grade, film stock, contrast, atmospheric density, time of day, and weather. Only the action and framing change between frames.";

const SUBJECT_MULTI_REF_CLAUSE =
  " Match the subject (character or product) shown in the first attached reference sheet — keep face, wardrobe, hair, branding, and proportions exact.";

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

export type ComposePromptArgs = {
  mode: "character_sheet" | "storyboard_panels" | "single_panel";
  beat: string;
  shotIndex?: number;
  totalShots?: number;
  styleSpec?: StyleSpec;
  lockMode?: "character" | "scene" | "auto";
  referenceUrls?: string[];
  aspectRatio?: string;
  subjectKind?: "character" | "product";
  isChain?: boolean; // storyboard sequence (not single-panel regen)
};

export function composePromptPreview(a: ComposePromptArgs): string {
  const aspect = a.aspectRatio || "16:9";
  const refs = (a.referenceUrls ?? []).filter(Boolean);
  const hasReference = refs.length > 0;
  const lockMode = a.lockMode || "auto";
  const effectiveLock: "character" | "scene" | "none" = !hasReference
    ? "none"
    : lockMode === "scene"
      ? "scene"
      : "character";
  const lockPhrase =
    effectiveLock === "character" ? IDENTITY_LOCK : effectiveLock === "scene" ? SCENE_LOCK : "";
  const lockPrefix = lockPhrase ? `${lockPhrase} ` : "";

  const styleHeader = buildStyleHeader(a.styleSpec);
  const aspectClause = buildAspectClause(aspect);

  if (a.mode === "storyboard_panels") {
    const total = a.totalShots ?? 9;
    const shotNum = a.shotIndex ?? 1;
    const continuityClause = a.isChain ? CONTINUITY_CLAUSE : "";
    const subjectClause = refs.length >= 2 ? SUBJECT_MULTI_REF_CLAUSE : "";
    return `${styleHeader}${lockPrefix}Shot ${shotNum} of ${total}: ${a.beat}${continuityClause}${subjectClause}${aspectClause}${PANEL_POLISH_SUFFIX}`;
  }

  if (a.mode === "character_sheet") {
    const subjectKind = a.subjectKind === "product" ? "product" : "character";
    const sheetLock = hasReference
      ? subjectKind === "product"
        ? "Use the attached reference image as the canonical product. Every view on this sheet (closeup + 4 angles) must show the EXACT same object — same shape, materials, colors, branding, proportions, logos, and details as the reference. Do not redesign the product; only re-angle the same item. "
        : "Use the attached reference image as the canonical identity. Every view on this sheet (closeup + 4 angles) must show the EXACT same person — same face, hair, skin tone, age, eye color, facial features, and body proportions as the reference. Do not redesign the character; only re-pose and re-angle the same person. If the description below does not specify wardrobe, keep the outfit from the reference. "
      : "";
    return subjectKind === "product"
      ? `${styleHeader}${sheetLock}Product / object reference sheet, single image, split composition. Left half: a large, left-aligned detailed closeup of the item showing material, texture, and craftsmanship. Right half: a multi-angle view of the same item showing four angles in this order — front, right side, left side, and back (or top if the item is rotationally symmetrical). All views on a seamless pure white background, even soft studio lighting, no hands, no people, no props, no shadows beneath the item. Absolutely no text, no labels, no captions, no annotations, no measurements, no watermarks, no logos overlay, no borders, no soft gradients, no color swatches. Photorealistic. ${a.beat}`
      : `${styleHeader}${sheetLock}Character reference sheet, single image, split composition. Left half: a large, left-aligned closeup portrait of the character (head and shoulders, outfit visible at the top, neutral expression, looking at camera). Right half: a full-body multi-angle view of the same character showing four poses in this order — front view, right side profile, left side profile, and back view. Consistent identity, wardrobe, hair, and proportions across every view. All views on a seamless pure white background, even soft studio lighting, no harsh shadows under the feet, no extra props beyond what the character wears. Absolutely no text, no labels, no captions, no annotations, no watermarks, no borders, no soft gradients, no color swatches. Photorealistic. ${a.beat}`;
  }

  // single_panel
  const suffix = !hasReference ? HERO_FRAME_SUFFIX : "";
  return `${styleHeader}${lockPrefix}${a.beat}${suffix}${aspectClause}`;
}

export function referenceRole(
  index: number,
  total: number,
  mode: "character_sheet" | "storyboard_panels" | "single_panel",
): string {
  if (mode === "storyboard_panels") {
    if (total >= 2 && index === 0) return "subject sheet";
    if (index === 0) return "scene anchor";
    if (index === 1 && total >= 2) return "scene anchor";
    return "extra";
  }
  if (index === 0) return "sticky";
  if (index === 1) return "scene anchor";
  return "extra";
}
