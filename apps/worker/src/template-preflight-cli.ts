import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { imageDimensions, validateSeedanceSourceImage } from "./gateway-video-smoke.js";
import { buildTemplatePreflightManifest } from "./template-generation-preflight.js";

const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url));
const referencePath = resolve(workspaceRoot, "apps/web/public/create/sample-kinza.jpg");
const bytes = await readFile(referencePath);
const dimensions = imageDimensions(bytes, "image/jpeg");
const source = validateSeedanceSourceImage({
  model: {
    id: "bytedance/seedance-2.5",
    type: "video",
    video_capabilities: {
      supported_operations: ["image-to-video"],
      supported_resolutions: ["480p", "720p"],
      supported_aspect_ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"],
      supported_durations_seconds: Array.from({ length: 27 }, (_, index) => index + 4),
      generate_audio: true,
      supported_fps: [24],
      input_limits: {
        image: {
          max_count: 30,
          max_file_size_mb: 30,
          supported_formats: ["jpeg", "png", "webp", "bmp", "tiff", "gif", "heic", "heif"],
          min_dimension_pixels: 300,
          max_dimension_pixels: 6000,
          min_aspect_ratio: "2:5",
          max_aspect_ratio: "5:2",
        },
      },
    },
  },
  path: referencePath,
  bytes,
  ...dimensions,
});
const manifest = buildTemplatePreflightManifest({
  path: referencePath,
  mimeType: source.mimeType,
  bytes: bytes.byteLength,
  ...dimensions,
  checksumSha256: source.checksumSha256,
});
const outputDirectory = resolve(workspaceRoot, "artifacts", "generation-preflight");
const outputPath = resolve(outputDirectory, "seedance-25-kinza-all-templates.json");
await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({
  status: manifest.status,
  paidProviderCalls: manifest.paidProviderCalls,
  templateCount: manifest.templateCount,
  caseCount: manifest.caseCount,
  outputPath,
}, null, 2)}\n`);
