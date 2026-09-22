import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createCanvas, GlobalFonts, loadImage } from "../../apps/worker/node_modules/@napi-rs/canvas/index.js";
import { generateText } from "../../apps/worker/node_modules/ai/dist/index.js";
import {
  ENGINE_VERSION,
  LAUNCH_CREATIVE_TEMPLATE_CATALOG,
  compileCreativeDirection,
} from "../../packages/creative-engine/src/index.ts";
import { R2Storage, r2StorageConfigFromEnv } from "../../packages/storage/src/index.ts";
import {
  LIBRARY_PREVIEW_IMAGE_PROMPTS,
  LIBRARY_PREVIEW_TEMPLATE_IDS,
  REMAINDER_PREVIEW_IMAGE_PROMPTS,
  REMAINDER_PREVIEW_TEMPLATE_IDS,
} from "./library-preview-image-prompts.ts";

if (process.env.MOVPROMPT_CONFIRM_LIBRARY_PREVIEWS !== "YES") {
  throw new Error("Set MOVPROMPT_CONFIRM_LIBRARY_PREVIEWS=YES only for the approved four-template preview batch.");
}

const imageModelId = process.env.MOVPROMPT_LIBRARY_IMAGE_MODEL?.trim() || "google/gemini-3.1-flash-image";
const outputDir = "docs/template-demos/library-previews";
const dispatchDir = "artifacts/library-previews";
const manifestPath = "packages/creative-engine/src/verified-preview-manifest.ts";
const perfumeVideoRegen = process.env.MOVPROMPT_REGENERATE_PERFUME_VIDEO === "YES";
const generateRemainder = process.env.MOVPROMPT_GENERATE_REMAINDER_PREVIEWS === "YES";
const cardRefresh = process.env.MOVPROMPT_REGENERATE_CARD_PREVIEWS === "YES";
const batchIds = cardRefresh
  ? ["business-service-promotion", "perfume-advertisement"] as const
  : generateRemainder || perfumeVideoRegen
    ? [
        ...(generateRemainder ? REMAINDER_PREVIEW_TEMPLATE_IDS : []),
        ...(perfumeVideoRegen ? ["perfume-advertisement"] as const : []),
      ]
    : [...LIBRARY_PREVIEW_TEMPLATE_IDS];
const imagePrompts: Record<string, string> = {
  ...LIBRARY_PREVIEW_IMAGE_PROMPTS,
  ...REMAINDER_PREVIEW_IMAGE_PROMPTS,
};
const details: Record<string, { name: string; brand: string }> = {
  "fashion-product-showcase": { name: "Preview shirt", brand: "Example fashion" },
  "restaurant-food-hero": { name: "Preview dish", brand: "Example restaurant" },
  "female-product-review": { name: "Preview product", brand: "Example brand" },
  "perfume-advertisement": { name: "MOV perfume", brand: "MOV" },
  "phone-floating-ad": { name: "Preview phone", brand: "Example electronics" },
  "food-delivery-ad": { name: "Preview meal", brand: "Example restaurant" },
  "luxury-fashion-reveal": { name: "Preview piece", brand: "Example fashion" },
  "cosmetic-product-commercial": { name: "Preview cosmetic", brand: "Example beauty" },
  "real-estate-property": { name: "Preview property", brand: "Example property" },
  "business-service-promotion": { name: "MovPrompt", brand: "MovPrompt" },
};
const launchPreviewOrder = [
  "premium-phone-reveal",
  "phone-floating-ad",
  "restaurant-food-hero",
  "food-delivery-ad",
  "fashion-product-showcase",
  "luxury-fashion-reveal",
  "cosmetic-product-commercial",
  "perfume-advertisement",
  "female-product-review",
  "real-estate-property",
  "business-service-promotion",
  "new-york-billboard-takeover",
] as const;
const baseVerifiedIds = new Set([
  "premium-phone-reveal",
  "restaurant-food-hero",
  "fashion-product-showcase",
  "perfume-advertisement",
  "female-product-review",
  "new-york-billboard-takeover",
]);

