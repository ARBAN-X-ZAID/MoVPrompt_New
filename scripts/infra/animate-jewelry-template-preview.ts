import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createCanvas, loadImage } from "../../apps/worker/node_modules/@napi-rs/canvas/index.js";
import { ENGINE_VERSION, compileCreativeDirection, getCreativeTemplate, resolveDurationRecipe } from "../../packages/creative-engine/src/index.ts";

// Local photo animation only. No AI/provider imports, network calls or audio inputs.
const sourcePath = process.argv[2] ?? "/Users/arbaanq/Downloads/gold.png";
const directory = "docs/template-demos/videos/v3";
const basename = "jewelry-product-showcase-animation";
const work = "artifacts/jewelry-animation-v3";
await mkdir(directory, { recursive: true });
await mkdir(work, { recursive: true });
const source = await loadImage(sourcePath);
if (source.width !== 941 || source.height !== 1672) throw new Error("The approved gold photo must be 941×1672 for these detail crops.");
const width = 720;
const height = 1280;
const fps = 30;
const template = getCreativeTemplate("jewelry-product-showcase");
const photos = [{ referenceRole: "subject" as const, mimeType: "image/png" }];
const variant = resolveDurationRecipe({ id: template.id, durationRecipes: template.durationRecipes!, duration: 8, photos });
const compiled = compileCreativeDirection({ rawPrompt: template.visualSystem, audioEnabled: false, aspectRatio: "9:16", references: photos, creativeBrief: {
  engineVersion: ENGINE_VERSION, templateId: template.id, templateRecipeVersion: template.versionNumber,
  templatePromptVersion: `${template.id}-v${template.versionNumber}`, templateVisualSystem: template.visualSystem,
  durationVariant: variant.id, market: "KW", language: "en", arabicDialect: null,
  dialectRegister: template.dialectRegister, tone: template.tone, vertical: template.verticals[0], goal: template.goals[0],
  product: { name: "Yellow-gold necklace, matching earrings and bracelet set", callToAction: "Discover the jewelry" },
  scenes: variant.scenes, qualityPolicy: template.qualityPolicy,
} });
await writeFile(`${directory}/${basename}-prompt.txt`, compiled.prompt);
const closingFrameHashes: string[] = [];
let matchingOpeningFrames = 0;
const canvas = createCanvas(width, height);
const context = canvas.getContext("2d");
const mask = createCanvas(source.width, source.height);
const maskContext = mask.getContext("2d");
maskContext.drawImage(source, 0, 0);
const pixels = maskContext.getImageData(0, 0, source.width, source.height);
for (let index = 0; index < pixels.data.length; index += 4) {
  const [red, green, blue] = [pixels.data[index]!, pixels.data[index + 1]!, pixels.data[index + 2]!];
  // Highlight only existing warm metal pixels, never draw new jewelry or sparkle.
  const gold = Math.max(0, Math.min(1, (green - blue - 12) / 60, (red - blue - 20) / 80));
  pixels.data[index] = 255;
  pixels.data[index + 1] = 255;
  pixels.data[index + 2] = 255;
  pixels.data[index + 3] = Math.round(gold * 255);
}
maskContext.putImageData(pixels, 0, 0);
const light = createCanvas(width, height);
const lightContext = light.getContext("2d");
const ease = (value: number) => { const x = Math.max(0, Math.min(1, value)); return x * x * (3 - 2 * x); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const shots = [
  { from: [385, 1040, 330], to: [445, 1090, 300], light: 0.18 },
  { from: [710, 815, 280], to: [633, 965, 300], light: 0.16 },
  { from: [485, 1030, 570], to: [463, 830, 900], light: 0.26 },
  { from: [463, 830, 900], to: [470.5, 836, 935], light: 0.30 },
];
for (let frame = 0; frame < fps * 8; frame++) {
  // Reuse the approved opening exactly when its source photo is unchanged.
  if (frame < fps * 4) {
    const previous = await readFile(`artifacts/jewelry-animation/frame-${String(frame).padStart(4, "0")}.png`).catch(() => null);
    const approvedSourceHash = "28be6ce118ee77bbb2a30e5a07acb4386089ca09a3e75a8bc9f0fed933876310";
    if (previous && createHash("sha256").update(await readFile(sourcePath)).digest("hex") === approvedSourceHash) {
      await writeFile(`${work}/frame-${String(frame).padStart(4, "0")}.png`, previous);
      matchingOpeningFrames++;
      if (frame % 60 === 0) console.info(`Preserved opening shot ${frame / 60 + 1} / 2`);
      continue;
    }
  }
  const time = frame / fps;
  const shotIndex = Math.min(3, Math.floor(time / 2));
  const shot = shots[shotIndex]!;
  const local = time - shotIndex * 2;
  // Keep the approved opening, but maintain visible camera velocity after 4s.
  const progress = shotIndex < 2 ? ease(local / 2) : local / 2;
  const centerX = lerp(shot.from[0]!, shot.to[0]!, progress);
  const centerY = lerp(shot.from[1]!, shot.to[1]!, progress);
  const cropWidth = lerp(shot.from[2]!, shot.to[2]!, progress);
  const cropHeight = cropWidth * height / width;
  const left = Math.max(0, Math.min(source.width - cropWidth, centerX - cropWidth / 2));
  const top = Math.max(0, Math.min(source.height - cropHeight, centerY - cropHeight / 2));
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, left, top, cropWidth, cropHeight, 0, 0, width, height);

  const vignette = context.createRadialGradient(width * 0.52, height * 0.50, 90, width * 0.5, height * 0.5, 820);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, `rgba(0,0,0,${shotIndex < 2 ? 0.48 : 0.24})`);
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);

  lightContext.globalCompositeOperation = "source-over";
  lightContext.clearRect(0, 0, width, height);
  lightContext.drawImage(mask, left, top, cropWidth, cropHeight, 0, 0, width, height);
  lightContext.globalCompositeOperation = "source-in";
  const sweep = lerp(-300, 1060, ease(local / 2));
  const band = lightContext.createLinearGradient(sweep - 210, 0, sweep + 210, height * 0.12);
  band.addColorStop(0, "rgba(255,248,226,0)");
  band.addColorStop(0.42, `rgba(255,248,226,${shot.light})`);
  band.addColorStop(0.58, `rgba(255,248,226,${shot.light})`);
  band.addColorStop(1, "rgba(255,248,226,0)");
  lightContext.fillStyle = band;
  lightContext.fillRect(0, 0, width, height);
  context.globalCompositeOperation = "screen";
  context.drawImage(light, 0, 0);
  context.globalCompositeOperation = "source-over";
  const frameBytes = canvas.toBuffer("image/png");
  const frameHash = createHash("sha256").update(frameBytes).digest("hex");
  if (frame >= fps * 4) closingFrameHashes.push(frameHash);
  else {
    const previous = await readFile(`artifacts/jewelry-animation/frame-${String(frame).padStart(4, "0")}.png`).catch(() => null);
    if (previous && createHash("sha256").update(previous).digest("hex") === frameHash) matchingOpeningFrames++;
  }
  await writeFile(`${work}/frame-${String(frame).padStart(4, "0")}.png`, frameBytes);
  if (frame % 60 === 0) console.info(`Rendered shot ${shotIndex + 1} / 4`);
}
if (new Set(closingFrameHashes).size !== fps * 4) throw new Error("The last four seconds contain repeated frozen frames.");
const outputPath = `${directory}/${basename}.mp4`;
const encode = Bun.spawn(["ffmpeg", "-v", "error", "-y", "-framerate", String(fps), "-i", `${work}/frame-%04d.png`, "-frames:v", "240", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outputPath], { stdout: "ignore", stderr: "pipe" });
const [code, error] = await Promise.all([encode.exited, new Response(encode.stderr).text()]);
if (code !== 0) throw new Error(error);
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const metadata = {
  templateId: template.id, recipeVersion: template.versionNumber, durationVariant: variant.id,
  rendering: "Local photo animation: Canvas + FFmpeg", providerCalls: 0, audioEnabled: false,
  durationSeconds: 8, width, height, fps, sourceFilename: "gold.png",
  sourceChecksum: sha256(await readFile(sourcePath)), outputChecksum: sha256(await readFile(outputPath)),
  shots: ["0–2s: unchanged macro detail glide and narrow metal highlight", "2–4s: unchanged adjacent gold-contour track", "4–6s: pronounced diagonal pullback progressively reveals the complete set", "6–8s: continuous diagonal camera drift, gentle pullback and moving metal highlight"],
  motionEvidence: { matchingOpeningFrames, uniqueClosingFrames: new Set(closingFrameHashes).size, expectedFramesPerSection: fps * 4 },
  prompt: `${directory}/${basename}-prompt.txt`,
  notes: "Every frame derives from the original photo. The supplied charcoal setting is retained; no unseen 3D surfaces or extra pieces are synthesized.",
  publication: "pending visual and media review", createdAt: new Date().toISOString(),
};
await writeFile(`${directory}/${basename}.json`, JSON.stringify(metadata, null, 2) + "\n");
console.info(JSON.stringify({ outputPath, ...metadata }, null, 2));
