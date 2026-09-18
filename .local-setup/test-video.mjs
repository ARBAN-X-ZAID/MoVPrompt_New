// Isolated provider connectivity test; never an accepted MovPrompt campaign.
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
if (process.env.APP_ENV !== "local") throw new Error("Local testing only; use run.mjs.");
if (!process.argv.includes("--confirm-paid")) {
  console.log("No request sent. For one paid 2-second 480p test: node .local-setup/run.mjs test-video --confirm-paid");
  process.exit(0);
}
if (!process.env.AI_GATEWAY_API_KEY?.trim()) throw new Error("Add AI_GATEWAY_API_KEY to .env first.");
const model = "bytedance/seedance-v1.0-pro-fast";
if (process.env.MOVPROMPT_GATEWAY_VIDEO_MODEL_ID !== model) throw new Error("This local test only permits Seedance 1.0 Fast.");
// Verify validation tools before any potentially billable operation.
execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
const catalogResponse = await fetch("https://ai-gateway.vercel.sh/v1/models", { signal: AbortSignal.timeout(30_000) });
if (!catalogResponse.ok) throw new Error("Cannot verify model catalog; no video requested.");
const catalog = await catalogResponse.json();
const capabilities = catalog.data?.find((entry) => entry.id === model)?.video_capabilities;
if (!capabilities?.supported_operations?.includes("text-to-video") ||
    !capabilities.supported_durations_seconds.includes(2) ||
    !capabilities.supported_resolutions.includes("480p")) {
  throw new Error("Catalog no longer supports this fixed test; no video requested.");
}
const require = createRequire(resolve(root, "apps/worker/package.json"));
const { experimental_generateVideo } = require("ai");
const directory = resolve(root, "artifacts/gateway-smoke");
await mkdir(directory, { recursive: true });
const id = `local-text-test-${randomUUID()}`;
const output = resolve(directory, `${id}.mp4`);
const metadataPath = resolve(directory, `${id}.json`);
const recoveryPath = resolve(directory, `${id}.recovery.json`);
const metadata = { id, model, durationSeconds: 2, resolutionTier: "480p", kind: "unreviewed-provider-test", createdAt: new Date().toISOString() };
await writeFile(metadataPath, JSON.stringify({ ...metadata, status: "submitting" }, null, 2), { mode: 0o600 });
console.log("Requesting one paid Seedance 1.0 Fast test (2 seconds, 480p); no retries or model fallback.");
try {
  const result = await experimental_generateVideo({
    model,
    prompt: "A plain unbranded ceramic cup on a wooden table in warm morning light, a gentle slow camera push. No text, no logos, no people, no audio.",
    n: 1,
    duration: 2,
    aspectRatio: "9:16",
    resolution: "480p",
    generateAudio: false,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(1_200_000),
    headers: { "Idempotency-Key": id },
    providerOptions: { gateway: { tags: ["app:movprompt", "env:local", "purpose:provider-smoke"] } },
    download: async ({ url, abortSignal }) => {
      if (url.protocol !== "https:") throw new Error("Non-HTTPS video output rejected.");
      // Retain the already-billed result for manual recovery if downloading fails.
      await writeFile(recoveryPath, JSON.stringify({ id, status: "download_pending", outputUrl: url.toString() }), { mode: 0o600 });
      const response = await fetch(url, { signal: abortSignal });
      if (!response.ok || !response.body) throw new Error("Video download failed; recovery file preserved.");
      const chunks = [];
      let bytes = 0;
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > 32 * 1024 * 1024) throw new Error("Test output exceeds 32 MiB.");
        chunks.push(chunk);
      }
      return { data: Buffer.concat(chunks), mediaType: response.headers.get("content-type") || "video/mp4" };
    },
  });
  const bytes = result.videos[0]?.uint8Array;
  if (!bytes?.length) throw new Error("Provider returned no video.");
  await writeFile(output, bytes, { mode: 0o600 });
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height", "-of", "json", output], { encoding: "utf8" }));
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  if (!video || Number(probe.format?.duration) < 1.5 || Number(probe.format?.duration) > 3 || video.width !== 480 || video.height !== 864) {
    throw new Error("Downloaded video failed duration/resolution validation.");
  }
  execFileSync("ffmpeg", ["-v", "error", "-xerror", "-i", output, "-f", "null", "-"], { stdio: "pipe", timeout: 30_000 });
  await writeFile(recoveryPath, JSON.stringify({ id, status: "downloaded", output }), { mode: 0o600 });
  await writeFile(metadataPath, JSON.stringify({ ...metadata, status: "downloaded_and_decoded", output, probe }, null, 2), { mode: 0o600 });
  console.log(`Test video saved: ${output}\nProvider test only; campaign quality has not been reviewed.`);
} catch {
  await writeFile(metadataPath, JSON.stringify({ ...metadata, status: "failed_or_unverified", output, recoveryPath }, null, 2), { mode: 0o600 });
  console.error(`Test did not complete. Inspect ${metadataPath}. If a recovery file exists, recover that result before making another paid request.`);
  process.exitCode = 1;
}