async function compositeMovPrompt(stillPath: string): Promise<void> {
  const fontPath = "/System/Library/Fonts/Supplemental/Arial.ttf";
  if (!GlobalFonts.registerFromPath(fontPath, "MovPrompt Card")) {
    throw new Error("MovPrompt card font is unavailable.");
  }
  const image = await loadImage(stillPath);
  const canvas = createCanvas(720, 1280);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, 720, 1280);
  const panelWidth = 420;
  const panelHeight = 92;
  const left = (720 - panelWidth) / 2;
  const top = 1280 - 420;
  context.fillStyle = "rgba(17,17,19,0.82)";
  context.fillRect(left, top, panelWidth, panelHeight);
  const markSize = 36;
  const markX = left + 28;
  const markY = top + 28;
  const scale = markSize / 32;
  context.fillStyle = "#E89B3C";
  context.beginPath();
  context.moveTo(markX + 16 * scale, markY + 2 * scale);
  context.lineTo(markX + 30 * scale, markY + 2 * scale);
  context.lineTo(markX + 2 * scale, markY + 30 * scale);
  context.closePath();
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = `600 36px "MovPrompt Card"`;
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText("MovPrompt", markX + markSize + 16, top + panelHeight / 2);
  await writeFile(stillPath, canvas.toBuffer("image/jpeg", 90));
}

function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/https?:\/\/\S+/g, "[url]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 500);
}

