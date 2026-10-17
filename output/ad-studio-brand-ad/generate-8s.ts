import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { createCanvas } from "../../apps/worker/node_modules/@napi-rs/canvas/index.js";
import { TemplateCampaignPayloadSchema, type AdStudioBrandAdSettings } from "../../apps/worker/node_modules/@movprompt/contracts/dist/index.js";
import { CreativeBriefSchema, compileTemplatePrompt } from "../../apps/worker/node_modules/@movprompt/creative-engine/dist/index.js";
import { adStudioBrandAdFixture } from "../../apps/api/src/ad-studio-brand-ad.test-fixture.ts";
import { modelAdLayers } from "../../apps/worker/src/product-model-ad-finishing.ts";
import { normalizeDeliveryMp4 } from "../../apps/worker/src/output-persister.ts";
import { createVercelGatewaySeedanceAdapter } from "../../packages/providers/src/vercel-gateway-seedance.ts";

const exec = promisify(execFile);
const dir = import.meta.dir;
const privateDir = resolve(dir, "../../artifacts/ad-studio-brand-ad-seedance1-8s-2026-10-16");
const MODEL = "bytedance/seedance-v1.0-pro-fast";
const sha = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const record = (name: string, data: unknown) => writeFile(resolve(privateDir, name), JSON.stringify(data, null, 2), { mode: 0o600 });

function logoPng(): Uint8Array {
  const canvas = createCanvas(400, 400);
  const context = canvas.getContext("2d");
  context.fillStyle = "#5c1a24"; context.beginPath(); context.arc(200, 200, 190, 0, Math.PI * 2); context.fill();
  context.strokeStyle = "#c9a25b"; context.lineWidth = 10; context.beginPath(); context.arc(200, 200, 160, 0, Math.PI * 2); context.stroke();
  context.fillStyle = "#e8cf98"; context.font = "600 150px serif"; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText("LA", 200, 210);
  return new Uint8Array(canvas.toBuffer("image/png"));
}

/** A real Ad Studio payload, validated by the same contract the API and worker use. */
function campaign(logo: Uint8Array) {
  const payload = adStudioBrandAdFixture({ duration: 8, aspectRatio: "9:16", resolution: "720p", audio: false });
  const project = payload.configuration.creatorProject;
  const logoChecksum = sha(logo);
  const settings: AdStudioBrandAdSettings = {
    formVersion: 1,
    brandName: "Layla Atelier",
    website: "www.laylaatelier.com",
    sellingPoints: "Full-grain leather, hand-stitched edges, solid brass clasp",
    aesthetics: "Quiet luxury: cream backdrop, soft warm morning light, burgundy and gold tones",
    audience: "Women 25 to 40 in Kuwait who like timeless designer pieces",
    description: "Handmade leather handbags designed in Kuwait. This is the burgundy top-handle bag with a gold clasp.",
    socials: "instagram.com/laylaatelier",
    videoIdea: "Soft morning light slowly sweeps across the burgundy handbag standing on a cream surface. The camera glides in a slow half-circle around the bag, then moves in close on the gold clasp and the stitched leather, and finally pulls back to show the whole bag standing proudly in warm light.",
    logoChecksum,
  };
  const name = "Burgundy top-handle bag";
  const brandColor = "#c9a25b";
  const logoAsset = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "logo.png", url: "" as const, storagePath: `users/11111111-1111-4111-8111-111111111111/projects/${project.id}/assets/logo.png`, mimeType: "image/png" as const, checksum: logoChecksum, source: "upload" as const, referenceRole: "artwork" as const, selected: false };
  Object.assign(project.product, { brand: settings.brandName, name });
  for (const fact of project.source.facts) {
    if (fact.value === "Northfield") fact.value = settings.brandName;
    if (fact.value === "Northfield No. 07") fact.value = name;
  }
  project.brandColor = brandColor;
  project.product.images.push(logoAsset);
  project.source.assetKeys.push(logoAsset.storagePath);
  project.adStudioBrandAd = settings;
  Object.assign(payload.productRecipe, { brand: settings.brandName, name });
  payload.productRecipe.images.push({ assetId: logoAsset.id, name: logoAsset.name, objectKey: logoAsset.storagePath, mimeType: logoAsset.mimeType, checksumSha256: logoChecksum, referenceRole: "artwork", selected: false });
  Object.assign(payload.campaignRecipe, { brand: settings.brandName, brandColor, adStudioBrandAd: settings });
  payload.configuration.generation.templateQuoteContext = payload.campaignRecipe;
  Object.assign(payload.configuration.generation.creativeBrief.product, { brand: settings.brandName, name });
  payload.configuration.generation.creativeBrief.adStudioBrandAd = settings;
  return { payload: TemplateCampaignPayloadSchema.parse(payload), settings };
}

