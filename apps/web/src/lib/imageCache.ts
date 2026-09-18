// Performance: client-side caches for image compression and scene analysis.
// - compressedCache: per-File WeakMap so re-generating with the same upload
//   doesn't re-encode the canvas → base64 (saves 100-400ms per image).
// - analysisCache: sessionStorage keyed by a fast content hash so re-analyzing
//   the same image (e.g. user reopens, navigates back) is instant.

const compressedCache = new WeakMap<File, Promise<string>>();

export function getCachedCompression(file: File): Promise<string> | undefined {
  return compressedCache.get(file);
}

export function setCachedCompression(file: File, promise: Promise<string>) {
  compressedCache.set(file, promise);
  // If the promise rejects, evict so the next call retries cleanly.
  promise.catch(() => compressedCache.delete(file));
}

// Fast non-cryptographic hash (FNV-1a 32-bit) over a base64 string.
// Good enough for cache keying — collisions are astronomically rare for our
// per-session usage and we don't need cryptographic strength here.
export function hashBase64(b64: string): string {
  let h = 0x811c9dc5;
  // Sample every Nth char for very large strings to keep this O(1)-ish.
  const step = b64.length > 50_000 ? Math.ceil(b64.length / 8000) : 1;
  for (let i = 0; i < b64.length; i += step) {
    h ^= b64.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Mix length so different sizes don't collide.
  h ^= b64.length;
  h = Math.imul(h, 0x01000193);
  return (h >>> 0).toString(36) + "_" + b64.length.toString(36);
}

const ANALYSIS_PREFIX = "movprompt.sceneAnalysis.v1:";
const ANALYSIS_TTL_MS = 60 * 60 * 1000; // 1h

export function getCachedAnalysis<T>(imageHashes: string[]): T | null {
  try {
    const key = ANALYSIS_PREFIX + imageHashes.join(",");
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; data: T };
    if (Date.now() - parsed.savedAt > ANALYSIS_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function setCachedAnalysis<T>(imageHashes: string[], data: T) {
  try {
    const key = ANALYSIS_PREFIX + imageHashes.join(",");
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // sessionStorage full or disabled — silently ignore, caching is best-effort.
  }
}
