import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it, vi } from "vitest";
import { productModelAdFixture } from "../../api/src/product-model-ad.test-fixture.js";
import { modelAdLayers } from "./product-model-ad-finishing.js";
import { normalizeDeliveryMp4 } from "./output-persister.js";

const exec = promisify(execFile);
describe("exact product/model branding and silent finishing", () => {
  it("keeps existing template finishing outside this path", async () => {
    expect(await modelAdLayers({ creativeBrief: { templateId: "fashion-product-showcase" } }, 720, 1280)).toBeNull();
  });
  it.each(["en", "ar", "bilingual"])("creates exact %s message layers with no AI text", async language => {
    const payload = productModelAdFixture();
    const brief = payload.configuration.generation.creativeBrief;
    brief.language = language as "en" | "ar" | "bilingual";
    brief.productModelAd!.openingMessage = language === "en" ? "Your next favorite" : "اختيارك القادم";
    const layers = await modelAdLayers(payload.configuration, 720, 1280);
    expect(layers?.opening?.length).toBeGreaterThan(100);
    expect(layers?.closing.length).toBeGreaterThan(100);
    expect(layers?.closingSeconds).toBe(2);
  });
  it("uses a verified logo asset and fails when the saved logo is absent", async () => {
    const payload = productModelAdFixture(); const custom = payload.configuration.generation.creativeBrief.productModelAd!;
    const canvas = createCanvas(80, 80); const context = canvas.getContext("2d"); context.fillStyle = "#ff0000"; context.fillRect(0, 0, 80, 80);
    const bytes = new Uint8Array(canvas.toBuffer("image/png")); const checksum = createHash("sha256").update(bytes).digest("hex");
    custom.brandKit.logoChecksum = checksum;
    const logo = { ...payload.configuration.creatorProject.product.images[0]!, referenceRole: "artwork" as const, selected: false, checksum, storagePath: "users/owner/projects/project/logo.png" };
    payload.configuration.creatorProject.product.images.push(logo);
    const read = vi.fn(async () => bytes);
    const layers = await modelAdLayers(payload.configuration, 720, 1280, read);
    expect(read).toHaveBeenCalledWith(logo.storagePath, checksum); expect(layers?.closing.length).toBeGreaterThan(100);
    await expect(modelAdLayers(payload.configuration, 720, 1280)).rejects.toThrow("logo_unavailable");
  });
  it.runIf(process.env.MOVPROMPT_TEST_FFMPEG === "true").each([8, 15, 20] as const)("finishes an actual synthetic %is clip and removes all audio", async duration => {
    const directory = await mkdtemp(join(tmpdir(), "movprompt-model-ad-media-"));
    try {
      const source = join(directory, "source.mp4"), output = join(directory, "finished.mp4");
      await exec("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `testsrc2=s=360x640:r=12:d=${duration}`, "-f", "lavfi", "-i", `sine=frequency=440:duration=${duration}`, "-c:v", "libx264", "-threads", "1", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", source]);
      const payload = productModelAdFixture(duration, true);
      payload.configuration.generation.creativeBrief.productModelAd!.openingMessage = "Your next favorite";
      const layers = await modelAdLayers(payload.configuration, 360, 640);
      await writeFile(output, await normalizeDeliveryMp4(new Uint8Array(await readFile(source)), undefined, { aspectRatio: "9:16", muted: true, modelAdLayers: layers! }));
      const { stdout } = await exec("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json", output]);
      const probe = JSON.parse(stdout);
      expect(probe.streams).toEqual([{ codec_type: "video", width: 360, height: 640 }]); expect(Number(probe.format.duration)).toBeCloseTo(duration, 1);
    } finally { await rm(directory, { recursive: true, force: true }); }
  }, 30_000);
});
