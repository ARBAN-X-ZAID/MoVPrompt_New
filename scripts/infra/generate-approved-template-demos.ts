import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { LAUNCH_CREATIVE_TEMPLATE_CATALOG, ENGINE_VERSION, compileCreativeDirection } from "../../packages/creative-engine/src/index.ts";
import { R2Storage, r2StorageConfigFromEnv } from "../../packages/storage/src/index.ts";

// This command is an explicitly approved batch of TWO paid generations.
// Existing completed files stop repeats. Gateway retries remain zero.
if (process.env.MOVPROMPT_CONFIRM_TWO_TEMPLATE_DEMOS !== "YES") throw new Error("Explicit approval for two paid template demos is required.");
const storage = new R2Storage(r2StorageConfigFromEnv());
await storage.checkBucket(storage.assetsBucket);
await mkdir("artifacts/template-demos", { recursive: true });
for (const [id, reference] of [["salon-booking-offer", "salon"], ["app-service", "app"]] as const) {
  const output = `docs/template-demos/${id}-v3.mp4`;
  if (await Bun.file(output).exists()) { console.info(`${id}: completed demo already exists; no paid call.`); continue; }
  const template = LAUNCH_CREATIVE_TEMPLATE_CATALOG.find(item => item.id === id)!;
  const source = `docs/template-demos/references/${reference}-v3.png`;
  const body = await readFile(source);
  const key = `templates/references/v3/${id}.png`;
  const checksum = createHash("sha256").update(body).digest("hex");
  await storage.put({ bucket: storage.assetsBucket, key, body, contentType: "image/png", metadata: { "sha256-hex": checksum } });
  const signed = await storage.signDownload({ bucket: storage.assetsBucket, key, expiresInSeconds: 3600 });
  const brief = {
    engineVersion: ENGINE_VERSION, templateId: id, templateRecipeVersion: template.versionNumber,
    templatePromptVersion: `${id}-v${template.versionNumber}`, templateVisualSystem: template.visualSystem,
    market: "KW", language: "en", arabicDialect: null, dialectRegister: template.dialectRegister,
    tone: template.tone, vertical: template.verticals[0], goal: template.goals[0],
    product: { name: id === "app-service" ? "Example app" : "Example salon", brand: "", description: "", price: "", offer: "", callToAction: template.scenes.at(-1)!.headline.en, whatsapp: "", location: "" },
    scenes: template.scenes, qualityPolicy: template.qualityPolicy,
  };
  const compiled = compileCreativeDirection({ rawPrompt: template.visualSystem, creativeBrief: brief, audioEnabled: false });
  await writeFile(`docs/template-demos/${id}-v3-prompt.txt`, compiled.prompt);
  const log = `artifacts/template-demos/${id}-v3-provider.json`;
  // Reserve each paid call before dispatch. A crash/failure or concurrent
  // invocation cannot submit another billed request for this approved demo.
  await writeFile(`artifacts/template-demos/${id}-v3-dispatched.json`, JSON.stringify({ id, dispatchedAt: new Date().toISOString(), promptVersion: brief.templatePromptVersion }), { flag: "wx", mode: 0o600 });
  console.info(`${id}: starting ONE paid ${template.durationSeconds}-second image-to-video call.`);
  const child = Bun.spawn(["bun", "run", "--cwd", "apps/worker", "gateway:video"], {
    env: { ...process.env, MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO: "YES", MOVPROMPT_GATEWAY_VIDEO_IMAGE_PATH: resolve(source), MOVPROMPT_GATEWAY_VIDEO_IMAGE_URL: signed.url,
      MOVPROMPT_GATEWAY_VIDEO_DURATION_SECONDS: String(template.durationSeconds), MOVPROMPT_GATEWAY_VIDEO_ASPECT_RATIO: "9:16",
      MOVPROMPT_GATEWAY_VIDEO_RESOLUTION_TIER: "720p", MOVPROMPT_GATEWAY_VIDEO_RESOLUTION: "720x1280", MOVPROMPT_GATEWAY_VIDEO_PROMPT: compiled.prompt },
    stdout: "pipe", stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  await writeFile(log, stdout + "\n" + stderr, { mode: 0o600 });
  if (code !== 0) throw new Error(`${id}: provider call failed; private diagnostic log: ${log}. No paid retry was made.`);
  const metadata = JSON.parse(stdout);
  await copyFile(metadata.outputPath, output);
  await writeFile(`docs/template-demos/${id}-v3.json`, JSON.stringify({ templateId: id, recipeVersion: template.versionNumber, promptVersion: brief.templatePromptVersion, model: metadata.model, duration: template.durationSeconds, source: { bucket: storage.assetsBucket, key, checksum }, video: output, prompt: `${id}-v3-prompt.txt`, providerMetadata: log }, null, 2));
  console.info(`${id}: saved ${output}`);
}
