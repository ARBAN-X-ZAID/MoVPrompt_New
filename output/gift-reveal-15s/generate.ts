import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { resolve } from "node:path";
import { createVercelGatewaySeedanceAdapter } from "../../packages/providers/src/vercel-gateway-seedance.ts";
import { R2Storage, r2StorageConfigFromEnv } from "../../packages/storage/src/index.ts";

const root = resolve(import.meta.dir, "../..");
// Run from the repository root with Bun, which loads the existing ignored env files.
const duration = process.argv.includes("--duration=8") ? 8 : 15;
const outputDir = resolve(root, `output/gift-reveal-${duration}s`);
const privateDir = resolve(root, `artifacts/gift-reveal-${duration}s-2026-10-13`);
const dispatchPath = resolve(privateDir, "dispatch.json");
const operationPath = resolve(privateDir, "operation.json");
const outputPath = resolve(outputDir, `gift-reveal-${duration}s.mp4`);
const deliveredPath = `/Users/arbaanq/Downloads/movprompt/action-ad-references/gift-reveal-${duration}s.mp4`;
const sourcePath = "/Users/arbaanq/Downloads/movprompt/action-ad-references/01-gift-reveal.png";
const sha = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");
const delay = (ms: number) => new Promise((done) => setTimeout(done, ms));
const secretJson = async (name: string, data: unknown) => {
  const path = resolve(privateDir, name);
  await writeFile(path, JSON.stringify(data, null, 2), { mode: 0o600 });
  await chmod(path, 0o600);
};
async function main() {
  await mkdir(privateDir, { recursive: true, mode: 0o700 });
  const key = process.env.AI_GATEWAY_API_KEY?.trim();
  if (!key) throw new Error("gateway_key_missing");
  let referenceUrl = "";
  const adapter = createVercelGatewaySeedanceAdapter({
    capability: "video.product_fidelity", apiKey: key,
    modelId: "bytedance/seedance-2.5", applicationEnvironment: "local",
    resolutionTier: "720p", generateAudio: false, requestTimeoutMs: 60_000,
    resolveReferenceUrl: async () => ({ url: referenceUrl, mediaType: "image/png" }),
    resolveFirstFrame: async () => { throw new Error("first_frame_mode_forbidden_for_this_preview"); },
  });
  if (process.argv.includes("--submit")) {
    if (process.env.MOVPROMPT_CONFIRM_GIFT_VIDEO !== "YES") throw new Error("explicit_confirmation_required");
    if (await Bun.file(dispatchPath).exists()) throw new Error("dispatch_already_exists_no_paid_retry");
    const prompt = (await readFile(resolve(outputDir, "prompt.txt"), "utf8")).trim();
    if (!prompt || prompt.length > 8_000) throw new Error("prompt_invalid");
    const source = await readFile(sourcePath);
    const hash = sha(source);
    const immutable = sha(JSON.stringify({ model: "bytedance/seedance-2.5", hash, prompt, duration, ratio: "9:16", resolution: "720p", audio: false }));
    const seed = Number.parseInt(immutable.slice(0, 8), 16) & 0x7fffffff;
    const storage = new R2Storage(r2StorageConfigFromEnv());
    const objectKey = `preview-tests/gift-reveal-${duration}s-2026-10-13/${hash}.png`;
    await storage.checkBucket(storage.assetsBucket);
    await storage.put({ bucket: storage.assetsBucket, key: objectKey, body: source, contentType: "image/png", metadata: { "sha256-hex": hash } });
    const verified = await storage.get({ bucket: storage.assetsBucket, key: objectKey, maxBytes: 10 * 1024 * 1024 });
    if (sha(verified.body) !== hash) throw new Error("reference_checksum_mismatch");
    referenceUrl = (await storage.signDownload({ bucket: storage.assetsBucket, key: objectKey, expiresInSeconds: 3600 })).url;
    await writeFile(dispatchPath, JSON.stringify({ status: "submitting", authorizedCalls: 1, sourceChecksum: hash, promptChecksum: sha(prompt), seed, objectKey, durationSeconds: duration, audio: false, referenceMode: "references", createdAt: new Date().toISOString() }, null, 2), { flag: "wx", mode: 0o600 });
    console.info(`Submitting one authorized ${duration}-second silent reference-mode preview; paid retries disabled.`);
    const submission = await adapter.submit({
      operationId: `gift-preview-${immutable.slice(0, 24)}`, userId: "local-preview", projectId: "standalone-gift-preview",
      capability: "video.product_fidelity", prompt, durationSeconds: duration, aspectRatio: "9:16", resolution: "720p",
      generateAudio: false, seed, referenceMode: "references", requiredModelId: "bytedance/seedance-2.5",
      references: [{ objectKey, mimeType: "image/png" }], idempotencyKey: `gift-preview-${immutable}`,
    });
    await secretJson("operation.json", submission);
    console.info("Provider accepted the request. Operation saved for recovery; polling does not create another generation.");
  } else if (!process.argv.includes("--resume")) {
    throw new Error("use_submit_or_resume");
  }
  const operation = JSON.parse(await readFile(operationPath, "utf8"));
  let prior = "";
  for (let attempt = 0; attempt < 120; attempt += 1) {
    let status;
    try { status = await adapter.getStatus(operation.providerRequestId); } catch (error) {
      await secretJson("poll-error.json", { message: String(error), at: new Date().toISOString() });
      console.info("Status check temporarily unavailable; no new generation submitted.");
      await delay(10_000); continue;
    }
    await secretJson("status.json", status);
    if (status.status !== prior || attempt % 6 === 0) console.info(JSON.stringify({ status: status.status, elapsedPollSeconds: attempt * 10 }));
    prior = status.status;
    if (status.status === "failed" || status.status === "cancelled") throw new Error(`provider_${status.status}:${status.errorCode ?? "unknown"}`);
    if (status.status === "completed") {
      if (!status.outputUrl) throw new Error("output_url_missing");
      const response = await fetch(status.outputUrl, { signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`download_http_${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length < 1024 || Buffer.from(bytes.slice(4, 8)).toString() !== "ftyp") throw new Error("output_not_mp4");
      await writeFile(outputPath, bytes, { flag: "wx" });
      const probe = Bun.spawn(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate", "-of", "json", outputPath], { stdout: "pipe", stderr: "pipe" });
      const media = JSON.parse(await new Response(probe.stdout).text());
      if (await probe.exited !== 0) throw new Error("ffprobe_failed");
      const video = media.streams.find((s: { codec_type: string }) => s.codec_type === "video");
      if (Math.abs(Number(media.format.duration) - duration) > 0.15 || !video || Math.abs(video.width / video.height - 9 / 16) > 0.002 || media.streams.some((s: { codec_type: string }) => s.codec_type === "audio")) throw new Error("media_contract_failed");
      await copyFile(outputPath, deliveredPath);
      await writeFile(resolve(outputDir, "result.json"), JSON.stringify({ status: "generated_pending_visual_review", model: "bytedance/seedance-2.5", outputPath, deliveredPath, sha256: sha(bytes), media, telemetry: status.telemetry, generatedAt: new Date().toISOString() }, null, 2));
      console.info(JSON.stringify({ status: "downloaded_and_media_verified", outputPath, deliveredPath, media, telemetry: status.telemetry }, null, 2));
      return;
    }
    await delay(10_000);
  }
  throw new Error("poll_window_expired_resume_existing_operation_only");
}
main().catch(async (error) => {
  await secretJson("failure.json", { message: error instanceof Error ? error.message : String(error), at: new Date().toISOString() }).catch(() => undefined);
  console.error("Preview did not finish. Private recovery record saved; no automatic paid retry was submitted.");
  process.exitCode = 1;
});
