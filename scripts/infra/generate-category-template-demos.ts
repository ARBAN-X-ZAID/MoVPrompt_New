import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  CATEGORY_DEMO_TARGET_IDS,
  ENGINE_VERSION,
  LAUNCH_CREATIVE_TEMPLATE_CATALOG,
  compileCreativeDirection,
} from "../../packages/creative-engine/src/index.ts";
import { R2Storage, r2StorageConfigFromEnv } from "../../packages/storage/src/index.ts";

if (process.env.MOVPROMPT_CONFIRM_FIVE_CATEGORY_DEMOS !== "YES") {
  throw new Error("Set MOVPROMPT_CONFIRM_FIVE_CATEGORY_DEMOS=YES only for the explicitly approved five-video preview batch.");
}

const details: Record<(typeof CATEGORY_DEMO_TARGET_IDS)[number], { name: string; brand: string }> = {
  "premium-phone-reveal": { name: "Premium smartphone", brand: "Example electronics" },
  "restaurant-food-hero": { name: "Signature burger platter", brand: "Example restaurant" },
  "fashion-product-showcase": { name: "Premium everyday T-shirt", brand: "Example fashion" },
  "perfume-advertisement": { name: "Northfield No. 07 perfume", brand: "Northfield" },
  "real-estate-property": { name: "Contemporary Kuwait residence", brand: "Example property" },
};

const storage = new R2Storage(r2StorageConfigFromEnv());
if (!storage.previewsBucket) throw new Error("R2_TEMPLATE_PREVIEWS_BUCKET is required.");
await storage.checkBucket(storage.assetsBucket);
await storage.checkBucket(storage.previewsBucket);
await mkdir("artifacts/template-demos", { recursive: true });
await mkdir("docs/template-demos/videos/v1", { recursive: true });

