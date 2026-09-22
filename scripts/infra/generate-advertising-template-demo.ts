import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  ENGINE_VERSION,
  LAUNCH_CREATIVE_TEMPLATE_CATALOG,
  compileCreativeDirection,
} from "../../packages/creative-engine/src/index.ts";
import { VERIFIED_PREVIEW_TEMPLATE_IDS } from "../../packages/creative-engine/src/verified-preview-manifest.ts";
import { R2Storage, r2StorageConfigFromEnv } from "../../packages/storage/src/index.ts";

const TEMPLATE_ID = "new-york-billboard-takeover";
const VERSION = 1;
const referencePath = `docs/template-demos/references/v1/${TEMPLATE_ID}.png`;
const outputPath = `docs/template-demos/videos/v1/${TEMPLATE_ID}.mp4`;
const posterPath = `docs/template-demos/posters/v1/${TEMPLATE_ID}.jpg`;
const artifactDirectory = "artifacts/template-demos";
const baseDispatchPath = `${artifactDirectory}/${TEMPLATE_ID}-v${VERSION}-dispatched.json`;
const baseProviderLogPath = `${artifactDirectory}/${TEMPLATE_ID}-v${VERSION}-provider.json`;
const previewManifestPath = "packages/creative-engine/src/verified-preview-manifest.ts";

if (process.env.MOVPROMPT_CONFIRM_ADVERTISING_DEMO !== "YES") {
  throw new Error("Set MOVPROMPT_CONFIRM_ADVERTISING_DEMO=YES only for the explicitly approved single advertising preview.");
}
if (await Bun.file(outputPath).exists()) {
  throw new Error(`${TEMPLATE_ID}: completed preview already exists; no paid call was made.`);
}
let attemptSuffix = "";
if (await Bun.file(baseDispatchPath).exists()) {
  const priorFailure = await Bun.file(baseProviderLogPath).text().catch(() => "");
  const explicitlyAuthorizedUnchargedRetry = process.env.MOVPROMPT_RETRY_UNCHARGED_ADVERTISING_DEMO === "YES";
  if (!priorFailure.includes('"code": "insufficient_funds"') || !explicitlyAuthorizedUnchargedRetry) {
    throw new Error(`${TEMPLATE_ID}: a prior dispatch exists. Only a separately authorized, previously uncharged insufficient-funds retry may continue.`);
  }
  attemptSuffix = `-retry-${Date.now()}`;
}
const dispatchPath = `${artifactDirectory}/${TEMPLATE_ID}-v${VERSION}${attemptSuffix}-dispatched.json`;
const providerLogPath = `${artifactDirectory}/${TEMPLATE_ID}-v${VERSION}${attemptSuffix}-provider.json`;

const template = LAUNCH_CREATIVE_TEMPLATE_CATALOG.find((item) => item.id === TEMPLATE_ID);
if (!template) throw new Error(`Missing launch recipe: ${TEMPLATE_ID}`);

const storage = new R2Storage(r2StorageConfigFromEnv());
if (!storage.previewsBucket) throw new Error("R2_TEMPLATE_PREVIEWS_BUCKET is required.");
await storage.checkBucket(storage.assetsBucket);
await storage.checkBucket(storage.previewsBucket);
await mkdir(artifactDirectory, { recursive: true });
await mkdir("docs/template-demos/videos/v1", { recursive: true });
await mkdir("docs/template-demos/posters/v1", { recursive: true });

const referenceBody = await readFile(referencePath);
const referenceKey = `templates/references/v1/${TEMPLATE_ID}.png`;
const referenceChecksum = createHash("sha256").update(referenceBody).digest("hex");
await storage.put({
  bucket: storage.assetsBucket,
  key: referenceKey,
  body: referenceBody,
  contentType: "image/png",
  metadata: { "sha256-hex": referenceChecksum },
});
const signedReference = await storage.signDownload({ bucket: storage.assetsBucket, key: referenceKey, expiresInSeconds: 3600 });

const brief = {
  engineVersion: ENGINE_VERSION,
  templateId: TEMPLATE_ID,
  templateRecipeVersion: template.versionNumber,
  templatePromptVersion: `${TEMPLATE_ID}-v${template.versionNumber}`,
  templateVisualSystem: template.visualSystem,
  market: "KW" as const,
  language: "en" as const,
  arabicDialect: null,
  dialectRegister: template.dialectRegister,
  tone: template.tone,
  vertical: template.verticals[0]!,
  goal: template.goals[0]!,
  product: {
    name: "MovPrompt brand artwork",
    brand: "MovPrompt",
    description: "Neutral demonstration artwork for the New York billboard template",
    price: "",
    offer: "",
    callToAction: "Create your campaign",
    whatsapp: "",
    location: "",
  },
  scenes: template.scenes,
  qualityPolicy: template.qualityPolicy,
};
const compiled = compileCreativeDirection({ rawPrompt: template.visualSystem, creativeBrief: brief, audioEnabled: false });
const promptPath = `docs/template-demos/videos/v1/${TEMPLATE_ID}-prompt.txt`;
await writeFile(promptPath, compiled.prompt);
await writeFile(dispatchPath, JSON.stringify({
  templateId: TEMPLATE_ID,
  dispatchedAt: new Date().toISOString(),
  promptVersion: brief.templatePromptVersion,
  model: "bytedance/seedance-2.5",
  authorizedCalls: 1,
}, null, 2), { flag: "wx", mode: 0o600 });

