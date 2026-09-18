import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { CATEGORY_PREVIEW_TEMPLATE_IDS } from "../../packages/creative-engine/src/index.ts";
import { R2Storage, r2StorageConfigFromEnv } from "../../packages/storage/src/index.ts";
const config = r2StorageConfigFromEnv();
const storage = new R2Storage(config);
const manifest = [
  "premium-phone-reveal", "phone-floating-ad", "restaurant-food-hero", "food-delivery-ad",
  "fashion-product-showcase", "luxury-fashion-reveal", "cosmetic-product-commercial",
  "perfume-advertisement", "real-estate-property", "business-service-promotion",
  "new-york-billboard-takeover",
].map(id => ({ id, poster: `docs/template-demos/posters/v1/${id}.jpg` }));
// Read every source before writing anything, so missing demos never publish half a manifest.
const sourceObjects = [
  ...manifest.map(item => ({ path: item.poster, key: `templates/v1/${item.id}.jpg`, mime: "image/jpeg" })),
  ...CATEGORY_PREVIEW_TEMPLATE_IDS.map(id => ({ path: `docs/template-demos/videos/v1/${id}.mp4`, key: `templates/v1/${id}.mp4`, mime: "video/mp4" })),
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
