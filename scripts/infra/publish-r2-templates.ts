import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { CATEGORY_PREVIEW_TEMPLATE_IDS, getVerifiedTemplatePreview } from "../../packages/creative-engine/src/index.ts";
import { R2Storage, r2StorageConfigFromEnv } from "../../packages/storage/src/index.ts";
const config = r2StorageConfigFromEnv();
const storage = new R2Storage(config);
const manifest = [
  "premium-phone-reveal", "phone-floating-ad", "restaurant-food-hero", "food-delivery-ad",
  "fashion-product-showcase", "luxury-fashion-reveal", "cosmetic-product-commercial",
  "perfume-advertisement", "real-estate-property", "business-service-promotion",
  "new-york-billboard-takeover", "luxury-gift-reveal",
].map(id => ({ id, poster: `docs/template-demos/posters/v1/${id}.jpg`, extension: "jpg", mime: "image/jpeg" }));
manifest.push({ id: "jewelry-product-showcase", poster: "docs/template-demos/posters/v1/jewelry-product-showcase.png", extension: "png", mime: "image/png" });
const argumentsList = process.argv.slice(2);
const selectedTemplate = argumentsList.find(argument => argument.startsWith("--template="))?.slice("--template=".length);
if (argumentsList.some(argument => !argument.startsWith("--template=")) || argumentsList.length > 1 || (selectedTemplate !== undefined && !manifest.some(item => item.id === selectedTemplate))) {
  throw new Error("Use an approved template ID with --template=<id>, or omit it to publish the full manifest.");
}
// Read every source before writing anything, so missing demos never publish half a manifest.
const sourceObjects = [
  ...manifest.filter(item => !selectedTemplate || item.id === selectedTemplate).map(item => ({ path: item.poster, key: `templates/v1/${item.id}.${item.extension}`, mime: item.mime })),
  ...CATEGORY_PREVIEW_TEMPLATE_IDS.filter(id => !selectedTemplate || id === selectedTemplate).map(id => {
    const key = getVerifiedTemplatePreview(id)!.objectKey;
    return { path: `docs/template-demos/videos/${key.slice("templates/".length)}`, key, mime: "video/mp4" };
  }),
];
const objects = await Promise.all(sourceObjects.map(async item => ({ ...item, body: await readFile(item.path) })));
await storage.checkBucket(storage.previewsBucket!);
for (const object of objects) {
  await storage.put({ bucket: storage.previewsBucket!, key: object.key, body: object.body, contentType: object.mime, metadata: { "sha256-hex": createHash("sha256").update(object.body).digest("hex") } });
  const signed = await storage.signDownload({ bucket: storage.previewsBucket!, key: object.key });
  const response = await fetch(signed.url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok || createHash("sha256").update(new Uint8Array(await response.arrayBuffer())).digest("hex") !== createHash("sha256").update(object.body).digest("hex")) throw new Error(`Private R2 template verification failed: ${object.key}. Check bucket access.`);
  console.info(`Published and verified ${object.key}`);
}
