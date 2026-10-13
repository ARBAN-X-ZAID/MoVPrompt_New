import { describe, expect, it } from "vitest";
import { VERIFIED_PREVIEW_TEMPLATE_IDS } from "./verified-preview-manifest.js";
import { getVerifiedTemplatePreview } from "./verified-preview.js";

describe("verified preview associations", () => {
  it("binds jewelry to the local eight-second animation of the v3 direction", () => {
    expect(getVerifiedTemplatePreview("jewelry-product-showcase")).toEqual({ objectKey: "templates/v3/jewelry-product-showcase-animation.mp4", durationSeconds: 8, recipeVersion: 3 });
  });
  it("keeps all twelve historical previews at their original v1 keys", () => {
    const historical = VERIFIED_PREVIEW_TEMPLATE_IDS.filter(id => id !== "jewelry-product-showcase");
    expect(historical).toHaveLength(12);
    for (const id of historical) expect(getVerifiedTemplatePreview(id)).toEqual({ objectKey: `templates/v1/${id}.mp4`, durationSeconds: 8, recipeVersion: 1 });
    expect(getVerifiedTemplatePreview("unknown")).toBeUndefined();
  });
});
