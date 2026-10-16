import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it, vi } from "vitest";
import { productModelAdFixture } from "../../api/src/product-model-ad.test-fixture.js";
import { adStudioBrandAdFixture } from "../../api/src/ad-studio-brand-ad.test-fixture.js";
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
  it.each([["9:16", 720, 1280], ["1:1", 720, 720], ["4:5", 720, 900], ["16:9", 1280, 720]] as const)("fits the Ad Studio ending card with logo on %s", async (aspectRatio, width, height) => {
    const payload = adStudioBrandAdFixture({ aspectRatio, duration: 15 });
    const custom = payload.configuration.generation.creativeBrief.adStudioBrandAd!;
    Object.assign(custom, { brandName: "B".repeat(60), website: `www.${"w".repeat(190)}.com`, socials: "s".repeat(200) });
    payload.configuration.generation.creativeBrief.product.brand = custom.brandName;
    const canvas = createCanvas(80, 80); canvas.getContext("2d").fillRect(0, 0, 80, 80);
    const bytes = new Uint8Array(canvas.toBuffer("image/png")); const checksum = createHash("sha256").update(bytes).digest("hex");
    custom.logoChecksum = checksum;
    payload.configuration.creatorProject.product.images.push({ ...payload.configuration.creatorProject.product.images[0]!, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", referenceRole: "artwork", selected: false, checksum, storagePath: "users/owner/projects/project/logo.png" });
    const layers = await modelAdLayers(payload.configuration, width, height, vi.fn(async () => bytes));
    expect(layers?.opening).toBeUndefined();
    expect(layers?.closing.length).toBeGreaterThan(100);
    expect(layers?.closingSeconds).toBe(4);
  });
  it.runIf(process.env.MOVPROMPT_TEST_FFMPEG === "true")("finishes a 4:5 Ad Studio clip with native audio and the card sized to the crop", async () => {
    const directory = await mkdtemp(join(tmpdir(), "movprompt-brand-ad-media-"));
    try {
      const source = join(directory, "source.mp4"), output = join(directory, "finished.mp4");
      await exec("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=360x480:r=12:d=8", "-f", "lavfi", "-i", "sine=frequency=440:duration=8", "-c:v", "libx264", "-threads", "1", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", source]);
      const layers = await modelAdLayers(adStudioBrandAdFixture({ aspectRatio: "4:5" }).configuration, 360, 450);
      await writeFile(output, await normalizeDeliveryMp4(new Uint8Array(await readFile(source)), undefined, { aspectRatio: "4:5", modelAdLayers: layers! }));
      const { stdout } = await exec("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height", "-of", "json", output]);
      expect(JSON.parse(stdout).streams).toEqual(expect.arrayContaining([{ codec_type: "video", width: 360, height: 450 }, { codec_type: "audio" }]));
    } finally { await rm(directory, { recursive: true, force: true }); }
  }, 30_000);
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
