// Single source of truth for per-model mainPrompt character caps.
// Mirrored on the server (generate-prompt edge function) so trimming and the UI
// counter agree. Values reflect documented input limits at the time of writing.

export const MODEL_CHAR_LIMITS: Record<string, number> = {
  // Seedance / ByteDance — official ~6,000 char API cap. We hold a safety margin.
  "seedance-2.0-fast": 1800,
  "seedance-2.0": 1800,
  "seedance-1.5-pro": 1800,
  "seedance-pro": 1800,
  "seedance-pro-fast": 1800,

  // Hailuo / Minimax — recommended <2,000 chars; 1,800 is a safe paste target.
  "hailuo-2.3-fast": 1800,
  "hailuo-2.3": 1800,
  "hailuo-02-fast": 1800,
  "hailuo-02": 1800,

  // OpenAI Sora — keep prose tight; ~950 chars is the safe paste range.
  "sora-2": 950,
  "sora-2-pro": 950,
  "sora-2-max": 950,
  "sora-2-pro-max": 950,

  // Higgsfield — single-motion prompts; very short cap.
  "higgsfield-lite": 500,
  "higgsfield-standard": 500,
  "higgsfield-turbo": 500,

  // Google Veo — comfortably handles 1,500 chars.
  "veo-3.1-lite": 1500,
  "veo-3.1-fast": 1500,
  "veo-3.1": 1500,
  "veo-3-fast": 1500,
  "veo-3": 1500,

  // Kling — UI accepts up to ~2,500 chars; we keep margin.
  "kling-3.0": 2000,
  "kling-3.0-pro": 2000,
  "kling-3.0-standard": 2000,
  "kling-3.0-4k": 2000,
  "kling-3.0-omni": 2000,
  "kling-3.0-omni-edit": 1200, // edit prompts must stay surgical
  "kling-2.6": 2000,
  "kling-2.5-turbo": 1500,
  "kling-2.1-master": 1500,
  "kling-2-master": 1500,
  "kling-1.6-pro": 1500,
  "kling-1.6-standard": 1500,
  "kling-o1-video": 2000,
  "kling-o1-video-edit": 1200,
  "kling-motion-control": 2000,
  "kling-3.0-motion-control": 2000,

  // Wan / Grok / Any — generic safe target.
  "wan-2.7": 1500,
  "wan-2.6": 1500,
  "wan-2.5": 1500,
  "wan-2.5-fast": 1500,
  "wan-2.2": 1500,
  "wan-2.2-fast": 1500,
  "grok-imagine": 1200,
  "grok-imagine-edit": 1200,
  "any": 1500,
};

export function getCharLimit(model: string): number | undefined {
  return MODEL_CHAR_LIMITS[model];
}