console.info(`${TEMPLATE_ID}: starting the one authorized paid 8-second Seedance 2.5 preview.`);
const child = Bun.spawn(["bun", "run", "--cwd", "apps/worker", "gateway:video"], {
  env: {
    ...process.env,
    MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO: "YES",
    MOVPROMPT_GATEWAY_VIDEO_MODEL_ID: "bytedance/seedance-2.5",
    MOVPROMPT_GATEWAY_VIDEO_IMAGE_PATH: resolve(referencePath),
    MOVPROMPT_GATEWAY_VIDEO_IMAGE_URL: signedReference.url,
    MOVPROMPT_GATEWAY_VIDEO_DURATION_SECONDS: "8",
    MOVPROMPT_GATEWAY_VIDEO_ASPECT_RATIO: "9:16",
    MOVPROMPT_GATEWAY_VIDEO_RESOLUTION_TIER: "720p",
    MOVPROMPT_GATEWAY_VIDEO_RESOLUTION: "720x1280",
    MOVPROMPT_GATEWAY_VIDEO_PROMPT: compiled.prompt,
    MOVPROMPT_GATEWAY_VIDEO_TIMEOUT_MS: String(20 * 60_000),
  },
  stdout: "pipe",
  stderr: "pipe",
});
const [stdout, stderr, exitCode] = await Promise.all([
  new Response(child.stdout).text(),
  new Response(child.stderr).text(),
  child.exited,
]);
await writeFile(providerLogPath, `${stdout}\n${stderr}`, { mode: 0o600 });
if (exitCode !== 0) {
  throw new Error(`${TEMPLATE_ID}: provider request failed. Inspect ${providerLogPath}; no retry was attempted.`);
}

const metadata = JSON.parse(stdout);
await copyFile(metadata.outputPath, outputPath);
const probe = Bun.spawn([
  "ffprobe", "-v", "error", "-show_entries", "format=duration",
  "-show_entries", "stream=codec_name,width,height", "-of", "json", outputPath,
], { stdout: "pipe", stderr: "pipe" });
const [probeOut, probeErr, probeCode] = await Promise.all([
  new Response(probe.stdout).text(),
  new Response(probe.stderr).text(),
  probe.exited,
]);
if (probeCode !== 0) throw new Error(`${TEMPLATE_ID}: ffprobe validation failed: ${probeErr}`);
const probeData = JSON.parse(probeOut);
const duration = Number(probeData.format?.duration ?? 0);
const videoStream = probeData.streams?.find((stream: { codec_name?: string }) => stream.codec_name);
if (duration < 7.5 || duration > 8.5 || videoStream?.width !== 720 || videoStream?.height !== 1280) {
  throw new Error(`${TEMPLATE_ID}: generated media does not match the approved 8-second 720x1280 contract.`);
}

const poster = Bun.spawn([
  "ffmpeg", "-y", "-ss", "1", "-i", outputPath, "-frames:v", "1", "-q:v", "2", posterPath,
], { stdout: "ignore", stderr: "pipe" });
const posterError = new Response(poster.stderr).text();
if (await poster.exited !== 0) throw new Error(`${TEMPLATE_ID}: poster extraction failed: ${await posterError}`);

const objects = [
  { path: outputPath, key: `templates/v1/${TEMPLATE_ID}.mp4`, contentType: "video/mp4" },
  { path: posterPath, key: `templates/v1/${TEMPLATE_ID}.jpg`, contentType: "image/jpeg" },
];
const verifiedObjects = [];
for (const object of objects) {
  const body = await readFile(object.path);
  const checksum = createHash("sha256").update(body).digest("hex");
  await storage.put({
    bucket: storage.previewsBucket,
    key: object.key,
    body,
    contentType: object.contentType,
    metadata: { "sha256-hex": checksum },
  });
  const signed = await storage.signDownload({ bucket: storage.previewsBucket, key: object.key });
  const response = await fetch(signed.url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${TEMPLATE_ID}: R2 verification returned HTTP ${response.status} for ${object.key}`);
  const savedChecksum = createHash("sha256").update(new Uint8Array(await response.arrayBuffer())).digest("hex");
  if (savedChecksum !== checksum) throw new Error(`${TEMPLATE_ID}: R2 checksum mismatch for ${object.key}`);
  verifiedObjects.push({ ...object, checksum });
}

await writeFile(`docs/template-demos/videos/v1/${TEMPLATE_ID}.json`, JSON.stringify({
  templateId: TEMPLATE_ID,
  recipeVersion: template.versionNumber,
  promptVersion: brief.templatePromptVersion,
  model: metadata.model,
  source: { bucket: storage.assetsBucket, key: referenceKey, checksum: referenceChecksum },
  objects: verifiedObjects.map(({ key, contentType, checksum }) => ({ bucket: storage.previewsBucket, key, contentType, checksum })),
  prompt: promptPath,
  providerMetadata: providerLogPath,
  mediaProbe: probeData,
  manualReviewRequired: ["uploaded artwork fidelity", "absence of readable third-party branding", "anonymous natural crowd"],
}, null, 2));
const verifiedPreviewIds = VERIFIED_PREVIEW_TEMPLATE_IDS.includes(TEMPLATE_ID)
  ? [...VERIFIED_PREVIEW_TEMPLATE_IDS]
  : [...VERIFIED_PREVIEW_TEMPLATE_IDS, TEMPLATE_ID];
await writeFile(previewManifestPath, `/**\n * Generated activation manifest for previews that exist in R2 and passed\n * media plus checksum verification. The paid demo script adds a new entry\n * only after both its MP4 and poster have been read back successfully.\n */\nexport const VERIFIED_PREVIEW_TEMPLATE_IDS = [\n${verifiedPreviewIds.map((id) => `  "${id}",`).join("\n")}\n] as const;\n`);
console.info(`${TEMPLATE_ID}: generated, validated, uploaded and checksum-verified. Manual visual review remains required.`);
