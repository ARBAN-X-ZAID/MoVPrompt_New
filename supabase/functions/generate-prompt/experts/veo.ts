// Veo specialist agent — handles Veo 3 and Veo 3.1 variants.
// Veo is Google's flagship — strong on temporal consistency, audio, and structured cinematography.

import type { ExpertAgent } from "./registry.ts";

export const veoAgent: ExpertAgent = {
  id: "veo-director",
  displayName: "Veo Specialist",
  matches: (model) => model.startsWith("veo"),

  docSummary: `VEO MODEL DOCUMENTATION (distilled):
- Veo is by Google DeepMind. Variants: 3, 3 Fast, 3.1, 3.1 Fast, 3.1 Lite.
- Best at: photoreal cinematography, sustained temporal consistency, real-world physics, named-director style references.
- Reference inputs: image (start frame), optional end frame, optional reference image for character/style.
- Audio: Veo 3 and 3.1 generate native synchronized audio — dialogue (lip-synced), SFX, ambient. ALWAYS provide an audioBlock for Veo.
- Optimal length: 150–250 words for 3.1 / 3, 100–150 for Fast/Lite.
- Preferred structure: SCENE → ACTION → CAMERA → LIGHTING (in that order, as flowing prose, not bullets).
- Lens precision: Veo respects "35mm anamorphic", "85mm f/1.4", "wide 24mm" — use real focal lengths.
- Style references: Veo recognizes named cinematographer/director styles ("Deakins natural light", "Kubrick one-point perspective", "Malick magic hour", "Lubezki long take").
- 3.1 specifically: emphasize sustained motion across the full clip — describe what continues, not what cuts.`,

  systemAddendum: `═══ TARGET MODEL: VEO (all variants) ═══
- mainPrompt: 150–230 words / max 1,500 characters (100–150 words for Fast/Lite). Structure as flowing prose in order: SCENE → ACTION → CAMERA → LIGHTING. NEVER exceed 1,500 characters — Veo's prompt window is generous but pastes get truncated above this.
- Reference real focal lengths and, when fitting, named director/DP styles.
- ALWAYS populate audioBlock with three sub-lines: DIALOGUE (lip-synced lines in quotes, or "(none)"), SFX (specific diegetic sounds with rough timing), AMBIENT (background sound bed). Veo generates native audio — this is critical.
- Populate referenceGuidance explaining how the uploaded image anchors the start frame, character likeness, and lighting setup.
- For 3.1 variants: in modelNotes, emphasize sustained-motion guidance — what should continue uninterrupted across the full clip.
- For Fast/Lite: in modelNotes, note that the prompt was kept compact for these variants.
- negativePrompt MUST add: "temporal artifacts, scene drift, sudden lighting change, lip-sync mismatch, audio-video desync".
- Do NOT populate cameraTags or shotStructure — leave empty.`,

  examples: `VEO 3.1 EXAMPLE (single frame, café window at dusk):
mainPrompt: "Inside a small Parisian café at blue hour, a woman in a charcoal wool coat sits alone at a marble bistro table, fingers tracing the rim of an espresso cup. Through the rain-beaded window, neon signs from across the street bleed soft magenta and cyan into the room. She lifts the cup, takes a slow sip, and her eyes drift to the door as a bell chimes. The camera holds on a static medium shot, 50mm at f/2.0, then begins an almost imperceptible push-in — a Deakins-style natural-light approach with practical sources only. Warm tungsten from a brass sconce above her right shoulder is the key; the cool window glow fills shadows. Steam curls upward from the cup, catching the rim light. Sustained, continuous take — no cuts, no lighting shifts."
negativePrompt: "morphing, distortion, blurry, watermark, text overlay, frame jumping, flickering, jittering, extra fingers, deformed hands, duplicate subjects, temporal artifacts, scene drift, sudden lighting change, lip-sync mismatch, audio-video desync"
cameraSuggestions: "Static medium shot transitioning to slow push-in, 50mm f/2.0, shallow DOF. Continuous take, no cuts."
audioBlock: "DIALOGUE: (none — character is silent throughout)\nSFX: porcelain cup contact with marble at 1.2s; door bell chime at 6.5s; soft fabric rustle as she shifts at 2.0s\nAMBIENT: distant rain on the window; muted street traffic; faint espresso machine hiss in the background; low room tone with subtle wood-creak"
referenceGuidance: "Uploaded image anchors the start frame. Preserve subject likeness, coat texture, café layout, and the magenta/cyan neon color cast through the window."
modelNotes: "Veo 3.1: emphasize sustained motion — the push-in and steam curl must run continuously across the full duration without temporal drift. For Fast/Lite, this prompt was kept under 250 words; trim further if quality regresses."
suggestedAspectRatio: "16:9"
suggestedDuration: "10s"`,
};
