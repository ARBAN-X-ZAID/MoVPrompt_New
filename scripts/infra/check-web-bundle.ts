import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const WEB_DIST = path.resolve(import.meta.dirname, "../../apps/web/dist");
const INDEX_HTML = path.join(WEB_DIST, "index.html");
const MAX_INITIAL_JAVASCRIPT_GZIP_BYTES = 300 * 1024;

const html = await readFile(INDEX_HTML, "utf8").catch(() => {
  throw new Error("apps/web/dist/index.html is missing. Run the web build first.");
});

const initialAssetUrls = new Set<string>();
for (const match of html.matchAll(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+\.js)["']/g)) {
  initialAssetUrls.add(match[1]);
}
for (const match of html.matchAll(/<link[^>]+rel=["']modulepreload["'][^>]+href=["']([^"']+\.js)["']/g)) {
  initialAssetUrls.add(match[1]);
}

if (initialAssetUrls.size === 0) {
  throw new Error("No initial JavaScript assets were found in the built index.html.");
}

let gzipBytes = 0;
const assets: Array<{ asset: string; gzipBytes: number }> = [];
for (const assetUrl of [...initialAssetUrls].sort()) {
  const assetPath = path.join(WEB_DIST, assetUrl.replace(/^\//, ""));
  const source = await readFile(assetPath);
  const compressedBytes = gzipSync(source, { level: 9 }).byteLength;
  gzipBytes += compressedBytes;
  assets.push({ asset: assetUrl, gzipBytes: compressedBytes });
}

const result = {
  status: gzipBytes <= MAX_INITIAL_JAVASCRIPT_GZIP_BYTES ? "passed" : "failed",
  gzipBytes,
  limitBytes: MAX_INITIAL_JAVASCRIPT_GZIP_BYTES,
  assets,
};

console.log(JSON.stringify(result));

if (gzipBytes > MAX_INITIAL_JAVASCRIPT_GZIP_BYTES) {
  throw new Error(
    `Initial JavaScript is ${gzipBytes} gzip bytes; the limit is ${MAX_INITIAL_JAVASCRIPT_GZIP_BYTES}.`,
  );
}
