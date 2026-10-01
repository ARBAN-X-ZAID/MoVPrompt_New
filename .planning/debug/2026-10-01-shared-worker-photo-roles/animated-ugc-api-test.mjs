import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { MongoClient, ObjectId } from "mongodb";

// One explicitly authorized integration run. Never log credentials or signed URLs.
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DATABASE);
let cookie = "";
async function request(path, method = "GET", body, key) {
  const response = await fetch(`http://localhost:8787/api/v1${path}`, {
    method,
    headers: {
      origin: "http://localhost:8080",
      ...(cookie ? { cookie } : {}),
      ...(body ? { "content-type": body instanceof Uint8Array ? "image/png" : "application/json" } : {}),
      ...(key ? { "idempotency-key": key } : {}),
    },
    ...(body ? { body: body instanceof Uint8Array ? body : JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(120000),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify({ path, status: response.status, error: data.error }));
  return data;
}
try {
  if (process.env.APP_ENV !== "local" || process.env.DEVELOPMENT_FREE_GENERATION !== "true") {
    throw new Error("This one-operation test requires the existing local technical-test reviewer, without automatic quality retries.");
  }
  const source = await db.collection("creator_project_versions").findOne({ _id: new ObjectId("6abe01c3a698bc28a13ce392") });
  if (!source) throw new Error("test_source_missing");
  const template = (await request("/templates/female-product-review")).template;
  if (template.versionNumber !== 3) throw new Error("expected_ugc_v3");
  await request("/guest/session", "POST", {});
  const draftId = randomUUID();
  const project = (await request("/projects/claim", "POST", {
    draftId, title: "Animated UGC integration test", mode: "advanced", configuration: {},
  }, draftId)).project;
  console.log(JSON.stringify({ stage: "project_created", projectId: project.id }));
  const images = [];
  for (const [filename, role] of [["ugc-product-2026-10-01.png", "subject"], ["ugc-animated-character-2026-10-01.png", "character"]]) {
    const bytes = await readFile(`/Users/arbaanq/Downloads/movprompt/${filename}`);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const upload = await request(`/projects/${project.id}/assets/upload-url`, "POST", {
      kind: "product", metadata: { mimeType: "image/png", sizeBytes: bytes.length, checksumSha256: checksum, originalFilename: filename },
    }, randomUUID());
    const saved = (await request(`/projects/${project.id}/assets/${upload.asset.id}/content`, "PUT", bytes)).asset;
    images.push({ id: saved.id, name: filename, url: "", mimeType: "image/png", referenceRole: role, selected: true,
      checksum, source: "upload", storagePath: saved.objectKey, ...(role === "character" ? { personRightsConfirmed: true } : {}) });
    console.log(JSON.stringify({ stage: "uploaded", role, checksum }));
  }
  const configuration = source.configuration;
  const creator = configuration.creatorProject;
  creator.id = project.id;
  creator.title = "Animated UGC integration test";
  creator.product.images = images;
  creator.source.assetKeys = images.map(image => image.storagePath);
  const generation = configuration.generation;
  generation.references = images.map(image => ({ objectKey: image.storagePath, mimeType: image.mimeType,
    referenceRole: image.referenceRole, ...(image.personRightsConfirmed ? { personRightsConfirmed: true } : {}) }));
  Object.assign(generation.creativeBrief, { durationVariant: "female-product-review-v3-15s", templateRecipeVersion: 3,
    templatePromptVersion: "female-product-review-v3" });
  source.productRecipe.images = images.map(image => ({ assetId: image.id, name: image.name, objectKey: image.storagePath,
    mimeType: image.mimeType, checksumSha256: image.checksum, referenceRole: image.referenceRole, selected: true,
    ...(image.personRightsConfirmed ? { personRightsConfirmed: true } : {}) }));
  const version = (await request(`/projects/${project.id}/versions`, "POST", {
    parentVersionId: project.currentVersion.id, templateVersionId: template.versionId, mode: "template", configuration,
    productRecipe: source.productRecipe, campaignRecipe: source.campaignRecipe, changeReason: "Authorized animated UGC API integration test",
  }, randomUUID())).version;
  await request("/generation-quotes", "POST", { projectVersionId: version.id });
  console.log(JSON.stringify({ stage: "ready_for_worker_coordination", projectId: project.id, versionId: version.id,
    duration: generation.durationSeconds, aspectRatio: generation.aspectRatio, roles: generation.references.map(r => r.referenceRole) }));
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  const gate = await readline.question("Type RUN only after production worker is suspended and local worker is healthy: ");
  readline.close();
  if (gate.trim() !== "RUN") throw new Error("not_submitted");
  const quote = (await request("/generation-quotes", "POST", { projectVersionId: version.id })).quote;
  const run = (await request("/render-runs", "POST", { projectId: project.id, projectVersionId: version.id, quoteId: quote.quoteId,
    rightsAttested: true }, randomUUID())).run;
  console.log(JSON.stringify({ stage: "submitted", runId: run.id, projectId: project.id, versionId: version.id }));
  for (let count = 0; count < 120; count++) {
    const current = (await request(`/render-runs/${run.id}`)).run;
    console.log(JSON.stringify({ stage: "poll", runId: run.id, status: current.status, processingStage: current.processingStage,
      errorCode: current.errorCode, errorMessage: current.errorMessage }));
    if (["completed", "failed", "cancelled"].includes(current.status)) break;
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "test_failed");
  process.exitCode = 1;
} finally {
  await client.close();
}
