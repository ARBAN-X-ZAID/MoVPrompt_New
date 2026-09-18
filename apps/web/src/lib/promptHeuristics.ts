// Lightweight client-side heuristics that detect missing cinematic dimensions in a generated prompt.
// Used to surface inline "Add lens", "Add lighting", etc. fix chips that re-run the shot with a targeted addendum.

export type FixDimension = "lens" | "lighting" | "movement" | "action" | "mood";

export interface FixChip {
  dimension: FixDimension;
  label: string; // i18n key fragment, prefix "results.autofix."
  addendum: string; // appended to user's description on regenerate
}

const has = (text: string, re: RegExp) => re.test(text);

/**
 * Inspect a result's main prompt + camera section and return chips for any missing dimensions.
 * All chips return short, model-agnostic addenda; the generate edge function uses them as REFINEMENT GUIDANCE.
 */
export function detectMissingDimensions(args: {
  mainPrompt?: string;
  cameraSuggestions?: string;
  cameraTags?: string;
  shotStructure?: string;
}): FixChip[] {
  const all = [
    args.mainPrompt ?? "",
    args.cameraSuggestions ?? "",
    args.cameraTags ?? "",
    args.shotStructure ?? "",
  ]
    .join("\n")
    .toLowerCase();

  if (all.trim().length < 20) return [];

  const chips: FixChip[] = [];

  // Lens / focal length
  const hasLens = has(all, /\b(\d{1,3}\s*mm|anamorphic|wide[- ]angle|telephoto|macro|fisheye|prime lens|zoom lens|f\/?\d|stop)\b/);
  if (!hasLens) {
    chips.push({
      dimension: "lens",
      label: "lens",
      addendum:
        "Specify a concrete lens choice (e.g. 35mm anamorphic, 85mm prime, wide-angle 24mm) and a depth-of-field intent (shallow / deep). Avoid generic 'cinematic' wording.",
    });
  }

  // Lighting
  const hasLighting = has(all, /\b(key light|fill light|back ?light|rim light|practicals?|golden hour|blue hour|hard light|soft light|chiaroscuro|low[- ]key|high[- ]key|backlit|side[- ]lit|top[- ]lit|motivated light|neon|tungsten|daylight)\b/);
  if (!hasLighting) {
    chips.push({
      dimension: "lighting",
      label: "lighting",
      addendum:
        "Add explicit lighting design: key light direction and quality (hard / soft), fill ratio, practicals, and color temperature. Tie it to the mood.",
    });
  }

  // Camera movement
  const hasMovement = has(all, /\b(dolly|truck|track|crane|jib|pan|tilt|push[- ]?in|pull[- ]?out|orbit|arc|handheld|steadicam|gimbal|whip pan|crash zoom|locked off|static)\b/);
  if (!hasMovement) {
    chips.push({
      dimension: "movement",
      label: "movement",
      addendum:
        "Add a specific, named camera movement (e.g. slow dolly-in, lateral tracking shot, handheld follow, locked-off static) with pace and starting/ending framing.",
    });
  }

  // Subject action specificity
  const vagueAction = has(all, /\b(scene unfolds|something happens|movement occurs|dynamic shot|cinematic moment)\b/);
  const hasVerbs = has(all, /\b(walks|runs|turns|reaches|grabs|pours|opens|closes|leans|kneels|stands|sits|rises|falls|smokes|drinks|whispers|laughs|smiles|sighs|breathes|drives|enters|exits)\b/);
  if (vagueAction || !hasVerbs) {
    chips.push({
      dimension: "action",
      label: "action",
      addendum:
        "Replace any vague action with one concrete, observable verb beat for the subject (e.g. 'turns slowly toward camera', 'lifts the cup, exhales'). Avoid 'cinematic moment' or 'unfolds'.",
    });
  }

  // Mood / atmosphere specificity
  const hasMood = has(all, /\b(tense|melancholic|serene|joyful|ominous|dread|wistful|euphoric|claustrophobic|intimate|epic|nostalgic|hopeful|menacing)\b/);
  if (!hasMood) {
    chips.push({
      dimension: "mood",
      label: "mood",
      addendum:
        "Anchor the emotional tone with one specific mood word (tense, intimate, ominous, wistful) and tie one visual element — lighting, framing, or sound — to that emotion.",
    });
  }

  // Cap to top 3 most-impactful
  return chips.slice(0, 3);
}
