import { compileKuwaitiCampaignCopy, voiceDirection } from "./kuwaiti-arabic.js";
import { templateRequiresSynchronizedSpeech } from "./catalog.js";
import { ENGINE_VERSION, CreativeBriefSchema, type CompiledCreativeDirection } from "./types.js";

const NEGATIVE_PROMPT = [
  "changed product shape, label, logo, packaging, colour or proportions",
  "invented product feature, medical claim, qualification, price, discount or result",
  "baked-in text, fake typography, misspelled Arabic, subtitles, watermark or user interface",
  "extra fingers, warped hands, duplicated objects, rubber motion, flicker, frame tearing or sudden identity drift",
  "unmotivated camera movement, impossible reflections, floating props or inconsistent lighting",
].join(", ");

/**
 * Per-template anti-hallucination suffixes. Concatenated to the base negative
 * prompt when the active template is one of the image-first launch recipes
 * that historically bake text or repurpose the supplied reference as a screen
 * surface.
 */
const EXTENDED_NEGATIVE_PROMPT: Record<string, string> = {
  "new-york-billboard-takeover":
    "no generated text, no fake typography, no invented advertisement, no neighbouring readable signage, no celebrity likeness, no readable third-party brand",
  "premium-phone-reveal":
    "no generated app icons, no generated status bar, no generated dock, no generated notifications, no generated screenshots, no on-screen text",
  "phone-floating-ad":
    "no generated app icons, no generated status bar, no generated dock, no generated notifications, no generated screenshots, no on-screen text",
  "business-service-promotion":
    "no generated testimonials, no generated UI chrome, no generated prices, no generated claims, no on-screen text",
  "app-service":
    "no generated second app, no generated notifications, no generated status icons, no on-screen text",
};

/** Recipes that compose the prompt around a single supplied primary reference. */
const SCREEN_SURFACE_TEMPLATE_IDS = new Set([
  "premium-phone-reveal",
  "phone-floating-ad",
  "business-service-promotion",
  "app-service",
]);

function seconds(value: number): string {
  return `${value.toFixed(1)}s`;
}

const SUBJECT_IDENTITY_LOCKS: Record<string, string> = {
  "premium-phone-reveal": "Preserve the exact camera module, screen layout, logo placement, buttons, frame finish, thickness and proportions. The phone screen must remain a clean neutral gradient with no generated app icons, status bar, dock, notifications, text, screenshots or interface. Do not invent on-screen content. The supplied primary reference artwork may be shown as a printed image inside or beside the phone only when explicitly requested by the template.",
  "phone-floating-ad": "Preserve the exact camera module, screen layout, logo placement, buttons, frame finish, thickness and proportions. The phone screen must remain a clean neutral gradient with no generated app icons, status bar, dock, notifications, text, screenshots or interface. The supplied primary reference artwork may be shown as a printed image inside or beside the phone only when explicitly requested by the template.",
  "restaurant-food-hero": "Preserve the exact plating, ingredients, portion and texture; never add garnish, steam effects that obscure food, or a different serving vessel.",
  "food-delivery-ad": "Preserve the exact plating, ingredients, portion and texture plus every supplied packaging shape, colour and label.",
  "fashion-product-showcase": "Preserve the exact fabric, cut, stitching, pattern and logo, including garment length, drape and hardware.",
  "luxury-fashion-reveal": "Preserve the exact fabric, cut, stitching, pattern and logo, including silhouette, material finish and hardware.",
  "cosmetic-product-commercial": "Preserve the exact packaging geometry, cap, applicator, shade, material, logo and label placement.",
  "perfume-advertisement": "Preserve the exact bottle silhouette, cap, glass, liquid colour and label, including real reflections and proportions.",
  "real-estate-property": "Preserve the exact architecture, room geometry, fixtures and view; never add floors, rooms, windows, furniture, amenities or scenery.",
  "business-service-promotion": "Preserve the exact uploaded service artwork, brand marks and interface. The artwork sits inside the frame exactly as supplied. Never invent features, screens, testimonials, badges, prices, claims, text, captions or business claims. Do not generate UI elements around the supplied artwork.",
  "new-york-billboard-takeover": "The billboard surface is a clean neutral glowing panel with NO baked-in text, NO invented logos, NO fake typography, NO duplicated posters, NO third-party advertising. The supplied artwork is inserted into the billboard exactly as provided (proportions, colours, layout, no rewriting). All real text, prices, logos and CTA come from the deterministic finishing service and must not be generated here. The surrounding plaza, architecture and crowd are generic New York atmosphere only — no readable text on neighbouring buildings or screens.",
};

