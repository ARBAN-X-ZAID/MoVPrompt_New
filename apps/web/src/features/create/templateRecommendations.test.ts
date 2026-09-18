import { describe, expect, it } from "vitest";

import { recommendTemplates } from "./templateRecommendations";
import { CREATOR_TEMPLATES } from "./templates";

describe("template recommendations", () => {
  it("creates a stable quoted recommendation tracer", () => {
    const input = {
      goal: "launch" as const,
      vertical: "ecommerce" as const,
      language: "en" as const,
      aspectRatio: "9:16" as const,
      hasSource: true,
      subjectText: "Kinza Cola crisp Kuwait beverage",
    };

    const first = recommendTemplates(CREATOR_TEMPLATES, input);
    const second = recommendTemplates([...CREATOR_TEMPLATES].reverse(), input);

    expect(first[0]?.template.goals).toContain("launch");
    expect(first.map((item) => item.template.id)).toEqual(second.map((item) => item.template.id));
    expect(first).toHaveLength(3);
    expect(first[0]?.template.id).toBe("restaurant-food-hero");
    expect(first[0]?.whyThisFits).toContain("launch");
  });

  it("returns one honest recovery state when no template supports the campaign", () => {
    const recommendations = recommendTemplates(CREATOR_TEMPLATES, {
      goal: "bookings",
      vertical: "ecommerce",
      language: "en",
      aspectRatio: "9:16",
      hasSource: true,
    });

    expect(recommendations).toEqual([]);
  });

  it("handles every outcome without inventing a template", () => {
    for (const goal of ["whatsapp_orders", "bookings", "launch", "offer", "demonstration", "education", "announcement", "trust", "brand_story"] as const) {
      const recommendations = recommendTemplates(CREATOR_TEMPLATES, {
        goal,
        vertical: "retail",
        language: "en",
        aspectRatio: "9:16",
        hasSource: true,
      });
      expect(recommendations).toHaveLength(Math.min(3, recommendations.length));
      expect(recommendations.every((recommendation) => recommendation.template.goals.includes(goal))).toBe(true);
    }
  });
});
