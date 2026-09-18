import { describe, it, expect } from "vitest";
import { rankModels, resolveRecommendation } from "../modelRanking";

describe("modelRanking", () => {
  it("prefers audio-capable models when dialogue is needed", () => {
    const ranked = rankModels({
      subject: "Two characters in conversation",
      action: "speak quietly",
      mood: "intimate dialogue scene with whispered voiceover",
    });
    const top = ranked[0].model;
    expect(top.audio).toBe(true);
    // No-audio model should be pushed below
    const klingPos = ranked.findIndex((r) => r.model.id === "kling-v2.5-turbo-pro");
    const veoPos = ranked.findIndex((r) => r.model.audio);
    expect(veoPos).toBeLessThan(klingPos);
  });

  it("filters out models that cannot reach the requested duration", () => {
    const ranked = rankModels({
      subject: "establishing shot",
      duration_hint: "10s",
    });
    const veoEntry = ranked.find((r) => r.model.id === "veo-3.1");
    expect(veoEntry?.reasons.some((r) => r.includes("Caps at"))).toBe(true);
  });

  it("resolves an ambiguous 'Kling' free-text hint to a Kling model via ranking", () => {
    const result = resolveRecommendation({
      subject: "moody portrait",
      model_recommendation: "Kling — bold motion",
    });
    expect(result.primary.family).toBe("kling");
  });

  it("falls back to top-ranked model when LLM id is invalid", () => {
    const result = resolveRecommendation({
      subject: "a singer performing on stage",
      mood: "live music with vocals",
      recommended_model_id: "totally-not-a-model",
    });
    expect(result.source).toBe("ranking");
    expect(result.primary.audio).toBe(true);
  });

  it("uses the LLM id when valid and supplies ranked alternatives", () => {
    const result = resolveRecommendation({
      subject: "cinematic landscape",
      recommended_model_id: "seedance-v1-pro",
      recommended_alternatives: ["veo-3.1"],
    });
    expect(result.source).toBe("llm");
    expect(result.primary.id).toBe("seedance-v1-pro");
    expect(result.alternatives.length).toBeGreaterThan(0);
    expect(result.alternatives.some((a) => a.id === "veo-3.1")).toBe(true);
  });
});
