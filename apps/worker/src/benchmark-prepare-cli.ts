import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";

import { PROVIDER_BENCHMARK_CORPUS } from "@movprompt/creative-engine";
import { r2StorageConfigFromEnv, R2Storage } from "@movprompt/storage";

import { benchmarkFactsChecksum, parseBenchmarkManifest, type BenchmarkManifest } from "./benchmark-manifest.js";

const MIME_BY_EXTENSION: Record<string, "image/jpeg" | "image/png" | "image/webp" | "video/mp4"> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_required`);
  return value;
}

function isExpectedMedia(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/webp") return Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP";
  if (mimeType === "video/mp4") return Buffer.from(bytes.subarray(4, 8)).toString("ascii") === "ftyp";
  return false;
}

if (process.env.MOVPROMPT_BENCHMARK_RIGHTS_ATTESTED !== "YES") {
  throw new Error("Set MOVPROMPT_BENCHMARK_RIGHTS_ATTESTED=YES only after confirming rights and person consent for every source asset.");
}

const sourceDirectory = resolve(required("MOVPROMPT_BENCHMARK_ASSET_DIRECTORY"));
const manifestPath = resolve(required("MOVPROMPT_BENCHMARK_MANIFEST_PATH"));
const storage = new R2Storage(r2StorageConfigFromEnv(process.env));
const subjectKeys = [...new Set(PROVIDER_BENCHMARK_CORPUS.map((brief) => `${brief.vertical}-${brief.challenge}`))].sort();
if (subjectKeys.length !== 16) throw new Error("benchmark_subject_key_count_invalid");
const referencesBySubject = new Map<string, BenchmarkManifest["items"][number]["references"]>();

for (const subjectKey of subjectKeys) {
  const directory = join(sourceDirectory, subjectKey);
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && MIME_BY_EXTENSION[extname(entry.name).toLowerCase()])
    .map((entry) => entry.name);
  const primaryFiles = entries.filter((name) => basename(name, extname(name)).toLowerCase() === "primary");
  if (primaryFiles.length !== 1) throw new Error(`benchmark_subject_requires_one_primary:${subjectKey}`);
  const ordered = [primaryFiles[0]!, ...entries.filter((name) => name !== primaryFiles[0]).sort()];
  if (ordered.length > 9) throw new Error(`benchmark_subject_reference_limit:${subjectKey}`);
  const videoCount = ordered.filter((name) => extname(name).toLowerCase() === ".mp4").length;
  if (videoCount > 3) throw new Error(`benchmark_subject_video_limit:${subjectKey}`);
  const references: BenchmarkManifest["items"][number]["references"] = [];
  for (const [index, filename] of ordered.entries()) {
    const extension = extname(filename).toLowerCase();
    const mimeType = MIME_BY_EXTENSION[extension]!;
    const bytes = new Uint8Array(await readFile(join(directory, filename)));
    const minimumBytes = mimeType === "video/mp4" ? 100_000 : 10_000;
    if (bytes.byteLength < minimumBytes || bytes.byteLength > 50 * 1024 * 1024) {
      throw new Error(`benchmark_asset_size_invalid:${subjectKey}/${filename}`);
    }
    if (!isExpectedMedia(bytes, mimeType)) throw new Error(`benchmark_asset_signature_invalid:${subjectKey}/${filename}`);
    const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
    const role = index === 0 ? "primary" : `reference-${String(index).padStart(2, "0")}`;
    const objectKey = `benchmarks/kw-48-v1/${subjectKey}/${role}-${checksumSha256}${extension}`;
    await storage.put({
      bucket: storage.assetsBucket,
      key: objectKey,
      body: bytes,
      contentType: mimeType,
      metadata: {
        "sha256-hex": checksumSha256,
        "benchmark-subject": subjectKey,
        "rights-attested": "true",
      },
    });
    references.push({ objectKey, mimeType, checksumSha256 });
  }
  referencesBySubject.set(subjectKey, references);
}

const manifest = parseBenchmarkManifest({
  version: "kw-48-assets-v1",
  items: PROVIDER_BENCHMARK_CORPUS.map((brief) => ({
    briefId: brief.id,
    factsChecksumSha256: benchmarkFactsChecksum(brief),
    rightsAttested: true,
    references: referencesBySubject.get(`${brief.vertical}-${brief.challenge}`),
  })),
});
await mkdir(dirname(manifestPath), { recursive: true });
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
process.stdout.write(`${JSON.stringify({
  manifestPath,
  subjectPacks: referencesBySubject.size,
  briefs: manifest.items.length,
  bucket: storage.assetsBucket,
})}\n`);
