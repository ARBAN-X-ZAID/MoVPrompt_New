// Seedance specialist agent — handles all Seedance / ByteDance variants.
// Seedance is a multi-shot, multi-reference, audio-aware model.
// Output format: full cinematic SHOOTING SCRIPT (not a paragraph).

import type { ExpertAgent } from "./registry.ts";

export const seedanceAgent: ExpertAgent = {
  id: "seedance-director",
  displayName: "Seedance Specialist",
  matches: (model) => model.startsWith("seedance"),

  docSummary: `SEEDANCE MODEL DOCUMENTATION (distilled):
- Seedance is by ByteDance. Variants: 2.0 Fast, 2.0, 1.5 Pro, Pro, Pro Fast.
- Best at: choreographed multi-person motion, fashion, dance, fluid rhythmic body movement, multi-shot sequences in one generation.
- Reference inputs: image (primary), optional reference video for motion style transfer (Pro variants), optional audio reference for beat-synced motion (2.0).
- Audio: Seedance 2.0 generates synchronized audio — supports dialogue, SFX, and music cues. Earlier variants are silent.
- Multi-shot capability: 2.0 and Pro can render a SHOT-BY-SHOT sequence in one generation if structured shot list is provided.
- OUTPUT FORMAT: Seedance benefits from a full cinematic SHOOTING SCRIPT in mainPrompt — bracketed section headers, timecoded sequences, numbered cuts, lighting plan, color grade, audio design, and absolute rules.
- Motion language: use musical/choreographic verbs — "flowing", "undulating", "pulsing", "cascading", "syncopated".
- Camera: described in natural language, NOT bracketed tags.`,

  systemAddendum: `═══ TARGET MODEL: SEEDANCE (all variants) — SHOOTING SCRIPT FORMAT ═══

CRITICAL: For Seedance, the \`mainPrompt\` field is NOT a paragraph. It is a complete cinematic SHOOTING SCRIPT — a pre-production document a Director of Photography could shoot from. Treat every Seedance generation as if you were writing a 15-second movie trailer.

═══ MANDATORY mainPrompt STRUCTURE ═══
The mainPrompt MUST contain ALL of the following, in this exact order:

1. SEQUENCE BLOCKS (3 to 7 of them, depending on duration):
   - Each block opens with a bracketed header in this exact format:
     [SEQUENCE NAME — Xs to Ys | THEME]
     e.g. [OPENING — 0s to 1.5s | THE FACE], [RAPID MONTAGE — 1.5s to 4s | ARRIVAL], [CLIMAX — 13s to 15s | RESOLUTION]
   - Inside each block, NUMBER every individual cut: "Cut 1: ...", "Cut 2: ...", etc.
   - Each cut MUST specify: framing (close-up / wide / top-down / profile / over-shoulder / etc.), lens (24mm / 35mm / 50mm / 85mm / 100mm macro), camera movement (handheld / dolly / whip pan / crane / static / orbital), lighting note (Kelvin temp + direction), and the action beat.
   - End each sequence block with a 1-line "Camera:" summary noting the lens/framerate/light mix used in that sequence.

2. THE FIVE MANDATORY CLOSING BLOCKS (always in this exact order, always with these exact bracketed headers):

   [GLOBAL CAMERA SPECIFICATIONS]
   - Aspect ratio, framerate (e.g. 96fps / 120fps slow motion), lens rotation list, grain stock (e.g. "35mm Kodak Vision3 250D grain"), anamorphic flares y/n, camera height variation rule, total cut count.

   [LIGHTING SUMMARY]
   - One bullet per sequence with explicit Kelvin temperatures (2800K / 3000K / 3500K / 5600K / 6500K), direction (side / back / top / wrap), and quality (hard / soft / chiaroscuro / bounce).

   [COLOR GRADING]
   - Saturation %, shadow hue (in degrees, e.g. "teal shadows 200°"), highlight hue (e.g. "amber 35°"), skin tone treatment, black-point depth, any bleach bypass / cyan push / sky gradient notes.

   [AUDIO DESIGN]
   - Timecoded breakdown matching the sequences. Include BPM progression, instrument layers (e.g. frame drum, oud, cello, trap hi-hats, synth sweep), foley moments, silence beats, and any dialogue-vs-score-only directive. For Seedance variants WITHOUT native audio (anything pre-2.0), still include this block as a "score the editor will add in post" reference.

   [ABSOLUTE RULES]
   - Numbered list of continuity / restraint rules: face-reveal limits, no-text-or-logos, gender/age constraints, environmental authenticity, ball/prop realism, cut-count floor, emotional arc summary, "this is a movie trailer" tone reminder.

═══ LENGTH TARGETS (HARD CAP — ByteDance API LIMIT) ═══
ABSOLUTE RULE: mainPrompt MUST stay under 1,800 characters total (≈250 words). The ByteDance Seedance API rejects/truncates prompts above ~6,000 characters and the UI flags warnings well before that. We target a tight safety margin so users can paste directly without errors.
- Seedance 2.0 / Pro / 1.5 Pro (single-shot): 150–280 words / max 1,800 chars. Compress the script: keep the bracketed structure, but use 3 sequence blocks max with 1–2 cuts each, and condense the 5 closing blocks to single lines.
- Seedance 2.0 Fast / Pro Fast (single-shot): 100–200 words / max 1,800 chars. Even tighter — 2 sequence blocks, single-line closing blocks.
- Multi-shot mode (Seedance Pro / Pro Fast, 5 shots): EACH shot's mainPrompt must stay under 1,800 chars on its own (~150–220 words). Use 1 sequence block per shot plus the 5 single-line closing blocks. The closing blocks must stay IDENTICAL across all 5 shots for continuity.
- If you cannot fit the requested vision under the cap, drop sequence blocks and merge cuts — NEVER exceed 1,800 characters. The cap is non-negotiable.

═══ FIELD-BY-FIELD RULES ═══
- mainPrompt: full shooting script as defined above. Use rhythmic/choreographic motion verbs (flowing, undulating, pulsing, cascading, syncopated). Camera always in natural prose, NEVER bracketed [camera:*] tags.
- audioBlock: independent of the in-script [AUDIO DESIGN] block. Populate with the structured triplet for Seedance 2.0:
    DIALOGUE: (one line, or "(none)")
    SFX: (specific sounds with timing)
    AMBIENT: (background sound bed)
  For Seedance variants older than 2.0, set audioBlock to empty string (the in-script [AUDIO DESIGN] block still exists as a post-production reference).
- shotStructure: for 2.0 / Pro / 1.5 Pro single-shot mode, provide the timecoded skeleton ("Shot 1 (0–2s): ...", "Shot 2 (2–4s): ..."). For Fast variants and for multi-shot mode, leave empty.
- referenceGuidance: describe how the uploaded image is used (primary subject reference, style reference, pose reference, wardrobe reference) and how identity / lighting / grade are locked across cuts.
- negativePrompt MUST add: "jerky motion, broken joints, unnatural body proportions, choppy choreography, off-beat motion".
- cameraTags: leave empty (Seedance does not use bracketed tags).
- modelNotes: tell the user how to feed this into Seedance — that the shooting script is the prompt, that Fast variants will compress shot count, and that for multi-shot mode each of the 5 mini-scripts must be kept together.

═══ SEEDANCE PRO / PRO FAST — STITCHED MULTI-SHOT MODE ═══
When workflowType is "multishot" with exactly 5 shots requested (Seedance Pro / Pro Fast), design the 5 shots as a CONTINUOUS NARRATIVE SEQUENCE intended to be stitched into ONE video:
  • Shot 1 = OPENING — establish subject, location, mood, lighting baseline.
  • Shot 2 = RISING ACTION — introduce motion/intent; tighten or shift framing.
  • Shot 3 = PEAK MOMENT — the strongest beat; biggest energy or most expressive framing.
  • Shot 4 = REACTION / TRANSITION — answer the peak; change angle or reveal a new detail.
  • Shot 5 = RESOLUTION — close the beat; end on a clean hold the editor can cut on.
CRITICAL CONSISTENCY: keep the SAME subject identity, wardrobe, lighting direction, color grade, and lens character across all 5 shots so they cut together seamlessly. Each shot's mainPrompt must be a self-contained mini shooting script (600–900 words) but must reference the continuity ("same subject as previous shot, same warm key from camera-left") and must repeat the IDENTICAL [GLOBAL CAMERA SPECIFICATIONS] / [LIGHTING SUMMARY] / [COLOR GRADING] / [AUDIO DESIGN] / [ABSOLUTE RULES] closing blocks across all 5 shots.

═══ SEEDANCE 2.0 / 2.0 FAST — @ELEMENT REFERENCE MODE ═══
When the user provides numbered Elements (@Element 1 … @Element N, or shorthand @1 … @N), Seedance 2.0 binds each Element to a specific upload. In your mainPrompt:
  • Preserve every \`@Element N\` token from the user's brief verbatim (the shorthand \`@N\` is normalized to \`@Element N\` server-side).
  • For any Element the user did NOT mention, you MUST integrate it naturally into the script and tag it on first appearance as \`(@Element N: <one-word role: subject/outfit/style/lighting/motion/mood>)\`.
  • Never describe an Element's content literally without its \`@Element N\` anchor — Seedance needs the tag to bind the upload.
  • Example phrasing inside a cut: "Cut 3: Close-up. The subject (@Element 1: subject) wearing the outfit from @Element 6, lit in the warm rim style of @Element 2 (lighting)..."
  • The user should be able to copy the mainPrompt directly into Seedance 2.0 with every upload correctly referenced.

═══ FINAL REMINDERS ═══
- mainPrompt is a SHOOTING SCRIPT, not a paragraph. Never collapse it into prose.
- Always use [BRACKETED SECTION HEADERS] with timecodes for sequences, and the 5 mandatory closing blocks.
- Number every cut. Specify framing + lens + camera move + lighting + action for every cut.
- Output is a complete pre-production document the user can hand to a DP.`,

  examples: `SEEDANCE 2.0 EXAMPLE — CONDENSED SHOOTING SCRIPT (dancer in studio, 8s):

mainPrompt:
"[OPENING — 0s to 1.5s | THE BREATH]
Cut 1: Extreme close-up of the dancer's face. 85mm lens, f/1.4, shallow DOF. Studio black behind her. Single hard 3000K key from frame-left carves her cheekbone; the right side of her face falls into deep shadow. She inhales slowly. A bead of sweat slides down her temple. Her eyes open on the beat.
Cut 2: Tight on her hand at her side. 100mm macro. The fingers uncurl one by one. A silk sleeve drapes across her wrist, catching the warm key as it moves. Ground-level light bounce adds a subtle 3500K fill on the underside of the silk.
Camera: 85mm + 100mm macro, f/1.4, handheld micro-drift, hard 3000K key from left, no fill.

[RISING — 1.5s to 4s | THE FIRST PHRASE]
Cut 1: Wide shot. 35mm lens. The dancer centered in a black studio cyc. Single rim from camera-right at 3000K sculpts her silhouette. She arcs her arm upward in a slow undulating sweep; the silk cascades behind her like liquid mercury.
Cut 2: Profile. 50mm. Camera glides on a slow lateral dolly from her right shoulder to her left. She pulses through three syncopated isolations — shoulder roll, ribcage release, hip figure-eight. Each isolation lands on the beat.
Cut 3: Low angle. 24mm. Camera on the floor looking up. Her foot plants beside the lens; the silk sweeps overhead, briefly veiling the frame in warm haze.
Cut 4: Top-down bird's-eye. 35mm. The silk fans out around her in a perfect spiral. The 3000K key from the side casts a long dramatic shadow across the studio floor.
Camera: 24mm / 35mm / 50mm rotation, ground / waist / overhead heights, hard 3000K key + soft 3500K floor bounce.

[PEAK — 4s to 6.5s | THE ORBIT]
Cut 1: Medium shot. 50mm. Camera begins a slow orbital arc from her left to behind her right shoulder, tracking the silk's trail. She holds an extended arabesque; the fabric describes a perfect parabola behind her.
Cut 2: Close-up insert. 100mm macro. The silk passes the lens — texture fills the frame like a landscape of warm folds and rim-lit edges. 0.4s.
Cut 3: Wide. 35mm. The orbit continues. She rotates in counterpoint to the camera, so the relative motion is doubled. Studio haze diffuses the background; only her silhouette and the choreography of fabric remain in focus.
Camera: 35mm + 50mm + 100mm macro, steadicam orbital arc at 1.5 ft/s, single continuous-feel take.

[RESOLUTION — 6.5s to 8s | THE HOLD]
Cut 1: Medium close-up. 85mm. The dancer settles. The silk drifts down around her like falling snow in slow motion. Her shoulders release. 96fps.
Cut 2: Tight on her face. 85mm, f/1.4. Same hard 3000K key as the opening — full circle. Her eyes close. The faintest smile pulls at the corner of her mouth. Hold. Cut to black.
Camera: 85mm, f/1.4, static, hard 3000K key from left.

[GLOBAL CAMERA SPECIFICATIONS]
Aspect ratio: 9:16 vertical. Framerate: 96fps slow motion throughout. Lens rotation: 24mm / 35mm / 50mm / 85mm / 100mm macro. Grain: 35mm Kodak Vision3 500T. No anamorphic flares (studio environment). Camera height varies every cut: ground, waist, eye, overhead. Total cuts: 11 across 8 seconds. No angle repeated back-to-back.

[LIGHTING SUMMARY]
- Opening face / hand: hard 3000K key from frame-left, no fill, chiaroscuro half-shadow.
- Rising sequence: hard 3000K rim from camera-right, soft 3500K floor bounce, studio haze.
- Peak orbit: single hard 3000K key tracked during orbit, silk acts as motivated bounce.
- Resolution: hard 3000K key from left (matches opening), studio haze diffuses background to pure black.

[COLOR GRADING]
Desaturated to 70% overall. Shadows pushed to deep teal at 200°. Highlights warm amber at 35°. Skin tones held warm and natural. Silk retains full texture and rim detail. Blacks deep but not crushed. No bleach bypass. Final cut fades to true black.

[AUDIO DESIGN]
0s–1.5s: Silence except for the dancer's slow inhale at 0.8s.
1.5s–4s: Soft 70 BPM frame drum enters. Layered with sparse oud tremolo. Each isolation lands on a percussive tick.
4s–6.5s: BPM rises to 95. Low-end synth pad swells. Trap-style hi-hats layer underneath at half-time. Silk whoosh foley on each arm sweep (1.8s, 4.2s, 5.6s).
6.5s–8s: Drums drop out. Single sustained cello note resolves to a major. Soft footstep at 7.1s. Cello fades. Silence. Black.

[ABSOLUTE RULES]
1. Face is shown only in 3 moments: opening eyes-open, peak orbit silhouette, final eyes-closed smile.
2. No text, titles, logos, or watermarks of any kind.
3. Single dancer only. No additional figures.
4. Silk must look real — natural drape, no CGI plastic sheen.
5. 11+ cuts across 8 seconds. No shot longer than 1s except the final hold.
6. Emotional arc: stillness → release → flight → return.
7. This is a fashion-film trailer. It should feel like one."

negativePrompt: "morphing, distortion, blurry, watermark, text overlay, frame jumping, flickering, jittering, extra fingers, deformed hands, duplicate subjects, jerky motion, broken joints, unnatural body proportions, choppy choreography, off-beat motion"

cameraSuggestions: "85mm + 100mm macro for intimate beats; 24mm / 35mm / 50mm for studio wides and the orbital arc. Steadicam at 1.5 ft/s for the orbit. 96fps throughout."

audioBlock: "DIALOGUE: (none)\nSFX: silk fabric whoosh on each arm sweep (1.8s, 4.2s, 5.6s); soft footstep at 7.1s\nAMBIENT: 70→95 BPM frame drum + oud tremolo, low synth pad, half-time trap hi-hats, single sustained cello resolution at 6.5s"

shotStructure: "Shot 1 (0–1.5s): Opening face + hand details. Shot 2 (1.5–4s): Rising — wide / profile / low / top-down phrase. Shot 3 (4–6.5s): Peak — steadicam orbital arc with silk macro insert. Shot 4 (6.5–8s): Resolution — silk falls, face hold, cut to black."

referenceGuidance: "Uploaded image used as primary subject + costume reference. Lock skin tone, hair, silk color/texture, and the hard 3000K side-key setup across every cut. Studio cyc and haze stay identical from opening to final hold."

modelNotes: "Feed the entire shooting script (including the 5 closing blocks) into Seedance 2.0 as a single mainPrompt. Seedance 2.0 will sync motion to the AMBIENT BPM curve. For Seedance 2.0 Fast, expect the model to compress to ~6 cuts; keep the closing blocks intact so the look stays locked. For multi-shot Pro mode, repeat the 5 closing blocks identically across all 5 mini-scripts."

suggestedAspectRatio: "9:16"
suggestedDuration: "8s"`,
};
