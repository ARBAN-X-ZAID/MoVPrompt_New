// Builds a motion-only prompt for animating a single storyboard panel as the
// starting frame on Kling 2.1 Master (image-to-video). The prompt deliberately
// preserves composition / character / wardrobe / grade — the still already
// carries the look; the video model only needs the motion brief.

export function buildAnimateFromPanelPrompt(input: {
  shotIndex: number;
  directorsNote?: string;
}): string {
  const note = (input.directorsNote || "").trim();
  const noteLine = note ? `Scene context: ${note}\n\n` : "";
  return (
    `${noteLine}Animate panel ${input.shotIndex} from its still — preserve the exact composition, character identity, wardrobe, props, lighting, color grade, lens, and film stock of the reference frame. ` +
    `Add subtle, motivated motion only: micro-parallax on the subject, soft breath, hair / fabric drift, atmospheric particles (dust, mist, smoke) responding to depth. ` +
    `Camera holds with an imperceptible slow push-in (no whip pans, no cuts, no new framing). ` +
    `5 seconds, cinematic, photoreal. No text, no captions, no watermark.`
  );
}
