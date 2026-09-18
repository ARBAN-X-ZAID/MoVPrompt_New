import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { existsSync } from "node:fs";

const CAMPAIGN_FONT = "MovPrompt Campaign";
const fontPath = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "C:/Windows/Fonts/arial.ttf",
].find(path => existsSync(path));
const fontRegistered = fontPath ? Boolean(GlobalFonts.registerFromPath(fontPath, CAMPAIGN_FONT)) : false;

export function assertCampaignTextFont(): void {
  if (!fontRegistered) throw new Error("campaign_overlay_font_unavailable: install DejaVu Sans for English and Arabic campaign text");
}

export type CampaignOutputText = { callToAction: string; offer?: string; whatsapp?: string; bookingUrl?: string };

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

/** Use the validated immutable generation snapshot, never a stale browser display field. */
export function campaignOutputText(configuration: unknown): CampaignOutputText | null {
  const root = object(configuration);
  const generation = root.generation ? object(root.generation) : root;
  const product = object(object(generation.creativeBrief).product);
  const callToAction = text(product.callToAction);
  if (!callToAction) return null;
  const offer = text(product.offer);
  const whatsapp = text(product.whatsapp);
  // Older saved briefs omitted this field; their validated campaign context retains it.
  const bookingUrl = product.bookingUrl === undefined
    ? text(object(generation.templateQuoteContext).bookingUrl) : text(product.bookingUrl);
  return { callToAction, ...(offer ? { offer } : {}), ...(whatsapp ? { whatsapp } : {}), ...(bookingUrl ? { bookingUrl } : {}) };
}

/** Rasterized text supports Arabic shaping and keeps all user text out of FFmpeg filter syntax. */
export function campaignTextPng(facts: CampaignOutputText, width: number, height: number): Uint8Array {
  assertCampaignTextFont();
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  const scale = Math.min(width / 480, height / 480);
  const padding = Math.round(24 * scale);
  const safeBottom = Math.round(height * .12);
  const availableWidth = width - padding * 2;
  const values = [facts.callToAction, facts.offer, facts.whatsapp ? `WhatsApp: ${facts.whatsapp}` : undefined, facts.bookingUrl].filter((value): value is string => Boolean(value));
  let fontSize = Math.round(25 * scale);
  let lines: string[] = [];
  let lineHeight = 0;
  // Wrap without dropping or shortening a booking link, number or offer.
  while (fontSize >= Math.round(14 * scale)) {
    context.font = `600 ${fontSize}px "${CAMPAIGN_FONT}"`;
    lines = [];
    for (const value of values) {
      let line = "";
      for (const character of value) {
        if (line && context.measureText(line + character).width > availableWidth) { lines.push(line); line = ""; }
        line += character;
      }
      if (line) lines.push(line);
    }
    lineHeight = Math.ceil(fontSize * 1.4);
    if (lines.length * lineHeight + padding * 2 <= height * .48) break;
    fontSize -= 1;
  }
  if (lines.length * lineHeight + padding * 2 > height * .48) throw new Error("campaign_overlay_text_too_long: shorten the offer or booking link for readable video text");
  const panelHeight = lines.length * lineHeight + padding * 2;
  const top = height - safeBottom - panelHeight;
  context.fillStyle = "rgba(17,17,19,0.88)";
  context.fillRect(padding / 2, top, width - padding, panelHeight);
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const [index, line] of lines.entries()) {
    context.direction = /[\u0600-\u06ff]/u.test(line) ? "rtl" : "ltr";
    context.fillStyle = index === 0 ? "#f4bb55" : "#ffffff";
    context.fillText(line, width / 2, top + padding + lineHeight * (index + .5));
  }
  return canvas.toBuffer("image/png");
}
