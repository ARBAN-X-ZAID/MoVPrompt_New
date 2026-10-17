import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { createCanvas } from "../../apps/worker/node_modules/@napi-rs/canvas/index.js";
import { TemplateCampaignPayloadSchema, type AdStudioBrandAdSettings } from "../../apps/worker/node_modules/@movprompt/contracts/dist/index.js";
import { CreativeBriefSchema, compileTemplatePrompt } from "../../apps/worker/node_modules/@movprompt/creative-engine/dist/index.js";
import { R2Storage, r2StorageConfigFromEnv } from "../../apps/worker/node_modules/@movprompt/storage/dist/index.js";
import { adStudioBrandAdFixture } from "../../apps/api/src/ad-studio-brand-ad.test-fixture.ts";
import { modelAdLayers } from "../../apps/worker/src/product-model-ad-finishing.ts";
import { normalizeDeliveryMp4 } from "../../apps/worker/src/output-persister.ts";
import { createVercelGatewaySeedanceAdapter } from "../../packages/providers/src/vercel-gateway-seedance.ts";

const exec = promisify(execFile);
const dir = import.meta.dir;
const privateDir = resolve(dir, "../../artifacts/ad-studio-brand-ad-seedance25-8s-2026-10-16");
const MODEL = "bytedance/seedance-2.5";
const sha = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const record = (name: string, data: unknown) => writeFile(resolve(privateDir, name), JSON.stringify(data, null, 2), { mode: 0o600 });
const sources = [
  { path: "/Users/arbaanq/Downloads/movprompt/s24U.jpg", mimeType: "image/jpeg", role: "product" },
  { path: "/Users/arbaanq/Downloads/movprompt/fictional-woman-2026-10-14.png", mimeType: "image/png", role: "presenter" },
] as const;

function logoPng(): Uint8Array {
  const canvas = createCanvas(400, 400);
  const context = canvas.getContext("2d");
  context.fillStyle = "#1c2430"; context.beginPath(); context.arc(200, 200, 190, 0, Math.PI * 2); context.fill();
  context.strokeStyle = "#d7dde6"; context.lineWidth = 10; context.beginPath(); context.arc(200, 200, 160, 0, Math.PI * 2); context.stroke();
  context.fillStyle = "#f4f7fb"; context.font = "600 150px sans-serif"; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText("N", 200, 210);
  return new Uint8Array(canvas.toBuffer("image/png"));
}

function campaign(logo: Uint8Array) {
  const payload = adStudioBrandAdFixture({ duration: 8, aspectRatio: "9:16", resolution: "720p", audio: true });
  const project = payload.configuration.creatorProject;
  const logoChecksum = sha(logo);
  const settings: AdStudioBrandAdSettings = {
    formVersion: 1, brandName: "Northline", website: "www.northline.com", logoChecksum,
    sellingPoints: "Silver metallic back and four rear cameras",
    aesthetics: "Bright and clean, soft daylight, cream and silver",
    audience: "Adults in Kuwait choosing a new phone",
    description: "The silver smartphone shown in the uploaded photo.",
    socials: "instagram.com/northline",
    videoIdea: "The woman holds the silver phone beside her shoulder, turns it so the rear cameras face the camera, then smiles. She says the cameras are the reason to look.",
  };
  const name = "Silver smartphone";
  const logoAsset = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "logo.png", url: "" as const, storagePath: `users/11111111-1111-4111-8111-111111111111/projects/${project.id}/assets/logo.png`, mimeType: "image/png" as const, checksum: logoChecksum, source: "upload" as const, referenceRole: "artwork" as const, selected: false };
  Object.assign(project.product, { brand: settings.brandName, name });
  for (const fact of project.source.facts) {
    if (fact.value === "Northfield") fact.value = settings.brandName;
    if (fact.value === "Northfield No. 07") fact.value = name;
  }
  project.brandColor = "#d7dde6";
  project.product.images.push(logoAsset);
  project.source.assetKeys.push(logoAsset.storagePath);
  project.adStudioBrandAd = settings;
  Object.assign(payload.productRecipe, { brand: settings.brandName, name });
  payload.productRecipe.images.push({ assetId: logoAsset.id, name: logoAsset.name, objectKey: logoAsset.storagePath, mimeType: logoAsset.mimeType, checksumSha256: logoChecksum, referenceRole: "artwork", selected: false });
  Object.assign(payload.campaignRecipe, { brand: settings.brandName, brandColor: "#d7dde6", adStudioBrandAd: settings });
  payload.configuration.generation.templateQuoteContext = payload.campaignRecipe;
  Object.assign(payload.configuration.generation.creativeBrief.product, { brand: settings.brandName, name });
  payload.configuration.generation.creativeBrief.adStudioBrandAd = settings;
  return { payload: TemplateCampaignPayloadSchema.parse(payload), settings };
}

function presenterPrompt(prompt: string): string {
  const productLine = "[Image 1]: A view of the SAME product. Preserve shape, proportions, materials, colours, labels and identifying details.";
  const labeled = "[Image 1]: The silver smartphone. Preserve its shape, camera layout, colour and proportions. Do not reproduce corner watermarks or website text from the photo.\n\n[Image 2]: The fictional adult presenter. Keep her face, hair, age, cream shirt, dark trousers and proportions. She is not a product, and no second person appears.";
  if (!prompt.includes(productLine)) throw new Error("prompt_reference_line_missing");
  return prompt.replace(productLine, labeled);
}

