import { readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { modelAdLayers } from "../../../apps/worker/src/product-model-ad-finishing.ts";

const dir = import.meta.dir;
const configuration = JSON.parse(await readFile(resolve(dir, "configuration.json"), "utf8"));
const input = resolve(dir, "product-model-ad-purse-15s-raw.mp4");
const output = resolve(dir, "product-model-ad-purse-15s.mp4");
async function run(args: string[]) {
  const process = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited]);
  if (code !== 0) throw new Error(`media_tool_failed:${stderr.slice(-500)}`);
  return { stdout, stderr };
}
const probe = JSON.parse((await run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate", "-of", "json", input])).stdout);
const video = probe.streams.find((stream: { codec_type: string }) => stream.codec_type === "video");
if (!video || Math.abs(Number(probe.format.duration) - 15) > .2 || Math.abs(video.width / video.height - 9/16) > .002 || probe.streams.some((stream: { codec_type: string }) => stream.codec_type === "audio")) throw new Error("media_contract_failed");
const layers = await modelAdLayers(configuration, video.width, video.height);
if (!layers) throw new Error("new_template_finishing_missing");
await writeFile(resolve(dir, "closing.png"), layers.closing);
await run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-n", "-i", input, "-i", resolve(dir, "closing.png"), "-filter_complex", "[0:v][1:v]overlay=0:0:enable='gte(t,12)'[finished]", "-map", "[finished]", "-an", "-threads", "1", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output]);
await run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-n", "-ss", "1", "-i", output, "-frames:v", "1", resolve(dir, "product-with-model-ad.jpg")]);
await run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-n", "-i", output, "-vf", "fps=1/1.8,scale=180:320,tile=4x2", "-frames:v", "1", resolve(dir, "review-frames.jpg")]);
const freeze = await run(["ffmpeg", "-hide_banner", "-i", output, "-vf", "freezedetect=n=0.001:d=0.8", "-an", "-f", "null", "-"]);
await writeFile(resolve(dir, "freeze-review.txt"), freeze.stderr);
const bytes = await readFile(output);
await writeFile(resolve(dir, "media-review.json"), JSON.stringify({ media: probe, finishing: "Exact closing CTA added by the existing worker modelAdLayers contract during the final 3 seconds", sha256: createHash("sha256").update(bytes).digest("hex"), freezeEvents: freeze.stderr.split("\n").filter(line => line.includes("freeze_")) }, null, 2));
await copyFile(output, "/Users/arbaanq/Downloads/movprompt/product-model-ad-purse-15s.mp4");
console.info(JSON.stringify({ output, media: probe, freezeDetected: freeze.stderr.includes("freeze_start") }));
