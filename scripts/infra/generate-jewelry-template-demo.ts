import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ENGINE_VERSION, compileCreativeDirection, getCreativeTemplate, resolveDurationRecipe } from "../../packages/creative-engine/src/index.ts";
import { R2Storage, r2StorageConfigFromEnv } from "../../packages/storage/src/index.ts";

// One explicitly authorized preview, never a batch or an automatic paid retry.
const id = "jewelry-product-showcase";
const directory = "docs/template-demos/videos/v2";
const artifactDirectory = "artifacts/template-demos";
const outputPath = `${directory}/${id}.mp4`;
const dispatchPath = `${artifactDirectory}/${id}-v2-dispatched.json`;
const providerLogPath = `${artifactDirectory}/${id}-v2-provider.json`;
const sourcePath = `docs/template-demos/posters/v1/${id}.png`;
if (process.env.MOVPROMPT_CONFIRM_JEWELRY_DEMO !== "YES") throw new Error("Explicit authorization required: MOVPROMPT_CONFIRM_JEWELRY_DEMO=YES.");
if (await Bun.file(outputPath).exists() || await Bun.file(dispatchPath).exists()) {
  throw new Error("A jewelry preview or dispatch already exists. No paid retry is allowed by this script.");
}
const template = getCreativeTemplate(id);
const photos = [{ referenceRole: "subject" as const, mimeType: "image/png" }];
const variant = resolveDurationRecipe({ id, durationRecipes: template.durationRecipes!, duration: 8, photos });
const brief = {
  engineVersion: ENGINE_VERSION, templateId: id, templateRecipeVersion: template.versionNumber,
  templatePromptVersion: `${id}-v${template.versionNumber}`, templateVisualSystem: template.visualSystem,
  durationVariant: variant.id, market: "KW", language: "en", arabicDialect: null,
  dialectRegister: template.dialectRegister, tone: template.tone,
  vertical: template.verticals[0], goal: template.goals[0],
  product: { name: "Yellow-gold necklace, matching earrings and bracelet set", callToAction: "Discover the jewelry" },
  scenes: variant.scenes, qualityPolicy: template.qualityPolicy,
};
const compiled = compileCreativeDirection({ rawPrompt: template.visualSystem, creativeBrief: brief, references: photos, audioEnabled: false, aspectRatio: "9:16" });
if (compiled.prompt.length > 7_000) throw new Error("Jewelry prompt exceeds the validated template limit.");
const storage = new R2Storage(r2StorageConfigFromEnv());
if (!storage.previewsBucket) throw new Error("Existing template preview bucket configuration is required.");
await storage.checkBucket(storage.assetsBucket);
await storage.checkBucket(storage.previewsBucket);
const source = await readFile(sourcePath);
const checksum = (body: Uint8Array) => createHash("sha256").update(body).digest("hex");
const referenceKey = `templates/references/v2/${id}.png`;
await storage.put({ bucket: storage.assetsBucket, key: referenceKey, body: source, contentType: "image/png", metadata: { "sha256-hex": checksum(source) } });
const signed = await storage.signDownload({ bucket: storage.assetsBucket, key: referenceKey, expiresInSeconds: 3600 });
await mkdir(directory, { recursive: true });
await mkdir(artifactDirectory, { recursive: true });
await writeFile(`${directory}/${id}-prompt.txt`, compiled.prompt);
await writeFile(dispatchPath, JSON.stringify({ templateId: id, recipeVersion: template.versionNumber, durationVariant: variant.id, duration: 8, audioEnabled: false, authorizedCalls: 1, sourceChecksum: checksum(source), promptChecksum: checksum(Buffer.from(compiled.prompt)), dispatchedAt: new Date().toISOString() }, null, 2), { flag: "wx", mode: 0o600 });
console.info("Submitting the one authorized silent 8-second jewelry preview; automatic retries are disabled.");
const child = Bun.spawn(["bun", "run", "--cwd", "apps/worker", "gateway:video"], {
  env: {
    ...process.env,
    MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO: "YES", MOVPROMPT_GATEWAY_VIDEO_MODEL_ID: "bytedance/seedance-2.5",
    MOVPROMPT_GATEWAY_VIDEO_IMAGE_PATH: resolve(sourcePath), MOVPROMPT_GATEWAY_VIDEO_IMAGE_URL: signed.url,
    MOVPROMPT_GATEWAY_VIDEO_DURATION_SECONDS: "8", MOVPROMPT_GATEWAY_VIDEO_ASPECT_RATIO: "9:16",
    MOVPROMPT_GATEWAY_VIDEO_RESOLUTION_TIER: "720p", MOVPROMPT_GATEWAY_VIDEO_RESOLUTION: "720x1280",
    MOVPROMPT_GATEWAY_VIDEO_AUDIO: "off", MOVPROMPT_GATEWAY_VIDEO_PROMPT: compiled.prompt,
    MOVPROMPT_GATEWAY_VIDEO_TIMEOUT_MS: String(20 * 60_000),
  }, stdout: "pipe", stderr: "pipe",
});
const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
// Private logs may include expiring URLs. Never print them or commit them.
await writeFile(providerLogPath, `${stdout}\n${stderr}`, { mode: 0o600 });
if (code !== 0) throw new Error(`Provider request did not complete. Private diagnostics: ${providerLogPath}. No retry was made.`);
const metadata = JSON.parse(stdout);
await copyFile(metadata.outputPath, outputPath);
const probe = Bun.spawn(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-show_entries", "stream=codec_type,codec_name,width,height", "-of", "json", outputPath], { stdout: "pipe", stderr: "pipe" });
const [probeOut, probeCode] = await Promise.all([new Response(probe.stdout).text(), probe.exited]);
if (probeCode !== 0) throw new Error("Generated media probe failed; preview remains unpublished.");
const media = JSON.parse(probeOut);
const video = media.streams?.find((stream: { codec_type: string }) => stream.codec_type === "video");
if (Math.abs(Number(media.format?.duration) - 8) > 0.1 || video?.width !== 720 || video?.height !== 1280 || media.streams.some((stream: { codec_type: string }) => stream.codec_type === "audio")) {
  throw new Error("Output does not meet the silent 8-second 720x1280 contract; preview remains unpublished.");
}
await writeFile(`${directory}/${id}.json`, JSON.stringify({
  templateId: id, recipeVersion: template.versionNumber, durationVariant: variant.id,
  durationSeconds: 8, aspectRatio: "9:16", audioEnabled: false, model: metadata.model,
  source: { key: referenceKey, checksum: checksum(source) }, outputChecksum: checksum(await readFile(outputPath)),
  gatewayCredits: metadata.gatewayCredits, mediaProbe: media,
  visualReview: "pending", publication: "pending", generatedAt: new Date().toISOString(),
}, null, 2));
console.info(JSON.stringify({ status: "generated_pending_visual_review", outputPath, elapsedSeconds: metadata.elapsedSeconds, gatewayCredits: metadata.gatewayCredits, media }, null, 2));