async function main() {
  await mkdir(privateDir, { recursive: true, mode: 0o700 });
  const logo = logoPng();
  const { payload } = campaign(logo);
  const generation = payload.configuration.generation;
  const compiled = compileTemplatePrompt({ brief: CreativeBriefSchema.parse(generation.creativeBrief), photos: generation.references, aspectRatio: "9:16", audio: true });
  const prompt = presenterPrompt(compiled.prompt);
  await writeFile(resolve(dir, "prompt-8s-25.txt"), `${prompt}\n`);
  const photos = await Promise.all(sources.map(async source => ({ ...source, bytes: await readFile(source.path) })));
  if (prompt.length > 8000 || photos.some(photo => photo.bytes.length > 10 * 1024 * 1024)) throw new Error("input_limit_exceeded");
  const immutable = sha(JSON.stringify({ prompt, photos: photos.map(photo => sha(photo.bytes)), duration: 8, model: MODEL, audio: true, ratio: "9:16", resolution: "720p" }));
  const seed = parseInt(immutable.slice(0, 8), 16) & 0x7fffffff;
  if (process.argv.includes("--dry-run")) {
    console.log(JSON.stringify({ model: MODEL, duration: 8, audio: true, references: photos.map(photo => photo.role), promptCharacters: prompt.length, seed, paidCalls: 0 }));
    return;
  }
  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (!apiKey) throw new Error("gateway_key_missing");
  const urls = new Map<string, string>();
  const adapter = createVercelGatewaySeedanceAdapter({ capability: "video.product_fidelity", modelId: MODEL, applicationEnvironment: "local", apiKey, resolutionTier: "720p", generateAudio: true, requestTimeoutMs: 60_000,
    resolveReferenceUrl: async photo => ({ url: urls.get(photo.objectKey)!, mediaType: photo.mimeType }),
    resolveFirstFrame: async () => { throw new Error("reference_only"); },
  });
  if (process.argv.includes("--submit")) {
    if (process.env.MOVPROMPT_AUTHORIZE_AD_STUDIO_25 !== "ONE_ATTEMPT") throw new Error("confirmation_missing");
    const storage = new R2Storage(r2StorageConfigFromEnv());
    await storage.checkBucket(storage.assetsBucket);
    const references = [];
    for (const photo of photos) {
      const checksum = sha(photo.bytes);
      const objectKey = `preview-tests/ad-studio-brand-ad-8s-2026-10-16/${checksum}.${photo.mimeType === "image/png" ? "png" : "jpg"}`;
      await storage.put({ bucket: storage.assetsBucket, key: objectKey, body: photo.bytes, contentType: photo.mimeType, metadata: { "sha256-hex": checksum } });
      const stored = await storage.get({ bucket: storage.assetsBucket, key: objectKey, maxBytes: 10 * 1024 * 1024 });
      if (sha(stored.body) !== checksum) throw new Error("reference_checksum_mismatch");
      urls.set(objectKey, (await storage.signDownload({ bucket: storage.assetsBucket, key: objectKey, expiresInSeconds: 3600 })).url);
      references.push({ objectKey, mimeType: photo.mimeType });
    }
    await writeFile(resolve(privateDir, "dispatch.json"), JSON.stringify({ authorizedCalls: 1, immutable, seed, model: MODEL, duration: 8, audio: true, references: references.map(item => item.objectKey), at: new Date().toISOString() }), { flag: "wx", mode: 0o600 });
    console.info("Submitting ONE authorized 8s Seedance 2.5 request with the phone and presenter. No paid retry.");
    const operation = await adapter.submit({ operationId: `ad-studio-25-${immutable.slice(0, 24)}`, userId: "local-preview", projectId: "standalone-ad-studio-25", capability: "video.product_fidelity", prompt, durationSeconds: 8, aspectRatio: "9:16", resolution: "720p", generateAudio: true, seed, referenceMode: "references", requiredModelId: MODEL, references, idempotencyKey: `ad-studio-25-${immutable}` });
    await record("operation.json", operation);
    console.info("Provider accepted; recovery saved.");
  } else if (!process.argv.includes("--resume")) throw new Error("use_dry_run_submit_or_resume");
  const operation = JSON.parse(await readFile(resolve(privateDir, "operation.json"), "utf8"));
  for (const photo of photos) urls.set(`preview-tests/ad-studio-brand-ad-8s-2026-10-16/${sha(photo.bytes)}.${photo.mimeType === "image/png" ? "png" : "jpg"}`, "unused-after-submit");
  for (let attempt = 0; attempt < 180; attempt++) {
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
      await writeFile(resolve(dir, "ad-studio-8s-25-raw.mp4"), raw);
      const { stdout } = await exec("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", resolve(dir, "ad-studio-8s-25-raw.mp4")]);
      const [width, height] = stdout.trim().split(",").map(Number);
      const layers = await modelAdLayers(payload.configuration, width!, height!, async (_key, checksum) => { if (checksum !== sha(logo)) throw new Error("logo_checksum_mismatch"); return logo; });
      const finished = await normalizeDeliveryMp4(raw, undefined, { aspectRatio: "9:16", modelAdLayers: layers! });
      const path = resolve(dir, "ad-studio-brand-ad-8s-25.mp4");
      await writeFile(path, finished);
      await mkdir("/Users/arbaanq/Downloads/movprompt", { recursive: true });
      await copyFile(path, "/Users/arbaanq/Downloads/movprompt/ad-studio-brand-ad-8s-25.mp4");
      await writeFile(resolve(dir, "result-8s-25.json"), JSON.stringify({ model: MODEL, raw: { width, height, sha256: sha(raw) }, finishedSha256: sha(finished), paidSubmissions: 1, audio: true, references: ["phone", "presenter"], status: "pending_visual_review" }, null, 2));
      console.info("Video generated with Seedance 2.5 and finished with the end card.");
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