async function main() {
  await mkdir(privateDir, { recursive: true, mode: 0o700 });
  const logo = logoPng();
  await writeFile(resolve(dir, "logo.png"), logo);
  const { payload, settings } = campaign(logo);
  const generation = payload.configuration.generation;
  const compiled = compileTemplatePrompt({ brief: CreativeBriefSchema.parse(generation.creativeBrief), photos: generation.references, aspectRatio: "9:16", audio: false });
  const prompt = compiled.prompt;
  await writeFile(resolve(dir, "prompt.txt"), `${prompt}\n`);
  const firstFrame = resolve(dir, "first-frame.jpg");
  await exec("ffmpeg", ["-v", "error", "-y", "-i", resolve(dir, "../product-model-ad/preview-15s/luxury-purse.png"), "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280", "-q:v", "6", firstFrame]);
  const image = await readFile(firstFrame);
  if (prompt.length > 8000 || image.length > 250 * 1024) throw new Error(`input_limit_exceeded:${prompt.length}:${image.length}`);
  const immutable = sha(JSON.stringify({ prompt, firstFrame: sha(image), duration: 8, model: MODEL, audio: false, ratio: "9:16", resolution: "720p" }));
  const seed = parseInt(immutable.slice(0, 8), 16) & 0x7fffffff;
  if (process.argv.includes("--dry-run")) {
    console.log(JSON.stringify({ model: MODEL, duration: 8, promptCharacters: prompt.length, firstFrameBytes: image.length, brand: settings.brandName, seed, paidCalls: 0 }));
    return;
  }
  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (!apiKey) throw new Error("gateway_key_missing");
  const adapter = createVercelGatewaySeedanceAdapter({ capability: "video.cinematic", modelId: MODEL, applicationEnvironment: "local", apiKey, resolutionTier: "720p", generateAudio: false,
    resolveReferenceUrl: async () => { throw new Error("seedance_1_uses_first_frame_only"); },
    resolveFirstFrame: async () => ({ type: "file", data: image.toString("base64"), mediaType: "image/jpeg" }),
  });
  if (process.argv.includes("--submit")) {
    if (process.env.MOVPROMPT_AUTHORIZE_AD_STUDIO !== "ONE_ATTEMPT") throw new Error("confirmation_missing");
    await writeFile(resolve(privateDir, "dispatch.json"), JSON.stringify({ authorizedCalls: 1, immutable, seed, model: MODEL, duration: 8, at: new Date().toISOString() }), { flag: "wx", mode: 0o600 });
    console.info("Submitting ONE authorized 8s Seedance 1.0 Pro Fast request. No paid retry.");
    const operation = await adapter.submit({ operationId: `ad-studio-${immutable.slice(0, 24)}`, userId: "local-preview", projectId: "standalone-ad-studio", capability: "video.cinematic", prompt, durationSeconds: 8, aspectRatio: "9:16", resolution: "720p", generateAudio: false, seed, referenceMode: "first_frame", requiredModelId: MODEL, references: [{ objectKey: `local-first-frame/${sha(image)}.jpg`, mimeType: "image/jpeg" }], idempotencyKey: `ad-studio-${immutable}` });
    await record("operation.json", operation);
    console.info("Provider accepted; recovery saved.");
  } else if (!process.argv.includes("--resume")) throw new Error("use_dry_run_submit_or_resume");
  const operation = JSON.parse(await readFile(resolve(privateDir, "operation.json"), "utf8"));
  for (let attempt = 0; attempt < 120; attempt++) {
    const status = await adapter.getStatus(operation.providerRequestId);
    await record("status.json", status);
    if (attempt % 6 === 0 || status.status === "completed" || status.status === "failed") console.info(JSON.stringify({ status: status.status, elapsedSeconds: attempt * 10 }));
    if (status.status === "failed" || status.status === "cancelled") throw new Error(`provider_${status.status}:${status.errorCode ?? "unknown"}`);
    if (status.status === "completed") {
      if (!status.outputUrl) throw new Error("missing_output");
      const response = await fetch(status.outputUrl, { signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`download_failed:${response.status}`);
      const raw = new Uint8Array(await response.arrayBuffer());
      if (raw.length < 1024 || Buffer.from(raw.slice(4, 8)).toString() !== "ftyp") throw new Error("output_not_mp4");
      await writeFile(resolve(dir, "ad-studio-8s-raw.mp4"), raw);
      const { stdout } = await exec("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", resolve(dir, "ad-studio-8s-raw.mp4")]);
      const [width, height] = stdout.trim().split(",").map(Number);
      const layers = await modelAdLayers(payload.configuration, width!, height!, async (_key, checksum) => { if (checksum !== sha(logo)) throw new Error("logo_checksum_mismatch"); return logo; });
      const finished = await normalizeDeliveryMp4(raw, undefined, { aspectRatio: "9:16", muted: true, modelAdLayers: layers! });
      const path = resolve(dir, "ad-studio-brand-ad-8s.mp4");
      await writeFile(path, finished);
      await mkdir("/Users/arbaanq/Downloads/movprompt", { recursive: true });
      await copyFile(path, "/Users/arbaanq/Downloads/movprompt/ad-studio-brand-ad-8s.mp4");
      await writeFile(resolve(dir, "result.json"), JSON.stringify({ model: MODEL, raw: { width, height, sha256: sha(raw) }, finishedSha256: sha(finished), paidSubmissions: 1, telemetry: status.telemetry, status: "pending_visual_review" }, null, 2));
      console.info("Video generated and finished with the Ad Studio end card.");
      return;
    }
    await new Promise(done => setTimeout(done, 10_000));
  }
  throw new Error("poll_window_ended_resume_existing_only");
}
main().catch(async error => {
  await record("failure.json", { message: error instanceof Error ? error.message : String(error), at: new Date().toISOString() }).catch(() => undefined);
  console.error(`Stopped: ${error instanceof Error ? error.message : String(error)}. No paid retry.`);
  process.exitCode = 1;
});