export function compileCreativeDirection(input: {
  rawPrompt: string;
  creativeBrief: unknown;
  audioEnabled?: boolean;
  qualityAttempt?: number;
  retryDirective?: string;
}): CompiledCreativeDirection {
  const brief = CreativeBriefSchema.parse(input.creativeBrief);
  const audioEnabled = input.audioEnabled ?? true;
  const requiresSynchronizedSpeech = templateRequiresSynchronizedSpeech(brief.templateId);
  const negativeBase = brief.templateId === "app-service"
    ? NEGATIVE_PROMPT.replace("watermark or user interface", "watermark or invented user interface")
    : NEGATIVE_PROMPT;
  const negativeSuffix = EXTENDED_NEGATIVE_PROMPT[brief.templateId];
  const negativePrompt = negativeSuffix
    ? `${negativeBase}, ${negativeSuffix}`
    : negativeBase;
  const kuwaiti = brief.language === "en" ? null : compileKuwaitiCampaignCopy(brief);
  let cursor = 0;
  const shots = brief.scenes.map((scene, index) => {
    const start = cursor;
    cursor += scene.duration;
    const localized = kuwaiti?.scenes[index];
    const spoken = brief.language === "en" ? scene.voiceover.en : localized?.voiceover ?? scene.voiceover.ar;
    return [
      `SHOT ${index + 1} · ${seconds(start)}–${seconds(cursor)} · ${scene.title.en}`,
      `Purpose: ${scene.purpose.en}`,
      `Visual action: ${scene.direction}`,
      `Framing: ${scene.shot}. Camera: ${scene.camera}. Lighting: ${scene.lighting}.`,
      `Continuity: ${scene.continuityAnchor}`,
      audioEnabled
        ? `Spoken line: ${spoken}`
        : `Approved copy context (do not speak or render as text): ${spoken}`,
      "Keep clean negative space for deterministic text overlays; render no text inside the generated footage.",
    ].join("\n");
  });

  // High-attention no-baked-text rule. Placed between the per-template identity
  // lock and the campaign direction so the model sees it before reading the
  // shot plan. Mirrors the closing rule below.
  const noBakedTextRule =
    "Do not bake text, prices, logos, captions, claims, status bars, notifications, app icons, dock icons, screenshots, billboards of unrelated text, or any other readable content into the generated footage. The finishing service adds every readable element afterwards.";

  // Closing rule for the screen-surface image-first recipes. The billboard
  // template is the explicit exception: it is the one place where the supplied
  // reference is meant to sit on a fictional surface.
  const referenceSubjectClosing = SCREEN_SURFACE_TEMPLATE_IDS.has(brief.templateId)
    ? "If the supplied primary reference is a real-world photograph (a phone, a food dish, a product on a table, a service artwork), use the reference as the subject of the frame directly. Do not place it inside a fictional screen, billboard, app shell, or other generated surface. The reference is the hero of the frame."
    : "";

  const factualLock = [
    `Subject name: ${brief.product.name}`,
    brief.product.brand ? `Brand: ${brief.product.brand}` : "",
    brief.product.description ? `Confirmed description: ${brief.product.description}` : "",
    brief.product.price ? `Confirmed price: ${brief.product.price} KWD` : "",
    brief.product.offer ? `Confirmed offer: ${brief.product.offer}` : "",
    `Confirmed call to action: ${brief.product.callToAction}`,
    brief.product.whatsapp ? `Confirmed WhatsApp destination: ${brief.product.whatsapp}` : "",
    brief.product.bookingUrl ? `Confirmed booking link: ${brief.product.bookingUrl}` : "",
    brief.product.location ? `Confirmed location: ${brief.product.location}` : "",
  ].filter(Boolean).join("\n");

  const retry = input.qualityAttempt && input.qualityAttempt > 0
    ? `QUALITY RETRY ${input.qualityAttempt}: ${input.retryDirective || "Simplify motion and strengthen identity continuity without changing the campaign facts."}`
    : "FIRST QUALITY PASS: prioritise product identity, physical realism and shot-to-shot continuity over decorative complexity.";

  const prompt = [
    `MOVPROMPT PREMIUM CAMPAIGN ENGINE · ${ENGINE_VERSION}`,
    retry,
    "NON-NEGOTIABLE PRODUCT AND BUSINESS TRUTH",
    factualLock,
    "OFFER AND CONTACT FINISHING: preserve the confirmed offer, booking link and WhatsApp number exactly. Leave a clear lower end-card area for the finishing service to display supplied facts and the confirmed call to action. Never display an empty optional field, placeholder or invented destination. Do not bake these texts into AI footage; the finishing service adds accurate text afterwards.",
    "REFERENCE POLICY",
    "Treat supplied product references as an exact digital identity lock. Preserve silhouette, packaging geometry, label placement, logo, colour and material. Treat people and locations as continuity references only when explicitly supplied.",
    SUBJECT_IDENTITY_LOCKS[brief.templateId] ?? "Preserve the supplied subject exactly across every shot.",
    "NO-BAKED-TEXT RULE (HIGHEST PRIORITY)",
    noBakedTextRule,
    "CAMPAIGN DIRECTION",
    brief.templatePromptVersion ? `Pinned template prompt: ${brief.templatePromptVersion}; recipe ${brief.templateRecipeVersion}` : "",
    brief.templateVisualSystem ?? "",
    input.rawPrompt.trim(),
    `Tone: ${brief.tone}. Market: Kuwait. Format: conversion-ready social campaign.`,
    "SHOT PLAN",
    ...shots,
    "AUDIO AND LANGUAGE",
    brief.language === "en"
      ? "Natural English voice and locally neutral Kuwait-market delivery."
      : voiceDirection(brief.tone, brief.dialectRegister),
    kuwaiti ? `Approved ar-KW voice script: ${kuwaiti.fullVoiceover}` : "",
    !audioEnabled
      ? "MUTED OUTPUT: generate no speech, dialogue, music or sound effects. Do not show a person visibly speaking or moving their mouth as if speaking."
      : requiresSynchronizedSpeech
        ? "SYNCHRONIZED PRESENTER SPEECH: any visible speaking person must deliver the exact approved line with natural phoneme-to-mouth timing and provider-native synchronized audio. Never create silent talking, detached dubbing or a different script."
        : "PROVIDER-NATIVE AUDIO: use only the approved spoken lines as off-screen narration when audio is enabled. Do not show a person visibly speaking. No separate narration service or post-generation voice track is available.",
    "FINISHING STANDARD",
    "Photoreal commercial finish, physically plausible motion, coherent geography, motivated key/fill/rim lighting, stable exposure and colour, clean edit points, premium sound perspective and intentional pacing.",
    `NEGATIVE CONSTRAINTS: ${negativePrompt}.`,
    "REFERENCE-AS-SUBJECT RULE",
    referenceSubjectClosing,
  ].filter(Boolean).join("\n\n");

  if (prompt.length > 8_000) throw new Error("compiled_prompt_exceeds_provider_contract");
  return {
    prompt,
    negativePrompt,
    spokenLocale: brief.language === "en" ? "en-US" : brief.language === "ar" ? "ar-KW" : "mixed",
    dialectScore: kuwaiti?.score ?? 100,
    dialectWarnings: kuwaiti?.warnings ?? [],
    dialectPolicyVersion: kuwaiti?.policyVersion ?? "not-applicable",
    qualityPolicy: brief.qualityPolicy,
  };
}