const failures: string[] = [];
for (const id of CATEGORY_DEMO_TARGET_IDS) {
  const output = `docs/template-demos/videos/v1/${id}.mp4`;
  const dispatch = `artifacts/template-demos/${id}-v1-dispatched.json`;
  if (await Bun.file(output).exists()) {
    console.info(`${id}: completed preview already exists; no paid call.`);
    continue;
  }
  let attemptSuffix = "";
  if (await Bun.file(dispatch).exists()) {
    const previousLog = `artifacts/template-demos/${id}-v1-provider.json`;
    const previousFailure = await Bun.file(previousLog).text().catch(() => "");
    const retryApproved = process.env.MOVPROMPT_RETRY_UNCHARGED_CATEGORY_DEMOS === "YES";
    if (!retryApproved || !previousFailure.includes('"code": "insufficient_funds"')) {
      failures.push(`${id}: a prior paid dispatch exists without a completed preview; manual review is required.`);
      continue;
    }
    attemptSuffix = `-retry-${Date.now()}`;
  }

  const template = LAUNCH_CREATIVE_TEMPLATE_CATALOG.find((item) => item.id === id);
  if (!template) throw new Error(`Missing launch recipe: ${id}`);
  const source = `docs/template-demos/references/v1/${id}.jpg`;
  const sourceBody = await readFile(source);
  const sourceKey = `templates/references/v1/${id}.jpg`;
  const sourceChecksum = createHash("sha256").update(sourceBody).digest("hex");
  await storage.put({
    bucket: storage.assetsBucket,
    key: sourceKey,
    body: sourceBody,
    contentType: "image/jpeg",
    metadata: { "sha256-hex": sourceChecksum },
  });
  const signedSource = await storage.signDownload({ bucket: storage.assetsBucket, key: sourceKey, expiresInSeconds: 3600 });
  const product = details[id];
  const brief = {
    engineVersion: ENGINE_VERSION,
    templateId: id,
    templateRecipeVersion: template.versionNumber,
    templatePromptVersion: `${id}-v${template.versionNumber}`,
    templateVisualSystem: template.visualSystem,
    market: "KW" as const,
    language: "en" as const,
    arabicDialect: null,
    dialectRegister: template.dialectRegister,
    tone: template.tone,
    vertical: template.verticals[0]!,
    goal: template.goals[0]!,
    product: {
      name: product.name,
      brand: product.brand,
      description: "",
      price: "",
      offer: "",
      callToAction: template.scenes.at(-1)!.headline.en,
      whatsapp: "",
      location: "",
    },
    scenes: template.scenes,
    qualityPolicy: template.qualityPolicy,
  };
  const compiled = compileCreativeDirection({ rawPrompt: template.visualSystem, creativeBrief: brief, audioEnabled: false });
  const promptPath = `docs/template-demos/videos/v1/${id}-prompt.txt`;
  await writeFile(promptPath, compiled.prompt);
  const dispatchRecord = attemptSuffix ? `artifacts/template-demos/${id}-v1${attemptSuffix}-dispatched.json` : dispatch;
  await writeFile(dispatchRecord, JSON.stringify({
    id,
    dispatchedAt: new Date().toISOString(),
    promptVersion: brief.templatePromptVersion,
    model: "bytedance/seedance-2.5",
  }, null, 2), { flag: "wx", mode: 0o600 });

  console.info(`${id}: starting one paid 8-second Seedance 2.5 preview.`);
  const child = Bun.spawn(["bun", "run", "--cwd", "apps/worker", "gateway:video"], {
    env: {
      ...process.env,
      MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO: "YES",
      MOVPROMPT_GATEWAY_VIDEO_MODEL_ID: "bytedance/seedance-2.5",
      MOVPROMPT_GATEWAY_VIDEO_IMAGE_PATH: resolve(source),
      MOVPROMPT_GATEWAY_VIDEO_IMAGE_URL: signedSource.url,
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
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  const providerLog = `artifacts/template-demos/${id}-v1${attemptSuffix}-provider.json`;
  await writeFile(providerLog, `${stdout}\n${stderr}`, { mode: 0o600 });
  if (code !== 0) {
    failures.push(`${id}: provider call failed; inspect ${providerLog}. No paid retry was made.`);
    continue;
  }

  const metadata = JSON.parse(stdout);
  await copyFile(metadata.outputPath, output);
  const probe = Bun.spawn(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-show_entries", "stream=codec_name,width,height", "-of", "json", output], { stdout: "pipe", stderr: "pipe" });
  const [probeOut, probeErr, probeCode] = await Promise.all([new Response(probe.stdout).text(), new Response(probe.stderr).text(), probe.exited]);
  if (probeCode !== 0) throw new Error(`${id}: ffprobe validation failed: ${probeErr}`);

  const videoBody = await readFile(output);
  const videoChecksum = createHash("sha256").update(videoBody).digest("hex");
  const videoKey = `templates/v1/${id}.mp4`;
  await storage.put({ bucket: storage.previewsBucket, key: videoKey, body: videoBody, contentType: "video/mp4", metadata: { "sha256-hex": videoChecksum } });
  const signedVideo = await storage.signDownload({ bucket: storage.previewsBucket, key: videoKey });
  const response = await fetch(signedVideo.url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${id}: R2 verification returned HTTP ${response.status}`);
  const savedChecksum = createHash("sha256").update(new Uint8Array(await response.arrayBuffer())).digest("hex");
  if (savedChecksum !== videoChecksum) throw new Error(`${id}: R2 checksum mismatch`);

  await writeFile(`docs/template-demos/videos/v1/${id}.json`, JSON.stringify({
    templateId: id,
    recipeVersion: template.versionNumber,
    promptVersion: brief.templatePromptVersion,
    model: metadata.model,
    duration: template.durationSeconds,
    source: { bucket: storage.assetsBucket, key: sourceKey, checksum: sourceChecksum },
    video: output,
    r2: { bucket: storage.previewsBucket, key: videoKey, checksum: videoChecksum },
    prompt: promptPath,
    providerMetadata: providerLog,
    mediaProbe: JSON.parse(probeOut),
  }, null, 2));
  console.info(`${id}: validated, uploaded and verified ${videoKey}`);
}

if (failures.length) throw new Error(failures.join("\n"));
