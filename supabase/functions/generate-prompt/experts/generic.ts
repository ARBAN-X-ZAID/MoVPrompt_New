// Generic fallback agent — used for any target model not covered by a specialist.
// Preserves the original universal MovPrompt behaviour so existing models keep working.

import type { ExpertAgent } from "./registry.ts";

export const genericAgent: ExpertAgent = {
  id: "generic-director",
  displayName: "Universal Director",
  matches: () => true, // last-resort fallback

  docSummary: `UNIVERSAL MODEL GUIDANCE:
This agent serves all video generators not covered by a dedicated specialist (Hailuo/Minimax, Sora, Higgsfield, Wan, Grok, and "any model").
Goal: produce a model-agnostic cinematic prompt using clear universally-understood cinematography language.`,

  systemAddendum: `═══ TARGET MODEL: GENERIC / OTHER ═══
- mainPrompt: 150–230 words / max 1,500 characters of well-rounded cinematic prose. Clear scene description, motivated camera, lighting, mood. NEVER exceed the per-family character cap below — these are real provider input limits.
- Apply the per-family hints below ONLY if the target model matches:
  • HAILUO/MINIMAX: 150–250 words / MAX 1,800 chars. Lead with environment, then subject. Continuous flow language.
  • SORA: 80–160 words / MAX 950 chars. Natural prose paragraph. Emphasize physical plausibility, gravity, momentum, cause-and-effect motion. Sora's input window is short — be concise.
  • HIGGSFIELD: 50–90 words / MAX 500 chars. Single clear motion or transformation. One idea only.
  • WAN: 120–220 words / MAX 1,500 chars. Emphasize light interaction with materials, atmospheric depth, volumetric layering.
  • GROK: 100–180 words / MAX 1,200 chars. Lean into stylized, creative, surreal-friendly description.
- Leave audioBlock, cameraTags, referenceGuidance, shotStructure EMPTY unless the target model clearly benefits — keep output focused on the four core fields.
- negativePrompt MUST include the universal negatives.

═══ MODEL RECOMMENDATION PROTOCOL (Any Model / Universal mode only) ═══
When the user chose "Any Model", you MUST also recommend the single best specialist model for this exact scene. Populate \`recommendedModel\` and \`recommendedModelReason\` on the FIRST shot in results.

Decision rubric — pick the FIRST rule that matches, top to bottom:
  1. Needs synced dialogue / lip-sync / native audio → "veo-3.1" (use "veo-3.1-fast" if scene is ≤5s and simple)
  2. User wants a stitched multi-cut narrative sequence → "seedance-pro" (or "seedance-pro-fast" for quick iteration)
  3. Scene uses multiple numbered element/product/character references (@Element tags) → "seedance-2.0" (or "seedance-2.0-fast")
  4. Precise author-controlled camera path with waypoints (dolly/crane choreography) → "kling-3.0-motion-control"
  5. Editing / modifying an existing frame (outfit, object, lighting swap) → "kling-3.0-omni-edit"
  6. Multi-subject complex interaction, group staging → "kling-3.0-omni" (use "kling-o1-video" for longer narrative arcs)
  7. Hero cinematic single shot, dramatic realism, character-driven → "kling-3.0"
  8. Fast preview / iteration with minimal cost → "kling-2.5-turbo"
  9. Default fallback for a standard single cinematic clip → "kling-3.0"

\`recommendedModelReason\` — ONE sentence, ≤25 words, in the user's language, tying the pick to a concrete scene attribute (e.g., "Dialogue-driven portrait needs Veo's native synced audio for lip-accurate delivery."). Never invent model names; only use values from the enum.`,

  examples: `GENERIC EXAMPLE (single frame, moody portrait):
mainPrompt: "A young woman sits in a velvet armchair beside a rain-streaked window, warm tungsten lamplight painting amber highlights across her cheekbones while cool blue ambient light from the overcast sky fills the shadows. She slowly turns her gaze from the window toward camera, a faint melancholic smile forming. Shallow depth of field — the rain droplets on glass behind her dissolve into soft bokeh circles. A slow dolly-in from medium shot to medium close-up, 85mm lens, f/1.8. The curtain beside her sways gently in a draft."
negativePrompt: "morphing, distortion, blurry, watermark, text overlay, frame jumping, flickering, jittering, extra fingers, deformed hands, duplicate subjects, static expression, puppet-like motion"
cameraSuggestions: "Slow dolly in (medium to MCU), 85mm f/1.8, shallow DOF. Optional rack focus from window rain to subject's eyes mid-clip."
modelNotes: "Universal cinematic prompt — works across most modern video generators."
suggestedAspectRatio: "16:9"
suggestedDuration: "5s"`,
};
