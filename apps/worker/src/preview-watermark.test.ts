import { describe, expect, it } from "vitest";
import { previewObjectKey, watermarkArguments, watermarkPng } from "./preview-watermark.js";
describe("watermarked guest media", () => {
  it("uses a separate output key and burns in a visible watermark", () => {
    expect(previewObjectKey("users/a/projects/b/video.mp4")).toBe("users/a/projects/b/video.preview.mp4");
    const args = watermarkArguments("in.mp4", "out.mp4");
    expect(args.join(" ")).toContain("overlay=");
    expect(args).toContain("watermark.png");
    expect(Buffer.from(watermarkPng()).subarray(1, 4).toString()).toBe("PNG");
    expect(args).toContain("libx264");
    expect(args).not.toContain("copy");
  });
});
