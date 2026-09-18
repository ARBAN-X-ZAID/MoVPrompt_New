import { describe, expect, it, vi, afterEach } from "vitest";
import { CATEGORY_PREVIEW_TEMPLATE_IDS } from "@movprompt/creative-engine";
import { CREATOR_TEMPLATES } from "./templates";
import { TEMPLATE_POSTERS, VERIFIED_TEMPLATE_VIDEOS } from "./templateMedia";

describe("R2-only template media", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  it("maps eleven posters and the four approved motion previews", () => {
    expect(CREATOR_TEMPLATES).toHaveLength(11);
    for (const template of CREATOR_TEMPLATES) {
      expect(TEMPLATE_POSTERS[template.id]).toMatch(new RegExp(`/api/v1/template-previews/v1/${template.id}\\.jpg$`));
      const approved = (CATEGORY_PREVIEW_TEMPLATE_IDS as readonly string[]).includes(template.id);
      expect(Boolean(VERIFIED_TEMPLATE_VIDEOS[template.id])).toBe(approved);
      expect(Boolean(template.previewVideo)).toBe(approved);
    }
  });
  it("uses the configured API origin without exposing R2 or using bundled media", async () => {
    vi.stubEnv("VITE_API_ORIGIN", "https://api.example.test");
    vi.resetModules();
    const { templateMediaFor } = await import("./templateMedia");
    expect(templateMediaFor("premium-phone-reveal", 0, "launch")).toMatchObject({ poster: "https://api.example.test/api/v1/template-previews/v1/premium-phone-reveal.jpg", previewVideo: "https://api.example.test/api/v1/template-previews/v1/premium-phone-reveal.mp4" });
  });
});
