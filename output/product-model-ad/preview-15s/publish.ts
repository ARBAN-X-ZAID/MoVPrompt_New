import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { R2Storage, r2StorageConfigFromEnv } from "../../../packages/storage/src/index.ts";

// Run only after sampled visual review; never writes MongoDB or changes existing previews.
if (process.env.MOVPROMPT_APPROVE_MODEL_AD_PREVIEW !== "VISUALLY_REVIEWED") throw new Error("visual_review_required");
const storage = new R2Storage(r2StorageConfigFromEnv());
if (!storage.previewsBucket) throw new Error("preview_bucket_missing");
await storage.checkBucket(storage.previewsBucket);
const results = [];
for (const [file, key, contentType] of [
  ["product-model-ad-purse-15s.mp4", "templates/v1/product-with-model-ad-15s.mp4", "video/mp4"],
  ["product-with-model-ad.jpg", "templates/v1/product-with-model-ad.jpg", "image/jpeg"],
]) {
  const body = await readFile(resolve(import.meta.dir, file!));
  const checksum = createHash("sha256").update(body).digest("hex");
  await storage.put({ bucket: storage.previewsBucket, key: key!, body, contentType: contentType!, metadata: { "sha256-hex": checksum } });
  const actual = await storage.get({ bucket: storage.previewsBucket, key: key!, maxBytes: 64 * 1024 * 1024 });
  if (createHash("sha256").update(actual.body).digest("hex") !== checksum) throw new Error("preview_readback_checksum_failed");
  results.push({ objectKey: key, checksum, bytes: body.byteLength });
}
await writeFile(resolve(import.meta.dir, "published.json"), JSON.stringify({ publishedAt: new Date().toISOString(), durationSeconds: 15, recipeVersion: 1, objects: results }, null, 2));
console.info(JSON.stringify({ status: "preview_and_poster_readback_verified", objects: results }));