function redact(text: string): string {
  return text.replace(/https?:\/\/[^\s"']+/g, "[redacted-url]");
}

async function run(command: string[], label: string): Promise<string> {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(`${label} failed: ${redact(stderr || stdout).slice(0, 500)}`);
  return stdout;
}

const storage = new R2Storage(r2StorageConfigFromEnv());
if (!storage.previewsBucket) throw new Error("R2_TEMPLATE_PREVIEWS_BUCKET is required.");
await storage.checkBucket(storage.assetsBucket);
await storage.checkBucket(storage.previewsBucket);
await mkdir(outputDir, { recursive: true });
await mkdir(dispatchDir, { recursive: true });
await run(["ffmpeg", "-version"], "ffmpeg");
await run(["ffprobe", "-version"], "ffprobe");

for (const id of batchIds) {
  const template = LAUNCH_CREATIVE_TEMPLATE_CATALOG.find((item) => item.id === id);
  if (!template) throw new Error(`Missing launch recipe: ${id}`);
  const compiled = compileCreativeDirection({
    rawPrompt: template.visualSystem,
    audioEnabled: false,
    aspectRatio: "9:16",
    creativeBrief: {
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
        name: details[id].name,
        brand: details[id].brand,
        description: "",
        price: "",
        offer: "",
        callToAction: template.scenes.at(-1)!.headline.en,
        whatsapp: "",
        location: "",
      },
      scenes: template.scenes,
      qualityPolicy: template.qualityPolicy,
    },
  });
  if (compiled.prompt.length > 8_000) throw new Error(`${id}: compiled prompt is ${compiled.prompt.length} characters.`);
}

const failures: string[] = [];
for (const id of batchIds) {
  const completePath = `${outputDir}/${id}.complete.json`;
  const perfumeRegen = id === "perfume-advertisement" && perfumeVideoRegen;
  const perfumeFruit = cardRefresh && id === "perfume-advertisement";
  const businessCard = cardRefresh && id === "business-service-promotion";
  if (await Bun.file(completePath).exists() && !perfumeRegen && !perfumeFruit && !businessCard) {
    console.info(`${id}: completed preview already exists; no paid call.`);
    continue;
  }

  const sourcePath = `${outputDir}/${id}.source`;
  const stillPath = `${outputDir}/${id}.jpg`;
  const videoPath = `${outputDir}/${id}.mp4`;
  const promptPath = `${outputDir}/${id}-prompt.txt`;
  const imageDispatch = businessCard
    ? `${dispatchDir}/${id}-image-movprompt-dispatched.json`
    : `${dispatchDir}/${id}-image-dispatched.json`;
  const videoDispatch = `${dispatchDir}/${id}-video-dispatched.json`;

  try {
    const providerLogPath = `${dispatchDir}/${id}-provider.json`;
    const personImageDispatch = `${dispatchDir}/${id}-image-stylized-dispatched.json`;
    const priorProviderLog = await Bun.file(providerLogPath).text().catch(() => "");
    const personRetry = id === "female-product-review"
      && process.env.MOVPROMPT_RETRY_LIBRARY_PERSON === "YES"
      && priorProviderLog.includes("real person")
      && !(await Bun.file(personImageDispatch).exists());
    if (personRetry) {
      await writeFile(personImageDispatch, JSON.stringify({
        id,
        model: imageModelId,
        reason: "seedance_rejected_photoreal_person",
        dispatchedAt: new Date().toISOString(),
      }, null, 2), { flag: "wx", mode: 0o600 });
      console.info(`${id}: starting one stylized still after Seedance rejected the photoreal presenter.`);
      const result = await generateText({
        model: imageModelId,
        prompt: `PREVIEW STILL: no customer photo is attached. Create one premium example product with no readable brand, logo, or screen text.\n\n${imagePrompts[id]}\n\nPREVIEW CONSTRAINT: the presenter is a stylized 3D character with simplified features, not a photograph of a real person. No photoreal skin and no likeness of any real individual.`,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(3 * 60_000),
        providerOptions: {
          gateway: {
            user: "movprompt-library-preview",
            tags: ["app:movprompt", "env:local", "purpose:template-preview-still"],
          },
        },
      });
      const image = result.files.find((file) => file.mediaType.startsWith("image/"));
      if (!image?.uint8Array.byteLength) throw new Error(`${id}: stylized still returned no image. No further retry.`);
      await writeFile(sourcePath, image.uint8Array);
      await Bun.file(stillPath).delete().catch(() => undefined);
    }

    if (businessCard && !(await Bun.file(imageDispatch).exists())) {
      const archivedSource = `${outputDir}/${id}.previous.source`;
      if (await Bun.file(sourcePath).exists() && !(await Bun.file(archivedSource).exists())) {
        await copyFile(sourcePath, archivedSource);
      }
      await Bun.file(sourcePath).delete().catch(() => undefined);
      await Bun.file(stillPath).delete().catch(() => undefined);
      await Bun.file(`${outputDir}/${id}.movprompt-composited`).delete().catch(() => undefined);
    }

    if (!(await Bun.file(sourcePath).exists())) {
      if (await Bun.file(imageDispatch).exists()) {
        throw new Error(`${id}: an image call was already dispatched without a saved still. No automatic retry.`);
      }
      const libraryPrompt = imagePrompts[id];
      const prompt = businessCard
        ? "PREVIEW STILL: no customer photo is attached. Create one clean professional service frame in a modern studio, with a calm center and empty lower space. No people, no faces, no letters, no numbers, no logos, no watermarks, and no signage."
        : id === "perfume-advertisement"
          ? libraryPrompt
          : `PREVIEW STILL: no customer photo is attached. Create one premium example subject for the template card, then follow the scene, lighting, and composition below. Do not add prices, captions, or watermarks.\n\n${libraryPrompt}`;
      await writeFile(imageDispatch, JSON.stringify({
        id,
        model: imageModelId,
        dispatchedAt: new Date().toISOString(),
      }, null, 2), { flag: "wx", mode: 0o600 });
      console.info(`${id}: starting one paid still.`);
      const result = await generateText({
        model: imageModelId,
        prompt,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(3 * 60_000),
        providerOptions: {
          gateway: {
            user: "movprompt-library-preview",
            tags: ["app:movprompt", "env:local", "purpose:template-preview-still"],
          },
        },
      });
      const image = result.files.find((file) => file.mediaType.startsWith("image/"));
      if (!image?.uint8Array.byteLength) {
        throw new Error(`${id}: image model returned no image file. No automatic retry.`);
      }
      await writeFile(sourcePath, image.uint8Array);
    }

    if (!(await Bun.file(stillPath).exists())) {
      await run([
        "ffmpeg", "-y", "-i", sourcePath,
        "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280",
        "-q:v", "2", stillPath,
      ], `${id} still normalize`);
    }
    const compositedMarker = `${outputDir}/${id}.movprompt-composited`;
    if (businessCard && !(await Bun.file(compositedMarker).exists())) {
      await compositeMovPrompt(stillPath);
      await writeFile(compositedMarker, new Date().toISOString(), { mode: 0o600 });
    }

    const template = LAUNCH_CREATIVE_TEMPLATE_CATALOG.find((item) => item.id === id)!;
    const stillBody = await readFile(stillPath);
    const stillChecksum = createHash("sha256").update(stillBody).digest("hex");
    const referenceKey = `templates/references/library-v1/${id}.jpg`;
    await storage.put({
      bucket: storage.assetsBucket,
      key: referenceKey,
      body: stillBody,
      contentType: "image/jpeg",
      metadata: { "sha256-hex": stillChecksum },
    });
    const signedSource = await storage.signDownload({
      bucket: storage.assetsBucket,
      key: referenceKey,
      expiresInSeconds: 3600,
    });
    const compiled = compileCreativeDirection({
      rawPrompt: template.visualSystem,
      audioEnabled: false,
      aspectRatio: "9:16",
      creativeBrief: {
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
          name: details[id].name,
          brand: details[id].brand,
          description: "",
          price: "",
          offer: "",
          callToAction: template.scenes.at(-1)!.headline.en,
          whatsapp: "",
          location: "",
        },
        scenes: template.scenes,
        qualityPolicy: template.qualityPolicy,
      },
    });
    const previewCardLine = businessCard
      ? "\n\nPREVIEW CARD: the supplied still already shows the MovPrompt mark and the exact word MovPrompt. Keep both unchanged. Do not erase them and do not add any other words."
      : "";
    const videoPrompt = `${compiled.prompt}${previewCardLine}`;
    if (videoPrompt.length > 8_000) throw new Error(`${id}: compiled prompt is ${videoPrompt.length} characters.`);
    await writeFile(promptPath, videoPrompt);

    const regenDispatch = `${dispatchDir}/${id}-video-regen-dispatched.json`;
    if (perfumeRegen) {
      if (await Bun.file(regenDispatch).exists()) {
        throw new Error(`${id}: perfume video regeneration was already dispatched. No further retry.`);
      }
      const previousPath = `${outputDir}/${id}.previous.mp4`;
      if (await Bun.file(videoPath).exists() && !(await Bun.file(previousPath).exists())) {
        await copyFile(videoPath, previousPath);
      }
      await Bun.file(videoPath).delete().catch(() => undefined);
      await Bun.file(completePath).delete().catch(() => undefined);
    }
    const cardVideoDispatch = perfumeFruit
      ? `${dispatchDir}/${id}-video-fruit-dispatched.json`
      : businessCard
        ? `${dispatchDir}/${id}-video-movprompt-dispatched.json`
        : "";
    if (cardVideoDispatch) {
      if (await Bun.file(cardVideoDispatch).exists()) {
        throw new Error(`${id}: this preview video was already dispatched. No further retry.`);
      }
      const archivePath = `${outputDir}/${id}.${perfumeFruit ? "before-fruit" : "before-movprompt"}.mp4`;
      if (await Bun.file(videoPath).exists() && !(await Bun.file(archivePath).exists())) {
        await copyFile(videoPath, archivePath);
      }
      await Bun.file(videoPath).delete().catch(() => undefined);
      await Bun.file(completePath).delete().catch(() => undefined);
    }

    if (!(await Bun.file(videoPath).exists())) {
      const retryDispatch = `${dispatchDir}/${id}-video-muted-dispatched.json`;
      const personVideoDispatch = `${dispatchDir}/${id}-video-stylized-dispatched.json`;
      const firstDispatched = await Bun.file(videoDispatch).exists();
      const providerLog = await Bun.file(providerLogPath).text().catch(() => "");
      const forcedVideo = perfumeRegen || cardVideoDispatch !== "";
      const mutedRetry = !forcedVideo
        && firstDispatched
        && process.env.MOVPROMPT_RETRY_LIBRARY_AUDIO === "YES"
        && providerLog.includes("copyright restrictions");
      const stylizedVideoRetry = !forcedVideo
        && firstDispatched
        && process.env.MOVPROMPT_RETRY_LIBRARY_PERSON === "YES"
        && providerLog.includes("real person")
        && !(await Bun.file(personVideoDispatch).exists());
      if (!forcedVideo && firstDispatched && !mutedRetry && !stylizedVideoRetry) {
        throw new Error(`${id}: a video call was already dispatched without a saved MP4. No automatic retry.`);
      }
      if (mutedRetry && await Bun.file(retryDispatch).exists()) {
        throw new Error(`${id}: the muted video retry was already dispatched. No further retry.`);
      }
      const dispatchPath = cardVideoDispatch || (perfumeRegen ? regenDispatch : stylizedVideoRetry ? personVideoDispatch : mutedRetry ? retryDispatch : videoDispatch);
      await writeFile(dispatchPath, JSON.stringify({
        id,
        model: "bytedance/seedance-2.5",
        audio: "off",
        dispatchedAt: new Date().toISOString(),
      }, null, 2), { flag: "wx", mode: 0o600 });
      console.info(`${id}: starting one paid 8-second Seedance 2.5 preview.`);
      const child = Bun.spawn(["bun", "run", "--cwd", "apps/worker", "gateway:video"], {
        env: {
          ...process.env,
          MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO: "YES",
          MOVPROMPT_GATEWAY_VIDEO_AUDIO: "off",
          MOVPROMPT_GATEWAY_VIDEO_MODEL_ID: "bytedance/seedance-2.5",
          MOVPROMPT_GATEWAY_VIDEO_IMAGE_PATH: resolve(stillPath),
          MOVPROMPT_GATEWAY_VIDEO_IMAGE_URL: signedSource.url,
          MOVPROMPT_GATEWAY_VIDEO_DURATION_SECONDS: "8",
          MOVPROMPT_GATEWAY_VIDEO_ASPECT_RATIO: "9:16",
          MOVPROMPT_GATEWAY_VIDEO_RESOLUTION_TIER: "720p",
          MOVPROMPT_GATEWAY_VIDEO_RESOLUTION: "720x1280",
          MOVPROMPT_GATEWAY_VIDEO_PROMPT: videoPrompt,
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
      await writeFile(`${dispatchDir}/${id}-provider.json`, redact(`${stdout}\n${stderr}`), { mode: 0o600 });
      if (code !== 0) throw new Error(`${id}: Seedance call failed. No automatic retry.`);
      const metadata = JSON.parse(stdout) as { outputPath?: string };
      if (!metadata.outputPath) throw new Error(`${id}: Seedance returned no output path.`);
      await copyFile(metadata.outputPath, videoPath);
    }

    const probeOut = await run([
      "ffprobe", "-v", "error",
      "-show_entries", "format=duration:stream=codec_name,width,height",
      "-of", "json", videoPath,
    ], `${id} ffprobe`);
    const probe = JSON.parse(probeOut) as {
      format?: { duration?: string };
      streams?: Array<{ codec_name?: string; width?: number; height?: number }>;
    };
    const duration = Number(probe.format?.duration ?? 0);
    const videoStream = probe.streams?.find((stream) => stream.codec_name === "h264");
    if (duration < 7.5 || duration > 8.5 || videoStream?.width !== 720 || videoStream?.height !== 1280) {
      throw new Error(`${id}: media is not an 8-second 720x1280 video.`);
    }

    const videoBody = await readFile(videoPath);
    const videoChecksum = createHash("sha256").update(videoBody).digest("hex");
    const objects = [
      { body: stillBody, key: `templates/v1/${id}.jpg`, contentType: "image/jpeg", checksum: stillChecksum },
      { body: videoBody, key: `templates/v1/${id}.mp4`, contentType: "video/mp4", checksum: videoChecksum },
    ];
    for (const object of objects) {
      await storage.put({
        bucket: storage.previewsBucket,
        key: object.key,
        body: object.body,
        contentType: object.contentType,
        metadata: { "sha256-hex": object.checksum },
      });
      const saved = await storage.get({
        bucket: storage.previewsBucket,
        key: object.key,
        maxBytes: 32 * 1024 * 1024,
      });
      const savedChecksum = createHash("sha256").update(saved.body).digest("hex");
      if (savedChecksum !== object.checksum) throw new Error(`${id}: R2 checksum mismatch for ${object.key}`);
    }

    await writeFile(completePath, JSON.stringify({
      templateId: id,
      recipeVersion: template.versionNumber,
      imageModel: imageModelId,
      videoModel: "bytedance/seedance-2.5",
      still: stillPath,
      video: videoPath,
      prompt: promptPath,
      reference: { bucket: storage.assetsBucket, key: referenceKey, checksum: stillChecksum },
      r2: objects.map(({ key, contentType, checksum }) => ({
        bucket: storage.previewsBucket,
        key,
        contentType,
        checksum,
      })),
      mediaProbe: probe,
    }, null, 2));
    console.info(`${id}: validated and uploaded templates/v1/${id}.mp4`);
  } catch (error) {
    failures.push(publicError(error));
    console.error(publicError(error));
  }
}

const verifiedIds = [];
for (const id of launchPreviewOrder) {
  const remainderComplete = !baseVerifiedIds.has(id) && await Bun.file(`${outputDir}/${id}.complete.json`).exists();
  if (baseVerifiedIds.has(id) || remainderComplete) verifiedIds.push(id);
}
if (generateRemainder || perfumeVideoRegen) {
  await writeFile(manifestPath, `/**
 * Generated activation manifest for previews that exist in R2 and passed
 * media plus checksum verification. The paid demo script adds a new entry
 * only after both its MP4 and poster have been read back successfully.
 */
export const VERIFIED_PREVIEW_TEMPLATE_IDS = [
${verifiedIds.map((id) => `  "${id}",`).join("\n")}
] as const;
`);
  console.info(`Verified preview manifest now lists ${verifiedIds.length} templates.`);
}

if (failures.length) throw new Error(failures.join("\n"));
