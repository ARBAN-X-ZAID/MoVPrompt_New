import { setTimeout as delay } from "node:timers/promises";
import { randomUUID, createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { defaultNativeUgcSettings, type TemplatePhotoReference } from "../../packages/contracts/src/index.ts";
import { CreativeBriefSchema, ENGINE_VERSION, compileCreativeDirection, getCreativeTemplate, resolveDurationRecipe } from "../../packages/creative-engine/src/index.ts";
import { createVercelGatewaySeedanceAdapter, VERCEL_GATEWAY_SEEDANCE_OUTPUT_HOSTS } from "../../packages/providers/src/index.ts";
import { R2Storage, r2StorageConfigFromEnv } from "../../packages/storage/src/index.ts";
import { createProviderOutputPersister } from "../../apps/worker/src/output-persister.ts";
import { createWatermarkedPreview } from "../../apps/worker/src/preview-watermark.ts";
import { createFfprobeTechnicalAnalyzer, createGatewayVideoQualityAnalyzer } from "../../apps/worker/src/media-quality-analyzers.ts";
import { createComposedOutputQualityReviewer } from "../../apps/worker/src/output-quality-reviewer.ts";

for (const name of [".env", ".env.local"]) { try { loadEnvFile(resolve(name)); } catch (error) { if ((error as { code?: string }).code !== "ENOENT") throw error; } }
const sample = process.argv[2];
if (!["ugc-en", "adstudio-ar", "adstudio-ar-generated", "adstudio-ar-visible-speech"].includes(sample ?? "")) throw new Error("Choose an authorized native UGC validation case.");
if (process.env.MOVPROMPT_CONFIRM_NATIVE_UGC_TESTS !== "YES") throw new Error("Explicit paid-test authorization required.");
const root = resolve("output/native-ugc-validation-2026-10-17", sample!);
await mkdir(root, { recursive: true });
const json = async (name: string, value: unknown, exclusive = false) => writeFile(resolve(root, name), JSON.stringify(value, null, 2), { mode: 0o600, ...(exclusive ? { flag: "wx" } : {}) });
const exists = async (name: string) => access(resolve(root, name)).then(() => true, () => false);
if (await exists("result.json")) throw new Error("This sample has already completed. No paid retry is allowed.");
const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
if (!apiKey) throw new Error("Missing Gateway key.");
const storage = new R2Storage(r2StorageConfigFromEnv());
const ar = sample !== "ugc-en";
const characterReference = sample === "adstudio-ar";
const template = getCreativeTemplate(ar ? "ad-studio-brand-ad" : "female-product-review");
let identity: { runId: string; userId: string; projectId: string; projectVersionId: string };
if (await exists("identity.json")) identity = JSON.parse(await readFile(resolve(root, "identity.json"), "utf8"));
else { identity = { runId: randomUUID(), userId: randomUUID(), projectId: randomUUID(), projectVersionId: randomUUID() }; await json("identity.json", identity, true); }
const sources = [
  { path: "docs/template-demos/references/v1/perfume-advertisement.jpg", role: "subject" as const, mimeType: "image/jpeg" },
  ...(characterReference ? [{ path: "output/product-model-ad/photoreal-car-15s/fictional-woman.png", role: "character" as const, mimeType: "image/png" }] : []),
];
const photos: Array<TemplatePhotoReference & { objectKey: string; mimeType: string }> = [];
for (const [index, source] of sources.entries()) {
  const bytes = new Uint8Array(await readFile(source.path));
  const key = `users/${identity.userId}/projects/${identity.projectId}/assets/native-ugc-${index}.${source.mimeType === "image/png" ? "png" : "jpg"}`;
  await storage.put({ bucket: storage.assetsBucket, key, body: bytes, contentType: source.mimeType, metadata: { "sha256-hex": createHash("sha256").update(bytes).digest("hex"), "purpose": "authorized-native-ugc-validation" } });
  photos.push({ objectKey: key, mimeType: source.mimeType, referenceRole: source.role, ...(source.role === "character" ? { personRightsConfirmed: true as const } : {}) });
}
const recipe = resolveDurationRecipe({ id: template.id, durationRecipes: template.durationRecipes!, duration: 8, photos });
const settings = { ...defaultNativeUgcSettings(), enabled: true, characterStyle: characterReference ? "reference_adult" as const : "realistic_adult" as const, script: ar ? "هذا عطر نورثفيلد رقم سبعة. شوف تفاصيله، واطلبه الحين." : "Meet Northfield number seven. Take a closer look. Shop now.", scriptApproved: true, approvedLanguage: ar ? "ar" as const : "en" as const };
const brief = CreativeBriefSchema.parse({ engineVersion: ENGINE_VERSION, templateId: template.id, templateRecipeVersion: template.versionNumber, templatePromptVersion: `${template.id}-v${template.versionNumber}`, templateVisualSystem: template.visualSystem, durationVariant: recipe.id, market: "KW", language: ar ? "ar" : "en", arabicDialect: ar ? "kuwaiti" : null, dialectRegister: template.dialectRegister, tone: template.tone, vertical: "ecommerce", goal: "launch", product: { name: "Northfield No. 07", brand: "Northfield", description: "The exact supplied dark perfume bottle", callToAction: ar ? "اطلبه الحين" : "Shop now" }, nativeUgc: settings, ...(ar ? { adStudioBrandAd: { formVersion: 1, brandName: "Northfield", website: "", sellingPoints: "No. 07 perfume in the supplied bottle", aesthetics: "Warm natural commercial light, neutral setting", audience: "Adults in Kuwait", description: "Perfume in a dark cylindrical bottle", socials: "", videoIdea: "One generated fictional adult presents the exact perfume bottle to camera. Keep her face visible while speaking. Cut briefly to the visible label, then return to the same adult for the closing words." } } : {}), scenes: recipe.scenes, qualityPolicy: template.qualityPolicy });
const generation = { prompt: template.visualSystem, durationSeconds: 8, aspectRatio: "9:16" as const, resolution: "720p" as const, audio: true, creativeBrief: brief, references: photos };
const compiled = compileCreativeDirection({ rawPrompt: generation.prompt, creativeBrief: brief, audioEnabled: true, references: photos, aspectRatio: "9:16" });
await json("configuration.json", { generation });
await writeFile(resolve(root, "prompt.txt"), compiled.prompt);
const adapter = createVercelGatewaySeedanceAdapter({ apiKey, modelId: "bytedance/seedance-2.5", capability: "video.product_fidelity", applicationEnvironment: "local", resolutionTier: "720p", requestTimeoutMs: 120_000, resolveReferenceUrl: async reference => ({ url: (await storage.signDownload({ bucket: storage.assetsBucket, key: reference.objectKey, expiresInSeconds: 3600 })).url, mediaType: reference.mimeType }), resolveFirstFrame: async () => { throw new Error("This validation requires reference mode."); } });
let submission;
if (await exists("submission.json")) submission = JSON.parse(await readFile(resolve(root, "submission.json"), "utf8"));
else {
  await json("dispatched.json", { sample, model: "bytedance/seedance-2.5", duration: 8, authorizedCalls: 1, dispatchedAt: new Date().toISOString(), promptSha256: createHash("sha256").update(compiled.prompt).digest("hex") }, true);
  console.log(`${sample}: submitting one authorized Seedance 2.5 native-audio request`);
  try {
    submission = await adapter.submit({ operationId: identity.runId, userId: identity.userId, projectId: identity.projectId, capability: "video.product_fidelity", prompt: compiled.prompt, references: photos, durationSeconds: 8, aspectRatio: "9:16", resolution: "720p", generateAudio: true, requiredModelId: "bytedance/seedance-2.5", referenceMode: "references", seed: 17002026, idempotencyKey: `native-ugc-validation:${identity.runId}` });
    await json("submission.json", submission, true);
  } catch (error) { await json("failure.json", { stage: "submit", code: (error as { code?: string }).code ?? "unknown", message: error instanceof Error ? error.message : String(error) }); throw new Error(`${sample}: submit failed. See private failure artifact. No automatic retry.`); }
}
const deadline = Date.now() + 20 * 60_000;
while (Date.now() < deadline) {
  const operation = await adapter.getStatus(submission.providerRequestId);
  console.log(`${sample}: ${operation.status}`);
  if (operation.status === "failed" || operation.status === "cancelled") { await json("failure.json", { stage: "generation", status: operation.status, code: operation.errorCode, message: operation.errorMessage, telemetry: operation.telemetry }); throw new Error(`${sample}: provider generation failed. No paid retry.`); }
  if (operation.status === "completed") {
    if (!operation.outputUrl) throw new Error("Completed operation lacks output.");
    const persister = createProviderOutputPersister({ storage, allowedHosts: VERCEL_GATEWAY_SEEDANCE_OUTPUT_HOSTS, createPreview: createWatermarkedPreview });
    const finished = await persister.persist({ ...identity, attemptNumber: 0, sourceUrl: operation.outputUrl, configuration: { generation } as never });
    const owned = await storage.get({ bucket: finished.bucket, key: finished.objectKey, maxBytes: 64 * 1024 * 1024 });
    await writeFile(resolve(root, "finished.mp4"), owned.body);
    await json("candidate.json", { ...finished, ...identity, telemetry: operation.telemetry });
    const technical = createFfprobeTechnicalAnalyzer({ storage });
    const visual = createGatewayVideoQualityAnalyzer({ storage, apiKey, modelId: process.env.MOVPROMPT_QUALITY_MODEL_ID?.trim() || "google/gemini-3.1-pro-preview" });
    const candidate = { bucket: finished.bucket, objectKey: finished.objectKey, ...identity };
    const observations = [...await technical.analyze({ candidate, configuration: { generation } as never, attemptNumber: 0 }), ...await visual.analyze({ candidate, configuration: { generation } as never, attemptNumber: 0 })];
    await json("observations.json", observations);
    const reviewer = createComposedOutputQualityReviewer([{ id: "saved-validation-observations", dimensions: observations.map(item => item.dimension), analyze: async () => observations }]);
    const decision = await reviewer.review({ ...candidate, configuration: { generation } as never, attemptNumber: 0 });
    await json("result.json", { sample, model: "bytedance/seedance-2.5", ...decision, telemetry: operation.telemetry, completedAt: new Date().toISOString() }, true);
    console.log(JSON.stringify({ sample, ...decision }));
    if (decision.status !== "accepted") process.exitCode = 2;
    break;
  }
  await delay(15_000);
}
if (!await exists("result.json")) throw new Error("Timed out while observing the existing operation. Resume polling without a new submit.");
