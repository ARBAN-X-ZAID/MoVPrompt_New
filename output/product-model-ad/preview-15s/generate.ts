import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defaultProductModelAdSettings } from "../../../packages/contracts/src/index.ts";
import { getCreativeTemplate, resolveDurationRecipe, compileTemplatePrompt, CreativeBriefSchema, ENGINE_VERSION } from "../../../packages/creative-engine/src/index.ts";
import { createVercelGatewaySeedanceAdapter } from "../../../packages/providers/src/vercel-gateway-seedance.ts";
import { R2Storage, r2StorageConfigFromEnv } from "../../../packages/storage/src/index.ts";

const root = resolve(import.meta.dir, "../../..");
const output = import.meta.dir;
const privateDir = resolve(root, "artifacts/product-model-ad-purse-15s-2026-10-14");
const hash = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const privateJson = async (file: string, value: unknown) => writeFile(resolve(privateDir, file), JSON.stringify(value, null, 2), { mode: 0o600 });
const photos = [
  { path: resolve(output, "luxury-purse.png"), referenceRole: "subject" as const, mimeType: "image/png" },
  { path: "/Users/arbaanq/Downloads/movprompt/ugc-animated-character-2026-10-01.png", referenceRole: "character" as const, mimeType: "image/png", personRightsConfirmed: true },
];
async function main() {
  await mkdir(privateDir, { recursive: true, mode: 0o700 });
  const template = getCreativeTemplate("product-with-model-ad");
  const settings = defaultProductModelAdSettings();
  settings.category = "accessory"; settings.modelChoice = "reference_adult"; settings.action = "hold";
  const recipe = resolveDurationRecipe({ id: template.id, duration: 15, durationRecipes: template.durationRecipes!, photos });
  const brief = CreativeBriefSchema.parse({ productModelAd: settings, engineVersion: ENGINE_VERSION, templateId: template.id, templateRecipeVersion: 1, templatePromptVersion: `${template.id}-v1`, templateVisualSystem: template.visualSystem, durationVariant: recipe.id,
    market: "KW", language: "en", arabicDialect: null, dialectRegister: template.dialectRegister, tone: template.tone, vertical: "ecommerce", goal: "launch",
    product: { name: "Luxury burgundy purse", description: "The supplied closed burgundy leather purse with one curved handle and gold hardware.", brand: "", price: "", offer: "", callToAction: "Discover the collection", whatsapp: "", bookingUrl: "", location: "" }, scenes: recipe.scenes, qualityPolicy: template.qualityPolicy });
  const prompt = compileTemplatePrompt({ brief, photos, aspectRatio: "9:16" }).prompt;
  const sources = await Promise.all(photos.map(async photo => ({ ...photo, bytes: await readFile(photo.path) })));
  const immutable = hash(JSON.stringify({ prompt, model: "bytedance/seedance-2.5", references: sources.map(photo => hash(photo.bytes)), duration: 15, ratio: "9:16", audio: false, resolution: "720p" }));
  const seed = Number.parseInt(immutable.slice(0, 8), 16) & 0x7fffffff;
  await writeFile(resolve(output, "prompt.txt"), prompt);
  await writeFile(resolve(output, "configuration.json"), JSON.stringify({ generation: { creativeBrief: brief, references: photos, durationSeconds: 15, aspectRatio: "9:16", generateAudio: false, seed } }, null, 2));
  if (process.argv.includes("--dry-run")) { console.info(JSON.stringify({ duration: 15, references: photos.length, promptCharacters: prompt.length, seed, paidCalls: 0 })); return; }
  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (!apiKey) throw new Error("gateway_key_missing");
  const urls = new Map<string, string>();
  const adapter = createVercelGatewaySeedanceAdapter({ capability: "video.product_fidelity", apiKey, modelId: "bytedance/seedance-2.5", applicationEnvironment: "local", resolutionTier: "720p", generateAudio: false, requestTimeoutMs: 60_000,
    resolveReferenceUrl: async photo => ({ url: urls.get(photo.objectKey)!, mediaType: photo.mimeType }), resolveFirstFrame: async () => { throw new Error("reference_only"); } });
  if (process.argv.includes("--submit")) {
    if (process.env.MOVPROMPT_CONFIRM_MODEL_AD !== "ONE_AUTHORIZED_ATTEMPT") throw new Error("confirmation_missing");
    const guard = resolve(privateDir, "dispatch.json");
    if (await Bun.file(guard).exists()) throw new Error("already_dispatched_no_paid_retry");
    const storage = new R2Storage(r2StorageConfigFromEnv());
    await storage.checkBucket(storage.assetsBucket);
    const references = [];
    for (const photo of sources) {
      const checksum = hash(photo.bytes);
      const objectKey = `preview-tests/product-model-ad-purse-15s-2026-10-14/${checksum}.png`;
      await storage.put({ bucket: storage.assetsBucket, key: objectKey, body: photo.bytes, contentType: photo.mimeType, metadata: { "sha256-hex": checksum } });
      const stored = await storage.get({ bucket: storage.assetsBucket, key: objectKey, maxBytes: 10 * 1024 * 1024 });
      if (hash(stored.body) !== checksum) throw new Error("reference_checksum_mismatch");
      urls.set(objectKey, (await storage.signDownload({ bucket: storage.assetsBucket, key: objectKey, expiresInSeconds: 3600 })).url);
      references.push({ objectKey, mimeType: photo.mimeType });
    }
    await writeFile(guard, JSON.stringify({ authorizedCalls: 1, immutable, seed, promptChecksum: hash(prompt), durationSeconds: 15, references, audio: false, createdAt: new Date().toISOString() }), { flag: "wx", mode: 0o600 });
    console.info("Submitting ONE authorized 15s Seedance 2.5 purse/model preview. No paid retries.");
    const operation = await adapter.submit({ operationId: `model-ad-${immutable.slice(0, 24)}`, userId: "local-preview", projectId: "standalone-model-ad-preview", capability: "video.product_fidelity", prompt, durationSeconds: 15, aspectRatio: "9:16", resolution: "720p", generateAudio: false, seed, referenceMode: "references", requiredModelId: "bytedance/seedance-2.5", references, idempotencyKey: `model-ad-${immutable}` });
    await privateJson("operation.json", operation);
    console.info("Provider accepted. Recovery record saved; polling creates no additional generation.");
  } else if (!process.argv.includes("--resume")) throw new Error("use_submit_or_resume");
  const operation = JSON.parse(await readFile(resolve(privateDir, "operation.json"), "utf8"));
  for (let i = 0; i < 180; i++) {
    const status = await adapter.getStatus(operation.providerRequestId);
    await privateJson("status.json", status);
    if (i % 6 === 0 || status.status !== "pending") console.info(JSON.stringify({ status: status.status, elapsedSeconds: i * 10 }));
    if (status.status === "failed" || status.status === "cancelled") throw new Error(`provider_${status.status}:${status.errorCode ?? "unknown"}`);
    if (status.status === "completed") {
      if (!status.outputUrl) throw new Error("missing_output");
      const response = await fetch(status.outputUrl, { signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`download_http_${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length < 1024 || Buffer.from(bytes.slice(4, 8)).toString() !== "ftyp") throw new Error("not_mp4");
      const path = resolve(output, "product-model-ad-purse-15s-raw.mp4");
      await writeFile(path, bytes, { flag: "wx" });
      await copyFile(path, "/Users/arbaanq/Downloads/movprompt/product-model-ad-purse-15s-raw.mp4");
      await writeFile(resolve(output, "result.json"), JSON.stringify({ status: "generated_pending_media_review", sha256: hash(bytes), model: "bytedance/seedance-2.5", durationSeconds: 15, paidSubmissions: 1, telemetry: status.telemetry }, null, 2));
      console.info("Video saved. Media and visual review required before preview activation."); return;
    }
    await new Promise(done => setTimeout(done, 10_000));
  }
  throw new Error("poll_window_expired_resume_only");
}
main().catch(async error => {
  await privateJson("failure.json", { message: error instanceof Error ? error.message : String(error), at: new Date().toISOString() }).catch(() => undefined);
  console.error("Preview stopped; recovery details saved privately. No automatic paid retry."); process.exitCode = 1;
});
