import {
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";

import {
  R2Storage,
  objectKeys,
  r2StorageConfigFromEnv,
} from "../../packages/storage/src/index.ts";

const config = r2StorageConfigFromEnv(process.env);
const client = new S3Client({
  endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
  region: "auto",
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },

  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

for (const bucket of new Set([config.assetsBucket, config.outputsBucket, config.previewsBucket])) {
  if (bucket) await new R2Storage(config, client).checkBucket(bucket);
}

const bytes = new TextEncoder().encode(`movprompt-storage-check:${crypto.randomUUID()}`);
const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
const key = objectKeys.creatorAsset({
  userId: "storage-check-user",
  projectId: "storage-check-project",
  assetId: crypto.randomUUID(),
  kind: "reference",
  checksumSha256,
});
const storage = new R2Storage(config, client);
for (const bucket of new Set([storage.assetsBucket, storage.outputsBucket])) {
  try {
    const signedUpload = await storage.signUpload({ bucket, key, metadata: { mimeType: "image/png", sizeBytes: bytes.byteLength, checksumSha256 } });
    const upload = await fetch(signedUpload.url, { method: signedUpload.method, headers: signedUpload.headers, body: bytes, signal: AbortSignal.timeout(30_000) });
    if (!upload.ok) throw new Error(`Signed upload failed with HTTP ${upload.status}`);
    const signedDownload = await storage.signDownload({ bucket, key });
    const download = await fetch(signedDownload.url, { signal: AbortSignal.timeout(30_000) });
    if (!download.ok) throw new Error(`Signed download failed with HTTP ${download.status}`);
    const downloadedChecksum = createHash("sha256").update(new Uint8Array(await download.arrayBuffer())).digest("hex");
    if (downloadedChecksum !== checksumSha256) throw new Error("R2 checksum mismatch");
    const head = await storage.head(bucket, key);
    if (head.ContentLength !== bytes.byteLength) throw new Error("R2 content length mismatch");
    const unsigned = new URL(signedDownload.url); unsigned.search = "";
    const anonymous = await fetch(unsigned, { signal: AbortSignal.timeout(30_000) });
    if (anonymous.ok) throw new Error("R2 protocol endpoint allowed an unsigned private read");
  } finally {
    // This unique probe key is the only object the command can delete.
    await storage.delete(bucket, key);
  }
  try {
    await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    throw new Error("Object remained after the deletion check");
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status !== 404) throw error;
  }
}
console.info("Private R2 storage passed signed upload/download/delete and checksum checks. Confirm public access is disabled in the Cloudflare dashboard.");
