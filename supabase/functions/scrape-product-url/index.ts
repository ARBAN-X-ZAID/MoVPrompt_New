// Scrape a product page URL for ALL candidate product images + basic metadata
// so the Ads Studio "Image URL" field can accept Amazon/Shopify/etc.
// links and let the user pick which images to use as hero + angle references.
//
// Two actions (selected by `action` in the request body):
//   - "scan"   (default): fetch the page, return { images, name, description, url }.
//                          Nothing is uploaded to storage.
//   - "mirror"          : body { hero_url, angle_urls?, referer? } — downloads
//                          those URLs and uploads them under
//                          marketing/{userId}/brand/. Returns
//                          { logo_path, logo_url, angles: [{path, url, label}] }.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

const MAX_IMAGES = 12;
const MAX_ANGLES_MIRROR = 5;
const MAX_PAGE_BYTES = 1_000_000;
const PUBLIC_SCAN_WINDOW_MS = 60_000;
const PUBLIC_SCAN_LIMIT = 12;
const scanWindows = new Map<string, { startedAt: number; count: number }>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isBlockedIp(ip: string) {
  const value = ip.toLowerCase();
  if (value === "::1" || value === "::" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

async function assertPublicHttpUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("invalid_url");
  if (url.username || url.password) throw new Error("invalid_url");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || isBlockedIp(host)) throw new Error("blocked_destination");
  const recordTypes: ("A" | "AAAA")[] = ["A", "AAAA"];
  for (const recordType of recordTypes) {
    try {
      const addresses = await Deno.resolveDns(host, recordType);
      if (addresses.some(isBlockedIp)) throw new Error("blocked_destination");
    } catch (error) {
      if (error instanceof Error && error.message === "blocked_destination") throw error;
    }
  }
  return url;
}

function enforcePublicRateLimit(request: Request) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const now = Date.now();
  const current = scanWindows.get(key);
  if (!current || now - current.startedAt >= PUBLIC_SCAN_WINDOW_MS) {
    scanWindows.set(key, { startedAt: now, count: 1 });
    return;
  }
  current.count += 1;
  if (current.count > PUBLIC_SCAN_LIMIT) throw new Error("rate_limited");
}

