import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { R2Storage, r2StorageConfigFromEnv } from "../../../packages/storage/src/index.ts";

// Publishes only the existing user-approved example; no generation or database writes.
const storage = new R2Storage(r2StorageConfigFromEnv());
if (!storage.previewsBucket) throw new Error("preview_bucket_missing");
const objects = [];
for (const [file, key, contentType] of [
  ["photoreal-purse-car-15s.mp4", "templates/v2/product-with-model-ad-car-15s.mp4", "video/mp4"],
  ["preview-v2.jpg", "templates/v2/product-with-model-ad-car.jpg", "image/jpeg"],
]) {
  const body = await readFile(new URL(file!, import.meta.url));
  const checksum = createHash("sha256").update(body).digest("hex");
  if (contentType === "video/mp4" && checksum !== "eae401bd749002ed3e1ff267b181c7edb4fac2da2e2facc78f617d56fdb2e0f0") throw new Error("approved_video_changed");
  await storage.put({ bucket: storage.previewsBucket, key: key!, body, contentType: contentType!, metadata: { "sha256-hex": checksum } });
  const verified = await storage.get({ bucket: storage.previewsBucket, key: key!, maxBytes: 64 * 1024 * 1024 });
  if (createHash("sha256").update(verified.body).digest("hex") !== checksum) throw new Error("checksum_mismatch");
  objects.push({ objectKey: key, checksum, bytes: body.byteLength });
}
await writeFile(new URL("published-v2.json", import.meta.url), JSON.stringify({ recipeVersion: 2, durationSeconds: 15, objects }, null, 2));
console.log(JSON.stringify({ status: "published_and_readback_verified", objects }));
