import { createCanvas } from "@napi-rs/canvas";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
export function previewObjectKey(key: string): string {
  if (!key.endsWith(".mp4")) throw new Error("preview_requires_mp4");
  return key.replace(/\.mp4$/, ".preview.mp4");
}
export function watermarkArguments(input: string, output: string, watermark = "watermark.png"): string[] {
  return ["-y", "-i", input, "-i", watermark, "-filter_complex", "[0:v]scale='min(480,iw)':-2[base];[base][1:v]overlay=(W-w)/2:(H-h)/2[v]", "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", output];
}
export function watermarkPng(): Uint8Array {
  const canvas = createCanvas(320, 64);
  const context = canvas.getContext("2d");
  context.fillStyle = "rgba(0,0,0,0.55)"; context.fillRect(0, 0, 320, 64);
  context.font = "bold 26px sans-serif"; context.fillStyle = "rgba(255,255,255,0.9)";
  context.textAlign = "center"; context.fillText("MovPrompt Preview", 160, 41);
  return canvas.toBuffer("image/png");
}
export async function createWatermarkedPreview(bytes: Uint8Array): Promise<Uint8Array> {
  const dir = await mkdtemp(join(tmpdir(), "movprompt-preview-"));
  try {
    const input = join(dir, "input.mp4"); const output = join(dir, "preview.mp4");
    await writeFile(input, bytes);
    const watermark = join(dir, "watermark.png");
    await writeFile(watermark, watermarkPng());
    await promisify(execFile)(process.env.FFMPEG_PATH || "ffmpeg", watermarkArguments(input, output, watermark), { timeout: 120_000, maxBuffer: 1024 * 1024 });
    return await readFile(output);
  } finally { await rm(dir, { recursive: true, force: true }); }
}
