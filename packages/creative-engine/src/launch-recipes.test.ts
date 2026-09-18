import { describe, expect, it } from "vitest";
import { LAUNCH_CREATIVE_TEMPLATE_CATALOG, getCreativeTemplate } from "./catalog.js";
import { compileCreativeDirection } from "./prompt-compiler.js";
import { ENGINE_VERSION } from "./types.js";

const SCREEN_SURFACE_TEMPLATE_IDS = [
  "premium-phone-reveal",
  "phone-floating-ad",
  "business-service-promotion",
  "app-service",
] as const;

function compileFor(templateId: string, overrides: Record<string, unknown> = {}) {
  const template = getCreativeTemplate(templateId);
  return compileCreativeDirection({
    rawPrompt: template.visualSystem,
    audioEnabled: false,
    creativeBrief: {
      engineVersion: ENGINE_VERSION,
      templateId,
      market: "KW",
      language: "en",
      arabicDialect: null,
      dialectRegister: template.dialectRegister,
      tone: template.tone,
      vertical: template.verticals[0],
      goal: template.goals[0],
      product: {
        name: "Client reference",
        brand: "",
        description: "",
        price: "",
        offer: "",
        callToAction: template.scenes.at(-1)!.headline.en,
        whatsapp: "",
        location: "",
        ...(overrides.product as Record<string, unknown> | undefined),
      },
      scenes: template.scenes,
      qualityPolicy: template.qualityPolicy,
    },
  });
}

describe("image-first launch recipes", () => {
  it.each(LAUNCH_CREATIVE_TEMPLATE_CATALOG)("$id preserves entered offer and contact facts in its prompt", template => {
    const compiled = compileCreativeDirection({ rawPrompt: template.visualSystem, creativeBrief: {
      engineVersion: ENGINE_VERSION, templateId: template.id, market: "KW", language: "en", arabicDialect: null,
      dialectRegister: template.dialectRegister, tone: template.tone, vertical: template.verticals[0], goal: template.goals[0],
      product: { name: "Client product", callToAction: "Book now", offer: "20% off", whatsapp: "+96550000000", bookingUrl: "https://example.com/book" },
      scenes: template.scenes, qualityPolicy: template.qualityPolicy,
    } });
    expect(compiled.prompt).toContain("Confirmed booking link: https://example.com/book");
    expect(compiled.prompt).toContain("Confirmed offer: 20% off");
    expect(compiled.prompt).toContain("Confirmed WhatsApp destination: +96550000000");
    expect(compiled.prompt).toContain("Never display an empty optional field");
  });
  it.each(LAUNCH_CREATIVE_TEMPLATE_CATALOG)("$id needs no hidden brand input", template => {
    expect(template.requiredInputs).toEqual(["subject_name", "primary_reference", "call_to_action"]);
  });

  const fourSceneRecipes = LAUNCH_CREATIVE_TEMPLATE_CATALOG.filter(template => template.id !== "new-york-billboard-takeover");
  it.each(fourSceneRecipes)("$id has a reusable eight-second four-scene recipe", template => {
    expect(template.durationSeconds).toBe(8);
    expect(template.scenes).toHaveLength(4);
    const compiled = compileCreativeDirection({ rawPrompt: template.visualSystem, audioEnabled: false, creativeBrief: {
      engineVersion: ENGINE_VERSION, templateId: template.id, market: "KW", language: "en", arabicDialect: null,
      dialectRegister: template.dialectRegister, tone: template.tone, vertical: template.verticals[0], goal: template.goals[0],
      product: { name: "Client reference", brand: "", description: "", price: "", offer: "", callToAction: template.scenes.at(-1)!.headline.en, whatsapp: "", location: "" },
      scenes: template.scenes, qualityPolicy: template.qualityPolicy,
    } });
    for (const scene of template.scenes) expect(compiled.prompt).toContain(scene.direction);
    expect(compiled.prompt).not.toContain("not supplied");
    expect(compiled.prompt).toContain("NEGATIVE CONSTRAINTS");
  });
});

describe("new-york-billboard-takeover shot structure", () => {
  const template = getCreativeTemplate("new-york-billboard-takeover");

  it("uses three scenes totalling eight seconds", () => {
    expect(template.durationSeconds).toBe(8);
    expect(template.scenes).toHaveLength(3);
    const total = template.scenes.reduce((sum, scene) => sum + scene.duration, 0);
    expect(total).toBe(8);
  });

  it("ends on a locked camera frame with a clean lower-third", () => {
    const closingScene = template.scenes.at(-1)!;
    expect(closingScene.camera).toBe("locked");
    expect(closingScene.shot.toLowerCase()).toContain("lower 25%");
  });

  it("uses the soft neutral glowing surface in the visual system", () => {
    expect(template.visualSystem).toContain("soft neutral glowing surface");
    expect(template.visualSystem).not.toContain("no readable unrelated advertising");
  });

  it("forbids baked text in the compiled prompt", () => {
    const compiled = compileFor("new-york-billboard-takeover");
    // High-attention no-baked-text rule.
    expect(compiled.prompt).toContain("NO-BAKED-TEXT RULE (HIGHEST PRIORITY)");
    expect(compiled.prompt).toContain("The finishing service adds every readable element afterwards");
    // The old conflicting rule must be gone.
    expect(compiled.prompt).not.toContain("readable text on one dominant billboard");
    // The new identity lock is in the prompt.
    expect(compiled.prompt).toContain("clean neutral glowing panel");
    expect(compiled.prompt).toContain("NO baked-in text");
    // The extended negative prompt is appended.
    expect(compiled.prompt).toContain("no invented advertisement");
    // The billboard is the one recipe that does NOT carry the reference-as-subject
    // content (the rule still has its header in the prompt; we assert the content).
    expect(compiled.prompt).not.toContain("use the reference as the subject of the frame directly");
  });
});

describe("image-first screen-surface recipes", () => {
  it.each(SCREEN_SURFACE_TEMPLATE_IDS)("%s forbids baked text and treats the reference as the hero of the frame", templateId => {
    const compiled = compileFor(templateId);
    expect(compiled.prompt).toContain("NO-BAKED-TEXT RULE (HIGHEST PRIORITY)");
    expect(compiled.prompt).toContain("The finishing service adds every readable element afterwards");
    expect(compiled.prompt).toContain("REFERENCE-AS-SUBJECT RULE");
    expect(compiled.prompt).toContain("use the reference as the subject of the frame directly");
  });

  it.each(SCREEN_SURFACE_TEMPLATE_IDS)("%s extends the negative prompt with a per-template anti-hallucination suffix", templateId => {
    const compiled = compileFor(templateId);
    const suffixSuffixes: Record<string, string> = {
      "premium-phone-reveal": "no generated app icons",
      "phone-floating-ad": "no generated app icons",
      "business-service-promotion": "no generated testimonials",
      "app-service": "no generated second app",
    };
    expect(compiled.negativePrompt).toContain(suffixSuffixes[templateId]);
  });

  it.each(SCREEN_SURFACE_TEMPLATE_IDS)("%s identity lock explicitly forbids generated on-screen content", templateId => {
    const compiled = compileFor(templateId);
    const identityLockExpectations: Record<string, string> = {
      "premium-phone-reveal": "no generated app icons",
      "phone-floating-ad": "no generated app icons",
      "business-service-promotion":
        "Never invent features, screens, testimonials, badges, prices, claims, text, captions or business claims",
      "app-service": "no generated second app",
    };
    expect(compiled.prompt).toContain(identityLockExpectations[templateId]);
  });
});
