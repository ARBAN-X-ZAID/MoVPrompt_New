export type SuggestionCategory =
  | "subject"
  | "action"
  | "mood"
  | "camera"
  | "lighting"
  | "style"
  | "location"
  | "time"
  | "color"
  | "pacing"
  | "audio_style"
  | "aspect_ratio";

export type Suggestion = {
  category: SuggestionCategory;
  example: string;
  chips: string[];
};

type CategoryDef = {
  category: SuggestionCategory;
  re: RegExp;
  example: string;
  chips: string[];
};

// Order = priority when multiple categories match (first wins for `category`/`example`).
const CATEGORIES: CategoryDef[] = [
  {
    category: "aspect_ratio",
    re: /(aspect ratio|aspect-ratio|\b16:9\b|\b9:16\b|\b1:1\b|\b4:5\b|\b21:9\b|landscape or (vertical|portrait)|vertical or (landscape|horizontal))/i,
    example: "e.g. 9:16 vertical",
    chips: ["16:9 landscape", "9:16 vertical", "1:1 square", "4:5 portrait", "21:9 cinematic"],
  },
  {
    category: "subject",
    re: /(subject|who['’]?s|who is|main character|protagonist|what is in|what['’]?s in|focus of)/i,
    example: "e.g. lone astronaut on a dune",
    chips: [
      "lone astronaut",
      "vintage car",
      "dancer mid-spin",
      "neon street crowd",
      "mountain peak",
      "child with a kite",
    ],
  },
  {
    category: "action",
    re: /(action|doing|happening|movement|motion|gesture)/i,
    example: "e.g. walking slowly through smoke",
    chips: [
      "walking slowly",
      "running",
      "spinning",
      "falling",
      "exploding outward",
      "embracing",
      "looking up",
    ],
  },
  {
    category: "mood",
    re: /(mood|feel(ing)?|tone|atmosphere|emotion|vibe|energy)/i,
    example: "e.g. melancholic and dreamy",
    chips: [
      "melancholic",
      "euphoric",
      "tense",
      "dreamy",
      "mysterious",
      "hopeful",
      "eerie",
      "romantic",
    ],
  },
  {
    category: "camera",
    re: /(camera|shot type|angle|lens|framing|composition|pov|point of view)/i,
    example: "e.g. slow dolly-in, low angle",
    chips: [
      "wide shot",
      "close-up",
      "low angle",
      "drone",
      "handheld",
      "tracking",
      "dolly zoom",
      "over-the-shoulder",
    ],
  },
  {
    category: "lighting",
    re: /(light(ing)?|illumination|shadows?)/i,
    example: "e.g. golden hour with long shadows",
    chips: [
      "golden hour",
      "neon",
      "soft daylight",
      "harsh shadows",
      "candlelit",
      "backlit",
      "moody low-key",
    ],
  },
  {
    category: "style",
    re: /(style|aesthetic|look|visual style|genre|treatment)/i,
    example: "e.g. cinematic 35mm film",
    chips: [
      "cinematic",
      "anime",
      "35mm film",
      "cyberpunk",
      "watercolor",
      "claymation",
      "documentary",
      "noir",
    ],
  },
  {
    category: "location",
    re: /(location|setting|where (does|is|will)|environment|place|backdrop|scene takes place)/i,
    example: "e.g. rain-soaked Tokyo alley",
    chips: [
      "tokyo alley",
      "desert",
      "rooftop",
      "forest",
      "underwater",
      "art deco room",
      "snowy mountain",
    ],
  },
  {
    category: "time",
    re: /(time of day|what time|when (does|is)|season|hour)/i,
    example: "e.g. dusk, late autumn",
    chips: ["dawn", "midday", "dusk", "night", "winter", "summer"],
  },
  {
    category: "color",
    re: /(colou?r|palette|tones?|hues?)/i,
    example: "e.g. teal & orange, warm highlights",
    chips: [
      "warm amber",
      "teal & orange",
      "monochrome",
      "pastel",
      "high-contrast b&w",
      "muted earth tones",
    ],
  },
  {
    category: "pacing",
    re: /(pace|pacing|speed|rhythm|tempo|how fast)/i,
    example: "e.g. slow motion with a sudden cut",
    chips: ["slow motion", "real time", "fast cuts", "gradual buildup", "freeze frame"],
  },
  {
    category: "audio_style",
    re: /(music|sound design|score|soundtrack|audio (style|feel|mood))/i,
    example: "e.g. ambient pad, soft swell",
    chips: [
      "ambient pad",
      "lo-fi beat",
      "orchestral swell",
      "no music",
      "sfx only",
      "synthwave",
    ],
  },
];

const MAX_CHIPS = 8;

export function detectSuggestion(text: string): Suggestion | null {
  if (!text) return null;
  const matched = CATEGORIES.filter((c) => c.re.test(text));
  if (matched.length === 0) return null;

  const primary = matched[0];
  const seen = new Set<string>();
  const chips: string[] = [];
  for (const m of matched) {
    for (const chip of m.chips) {
      const key = chip.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      chips.push(chip);
      if (chips.length >= MAX_CHIPS) break;
    }
    if (chips.length >= MAX_CHIPS) break;
  }

  return {
    category: primary.category,
    example: primary.example,
    chips,
  };
}

/** Parse a comma-separated answer into trimmed tokens. */
export function parseTokens(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Toggle a chip in/out of a comma-separated answer string. */
export function toggleChip(value: string, chip: string): string {
  const tokens = parseTokens(value);
  const idx = tokens.findIndex((t) => t.toLowerCase() === chip.toLowerCase());
  if (idx >= 0) {
    tokens.splice(idx, 1);
  } else {
    tokens.push(chip);
  }
  return tokens.join(", ");
}

export function isChipActive(value: string, chip: string): boolean {
  return parseTokens(value).some((t) => t.toLowerCase() === chip.toLowerCase());
}