async function fetchPublicUrl(rawUrl: string) {
  let current = (await assertPublicHttpUrl(rawUrl)).toString();
  for (let redirect = 0; redirect <= 4; redirect += 1) {
    await assertPublicHttpUrl(current);
    const response = await fetch(current, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,image/*;q=0.8", "Accept-Language": "en-US,en;q=0.9" },
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("invalid_redirect");
      current = new URL(location, current).toString();
      continue;
    }
    return response;
  }
  throw new Error("too_many_redirects");
}

async function readLimitedText(response: Response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_PAGE_BYTES) throw new Error("page_too_large");
    result += decoder.decode(value, { stream: true });
  }
  return result + decoder.decode();
}

function abs(base: string, maybe: string | null | undefined): string | null {
  if (!maybe) return null;
  try {
    return new URL(maybe, base).toString();
  } catch {
    return null;
  }
}

function pickMeta(html: string, names: string[]): string | null {
  for (const n of names) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)\\s*=\\s*["']${n}["'][^>]*content\\s*=\\s*["']([^"']+)["']`,
      "i",
    );
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1].trim());
    const re2 = new RegExp(
      `<meta[^>]+content\\s*=\\s*["']([^"']+)["'][^>]+(?:property|name)\\s*=\\s*["']${n}["']`,
      "i",
    );
    const m2 = html.match(re2);
    if (m2?.[1]) return decodeEntities(m2[1].trim());
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // JSON-embedded escapes for Amazon \u0026, \/ etc.
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/");
}

function pickTitle(html: string): string | null {
  const og = pickMeta(html, ["og:title", "twitter:title"]);
  if (og) return og;
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1]?.trim().slice(0, 200) ?? null;
}

function pickDescription(html: string): string | null {
  return pickMeta(html, ["og:description", "twitter:description", "description"]);
}

/** Heuristic to skip sprites/icons/badges/avatars/etc. */
function looksLikeProductImage(url: string): boolean {
  const u = url.toLowerCase();
  if (u.endsWith(".svg")) return false;
  if (/sprite|icon|logo|badge|avatar|emoji|placeholder|loader|spinner|tracking|pixel|favicon/.test(u)) return false;
  // Tiny dimension hints commonly baked into CDN URLs.
  if (/[_-](\d{1,2})x(\d{1,2})\.(jpe?g|png|webp)/.test(u)) return false;
  return true;
}

function pushUnique(list: string[], url: string | null) {
  if (!url) return;
  // Normalize trailing query-only differences for dedupe.
  const key = url.split("?")[0].split("#")[0];
  if (list.some((x) => x.split("?")[0].split("#")[0] === key)) return;
  list.push(url);
}

function collectImages(html: string, base: string): string[] {
  const out: string[] = [];

  // 1) Open Graph / Twitter hero — usually the best single image.
  const og = pickMeta(html, [
    "og:image:secure_url",
    "og:image",
    "twitter:image",
    "twitter:image:src",
  ]);
  if (og) pushUnique(out, abs(base, og));

  // 2) Amazon-style image JSON blobs. Pull every hiRes/large/mainUrl URL.
  // colorImages / imageGalleryData / ImageBlockATF all surface variants.
  const amazonHiRes = html.matchAll(/"hiRes"\s*:\s*"([^"]+\.(?:jpe?g|png|webp)[^"]*)"/gi);
  for (const m of amazonHiRes) pushUnique(out, decodeEntities(m[1]));
  const amazonLarge = html.matchAll(/"large"\s*:\s*"([^"]+\.(?:jpe?g|png|webp)[^"]*)"/gi);
  for (const m of amazonLarge) pushUnique(out, decodeEntities(m[1]));
  const amazonMainUrl = html.matchAll(/"mainUrl"\s*:\s*"([^"]+\.(?:jpe?g|png|webp)[^"]*)"/gi);
  for (const m of amazonMainUrl) pushUnique(out, decodeEntities(m[1]));

  // 3) JSON-LD product images.
  const ldImg = html.matchAll(/"image"\s*:\s*"([^"]+\.(?:jpe?g|png|webp)[^"]*)"/gi);
  for (const m of ldImg) pushUnique(out, abs(base, decodeEntities(m[1])));
  // image arrays: "image": ["https://...", "https://..."]
  const ldImgArr = html.matchAll(/"image"\s*:\s*\[([^\]]+)\]/gi);
  for (const m of ldImgArr) {
    const inner = m[1];
    const urls = inner.matchAll(/"([^"]+\.(?:jpe?g|png|webp)[^"]*)"/gi);
    for (const u of urls) pushUnique(out, abs(base, decodeEntities(u[1])));
  }

  // 4) <link rel="image_src">.
  const linkImg = html.match(
    /<link[^>]+rel\s*=\s*["']image_src["'][^>]*href\s*=\s*["']([^"']+)["']/i,
  );
  if (linkImg?.[1]) pushUnique(out, abs(base, decodeEntities(linkImg[1])));

  // 5) <img> tags with real product-image attributes.
  const imgs = html.matchAll(
    /<img[^>]+(?:src|data-src|data-old-hires|data-a-hires|data-zoom-image|data-image|srcset)\s*=\s*["']([^"']+)["']/gi,
  );
  for (const m of imgs) {
    // srcset has multiple urls "url 1x, url2 2x" — take the first.
    const raw = decodeEntities(m[1]).split(/\s*,\s*/)[0].split(/\s+/)[0];
    if (!/\.(jpe?g|png|webp)(\?|#|$)/i.test(raw)) continue;
    const u = abs(base, raw);
    if (u && looksLikeProductImage(u)) pushUnique(out, u);
  }

  // Filter + cap.
  return out.filter(looksLikeProductImage).slice(0, MAX_IMAGES);
}

async function mirrorOne(opts: {
  imageUrl: string;
  referer: string;
  userId: string;
  supabase: ReturnType<typeof createClient>;
  filenamePrefix: string;
}): Promise<{ path: string; url: string | null } | null> {
  try {
    const res = await fetch(opts.imageUrl, {
      headers: { "User-Agent": UA, Accept: "image/*,*/*;q=0.8", Referer: opts.referer },
    });
    if (!res.ok) {
      console.warn("mirrorOne: bad status", res.status, opts.imageUrl);
      return null;
    }
    const ct = res.headers.get("content-type") || "image/jpeg";
    const extMatch = ct.match(/image\/(png|jpe?g|webp|gif|svg\+xml)/i);
    const ext = extMatch
      ? extMatch[1].replace("jpeg", "jpg").replace("svg+xml", "svg")
      : (opts.imageUrl.match(/\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i)?.[1] ?? "jpg").toLowerCase();
    const bytes = new Uint8Array(await res.arrayBuffer());
    const path = `marketing/${opts.userId}/brand/${opts.filenamePrefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`;
    const { error: upErr } = await opts.supabase.storage
      .from("director-uploads")
      .upload(path, bytes, { upsert: true, contentType: ct });
    if (upErr) {
      console.warn("mirrorOne: upload failed", upErr);
      return null;
    }
    const { data: signed } = await opts.supabase.storage
      .from("director-uploads")
      .createSignedUrl(path, 60 * 60);
    return { path, url: signed?.signedUrl ?? null };
  } catch (e) {
    console.warn("mirrorOne: error", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action: string = (body?.action ?? "scan").toString();

    // ─────────── MIRROR action ───────────
    if (action === "mirror") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "unauthorized" }, 401);
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return json({ error: "unauthorized" }, 401);
      const heroUrl: string | undefined = body?.hero_url;
      const angleUrls: string[] = Array.isArray(body?.angle_urls) ? body.angle_urls.slice(0, MAX_ANGLES_MIRROR) : [];
      const referer: string = (body?.referer ?? heroUrl ?? "").toString();
      if (!heroUrl || !/^https?:\/\/\S+$/i.test(heroUrl)) {
        return json({ error: "invalid_hero_url" }, 400);
      }
      const hero = await mirrorOne({
        imageUrl: heroUrl,
        referer,
        userId: userData.user.id,
        supabase,
        filenamePrefix: "hero",
      });
      if (!hero) return json({ error: "hero_mirror_failed" }, 502);

      const angles: { path: string; url: string | null; label: string | null }[] = [];
      const labels = ["front", "back", "side", "top", "packaging"];
      for (let i = 0; i < angleUrls.length; i++) {
        const u = angleUrls[i];
        if (!/^https?:\/\/\S+$/i.test(u)) continue;
        const a = await mirrorOne({
          imageUrl: u,
          referer,
          userId: userData.user.id,
          supabase,
          filenamePrefix: "angle",
        });
        if (a) angles.push({ ...a, label: labels[i] ?? null });
      }

      return json({
        logo_path: hero.path,
        logo_url: hero.url,
        angles,
      });
    }

    // ─────────── SCAN action (default) ───────────
    const rawUrl: string = (body?.url ?? "").toString().trim();
    if (!/^https?:\/\/\S+$/i.test(rawUrl)) {
      return json({ error: "invalid_url" }, 400);
    }

    enforcePublicRateLimit(req);
    let pageRes: Response;
    try {
      pageRes = await fetchPublicUrl(rawUrl);
    } catch (e) {
      console.warn("scrape-product-url: fetch failed", e);
      return json({ error: "fetch_failed" }, 502);
    }

    if (!pageRes.ok) {
      return json({ error: "page_fetch_failed", status: pageRes.status }, 502);
    }

    const finalUrl = pageRes.url || rawUrl;
    const contentType = pageRes.headers.get("content-type") || "";

    // Direct image link → return as the only candidate.
    if (contentType.startsWith("image/")) {
      return json({ images: [finalUrl], name: null, description: null, url: finalUrl });
    }
    if (!contentType.includes("html")) {
      return json({ error: "not_html", contentType }, 415);
    }

    const html = await readLimitedText(pageRes);

    const images = collectImages(html, finalUrl);
    if (images.length === 0) {
      return json({ error: "no_image_found" }, 404);
    }

    const rawName = pickTitle(html);
    const name = rawName
      ? rawName.split(/[|–—]/)[0].trim().slice(0, 120)
      : null;
    const description = pickDescription(html)?.slice(0, 240) ?? null;

    return json({ images, name, description, url: finalUrl });
  } catch (err) {
    console.error("scrape-product-url error", err);
    const code = err instanceof Error ? err.message : "unknown";
    return json({ error: code }, code === "rate_limited" ? 429 : code === "blocked_destination" || code === "invalid_url" ? 400 : 500);
  }
});
