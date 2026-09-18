import { previewObjectKey } from "./preview-watermark.js";
import { campaignOutputText, campaignTextPng, type CampaignOutputText } from "./campaign-output-text.js";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lookup as lookupDns } from "node:dns/promises";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { request as requestHttps } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { objectKeys } from "@movprompt/storage";

import type { CampaignVoiceRenderer } from "./campaign-voice.js";
import type { RenderOutputPersister } from "./render-lifecycle.js";
import type { WorkerLogger } from "./logger.js";

export interface WorkerOutputStorage {
  readonly outputsBucket: string;
  put(input: {
    bucket: string;
    key: string;
    body: Uint8Array;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<{ bucket: string; key: string }>;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
type ResolvedAddress = { address: string; family: 4 | 6 };
type HostResolver = (hostname: string) => Promise<readonly ResolvedAddress[]>;
type MediaNormalizer = (
  bytes: Uint8Array,
  campaignVoice?: Uint8Array,
  delivery?: { aspectRatio?: "9:16" | "1:1" | "4:5" | "16:9"; campaignText?: CampaignOutputText },
) => Promise<Uint8Array>;
const execFileAsync = promisify(execFile);

export type ProviderOutputPersisterOptions = {
  logger?: WorkerLogger;
  storage: WorkerOutputStorage;
  createPreview?: (bytes: Uint8Array) => Promise<Uint8Array>;
  allowedHosts: readonly string[];
  fetcher?: Fetcher;
  /** Test/controlled resolver. Production defaults to node:dns lookup(all). */
  resolveHost?: HostResolver;
  maxBytes?: number;
  maxRedirects?: number;
  downloadTimeoutMs?: number;
  normalizer?: MediaNormalizer;
  voiceRenderer?: CampaignVoiceRenderer;
};

const DEFAULT_MAX_BYTES = 250 * 1024 * 1024;

type HostRule = { value: string };

function validHostname(hostname: string): boolean {
  return hostname.length <= 253 && hostname.split(".").every((label) =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label));
}

function normalizedHosts(hosts: readonly string[]): readonly HostRule[] {
  const normalized = hosts.map((host) => host.trim().toLowerCase()).filter(Boolean);
  if (!normalized.length) throw new Error("provider_output_hosts_required");
  return normalized.map((rule): HostRule => {
    if (rule.includes("://") || rule.includes("/") || rule.includes("*") || rule.includes(":")) {
      throw new Error("provider_output_host_rule_invalid");
    }
    if (!validHostname(rule) || isIP(rule)) throw new Error("provider_output_host_rule_invalid");
    return { value: rule };
  });
}

function hostMatches(hostname: string, rules: readonly HostRule[]): boolean {
  return rules.some((rule) => hostname === rule.value);
}

function assertAllowedUrl(raw: string, hosts: readonly HostRule[]): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("provider_output_url_invalid");
  }
  if (url.protocol !== "https:") {
    throw new Error("provider_output_url_invalid");
  }
  if (!hostMatches(url.hostname.toLowerCase(), hosts)) {
    // The hostname is safe operational evidence; never include the signed URL
    // or its query string in logs or errors.
    throw new Error(`provider_output_host_not_allowed:${url.hostname.toLowerCase()}`);
  }
  if (url.username || url.password) throw new Error("provider_output_url_credentials_not_allowed");
  return url;
}

const blockedAddresses = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4],
] as const) blockedAddresses.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b:1::", 48], ["100::", 64], ["2001::", 23],
  ["2001:db8::", 32], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) blockedAddresses.addSubnet(network, prefix, "ipv6");

function isPublicAddress(address: string, family: 4 | 6): boolean {
  if (isIP(address) !== family) return false;
  if (family === 6) {
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/iu.exec(address)?.[1];
    if (mapped) return isPublicAddress(mapped, 4);
  }
  return !blockedAddresses.check(address, family === 4 ? "ipv4" : "ipv6");
}

async function defaultResolveHost(hostname: string): Promise<readonly ResolvedAddress[]> {
  const resolved = await lookupDns(hostname, { all: true, verbatim: true });
  return resolved.flatMap((candidate) =>
    candidate.family === 4 || candidate.family === 6
      ? [{ address: candidate.address, family: candidate.family }]
      : []);
}

async function publicAddresses(hostname: string, resolver: HostResolver): Promise<readonly ResolvedAddress[]> {
  let resolved: readonly ResolvedAddress[];
  try {
    resolved = await resolver(hostname);
  } catch {
    throw new Error(`provider_output_dns_failed:${hostname}`);
  }
  if (!resolved.length || resolved.some((candidate) => !isPublicAddress(candidate.address, candidate.family))) {
    throw new Error(`provider_output_address_not_public:${hostname}`);
  }
  return resolved;
}

function isMp4(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
}

export async function normalizeDeliveryMp4(
  bytes: Uint8Array,
  campaignVoice?: Uint8Array,
  delivery?: { aspectRatio?: "9:16" | "1:1" | "4:5" | "16:9"; campaignText?: CampaignOutputText },
): Promise<Uint8Array> {
  const directory = await mkdtemp(join(tmpdir(), "movprompt-normalize-"));
  const input = join(directory, "provider-input.mp4");
  const output = join(directory, "delivery.mp4");
  const voice = join(directory, "campaign-voice.mp3");
  try {
    await writeFile(input, bytes);
    if (campaignVoice) await writeFile(voice, campaignVoice);
    const inputArguments = campaignVoice ? ["-i", input, "-i", voice] : ["-i", input];
    const audioArguments = campaignVoice
      ? ["-map", "1:a:0", "-af", "apad", "-shortest"]
      : ["-map", "0:a?"];
    let videoFilterArguments = delivery?.aspectRatio === "4:5"
      ? [
          "-vf",
          "crop='if(gt(iw/ih,4/5),ih*4/5,iw)':'if(gt(iw/ih,4/5),ih,iw*5/4)',scale=trunc(iw/2)*2:trunc(ih/2)*2",
        ]
      : [];
    let videoMap = "0:v:0";
    if (delivery?.campaignText) {
      const { stdout } = await execFileAsync(process.env.FFPROBE_PATH?.trim() || "ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", input], { timeout: 30_000, maxBuffer: 1024 * 1024 });
      const probe = JSON.parse(stdout);
      const stream = probe.streams?.[0];
      const duration = Number(probe.format?.duration);
      if (!Number.isFinite(duration) || duration <= 0 || !Number.isInteger(stream?.width) || !Number.isInteger(stream?.height)) throw new Error("campaign_overlay_invalid_media");
      let width = stream.width as number; let height = stream.height as number;
      if (delivery.aspectRatio === "4:5") {
        if (width / height > 4 / 5) width = Math.floor(height * 4 / 5 / 2) * 2;
        else height = Math.floor(width * 5 / 4 / 2) * 2;
      }
      const overlay = join(directory, "campaign-text.png");
      await writeFile(overlay, campaignTextPng(delivery.campaignText, width, height));
      const crop = videoFilterArguments[1];
      const imageIndex = campaignVoice ? 2 : 1;
      inputArguments.push("-i", overlay);
      videoFilterArguments = ["-filter_complex", `${crop ? `[0:v]${crop}[base];` : ""}[${crop ? "base" : "0:v"}][${imageIndex}:v]overlay=0:0:enable='gte(t,${Math.max(0, duration - 4)})'[campaign]`];
      videoMap = "[campaign]";
    }
    await execFileAsync(
      process.env.FFMPEG_PATH?.trim() || "ffmpeg",
      [
        "-hide_banner", "-loglevel", "error", "-y", ...inputArguments,
        "-map", videoMap, ...audioArguments, ...videoFilterArguments,
        "-c:v", "libx264", "-preset", "medium", "-crf", "16",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        output,
      ],
      { timeout: 10 * 60_000, maxBuffer: 2 * 1024 * 1024 },
    );
    const normalized = new Uint8Array(await readFile(output));
    if (!isMp4(normalized)) throw new Error("normalized_output_not_mp4");
    return normalized;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function download(
  startUrl: string,
  options: {
    fetcher: Fetcher;
    hosts: readonly HostRule[];
    maxBytes: number;
    maxRedirects: number;
    timeoutMs: number;
    resolveHost: HostResolver;
    usePinnedHttps: boolean;
  },
): Promise<Uint8Array> {
  let url = assertAllowedUrl(startUrl, options.hosts);
  for (let redirect = 0; redirect <= options.maxRedirects; redirect += 1) {
    const addresses = await publicAddresses(url.hostname, options.resolveHost);
    const response = options.usePinnedHttps
      ? await pinnedHttpsGet(url, addresses[0]!, options.maxBytes, options.timeoutMs)
      : await fetchGet(options.fetcher, url, options.maxBytes, options.timeoutMs);
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === options.maxRedirects) throw new Error("provider_output_redirect_invalid");
      url = assertAllowedUrl(new URL(location, url).toString(), options.hosts);
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`provider_output_download_failed:${response.status}`);
    }
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (contentType !== "video/mp4" && contentType !== "application/octet-stream") {
      throw new Error("provider_output_mime_invalid");
    }
    const bytes = response.body;
    if (!bytes?.byteLength) throw new Error("provider_output_empty");
    if (!isMp4(bytes)) throw new Error("provider_output_not_mp4");
    return bytes;
  }
  throw new Error("provider_output_redirect_invalid");
}

type ProviderHttpResponse = { status: number; headers: Headers; body?: Uint8Array };

function declaredLength(headers: Headers, maxBytes: number): void {
  const raw = headers.get("content-length");
  if (!raw) return;
  const length = Number(raw);
  if (!Number.isSafeInteger(length) || length < 0) throw new Error("provider_output_length_invalid");
  if (length > maxBytes) throw new Error("provider_output_too_large");
}

async function fetchGet(
  fetcher: Fetcher,
  url: URL,
  maxBytes: number,
  timeoutMs: number,
): Promise<ProviderHttpResponse> {
  const response = await fetcher(url.toString(), {
    method: "GET",
    redirect: "manual",
    headers: { accept: "video/mp4,application/octet-stream;q=0.8" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  declaredLength(response.headers, maxBytes);
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel().catch(() => undefined);
    return { status: response.status, headers: response.headers };
  }
  const reader = response.body?.getReader();
  if (!reader) return { status: response.status, headers: response.headers };
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error("provider_output_too_large");
    }
    chunks.push(value);
  }
  return {
    status: response.status,
    headers: response.headers,
    ...(byteLength ? { body: new Uint8Array(Buffer.concat(chunks, byteLength)) } : {}),
  };
}

async function pinnedHttpsGet(
  url: URL,
  address: ResolvedAddress,
  maxBytes: number,
  timeoutMs: number,
): Promise<ProviderHttpResponse> {
  return new Promise((resolve, reject) => {
    const pinnedLookup: LookupFunction = (_hostname, lookupOptions, callback) => {
      if (lookupOptions.all) {
        callback(null, [{ address: address.address, family: address.family }]);
      } else {
        callback(null, address.address, address.family);
      }
    };
    const request = requestHttps(url, {
      method: "GET",
      headers: { accept: "video/mp4,application/octet-stream;q=0.8" },
      lookup: pinnedLookup,
    }, (response) => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
        else if (value !== undefined) headers.set(name, String(value));
      }
      try {
        declaredLength(headers, maxBytes);
      } catch (error) {
        response.destroy(error instanceof Error ? error : undefined);
        reject(error);
        return;
      }
      if ((response.statusCode ?? 0) >= 300 && (response.statusCode ?? 0) < 400) {
        response.resume();
        resolve({ status: response.statusCode ?? 0, headers });
        return;
      }
      const chunks: Uint8Array[] = [];
      let byteLength = 0;
      response.on("data", (raw: Buffer) => {
        byteLength += raw.byteLength;
        if (byteLength > maxBytes) {
          response.destroy(new Error("provider_output_too_large"));
          return;
        }
        chunks.push(new Uint8Array(raw));
      });
      response.once("end", () => resolve({
        status: response.statusCode ?? 0,
        headers,
        ...(byteLength ? { body: new Uint8Array(Buffer.concat(chunks, byteLength)) } : {}),
      }));
      response.once("error", reject);
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error("provider_output_download_timeout")));
    request.once("error", reject);
    request.end();
  });
}

/**
 * Copies a provider result into MovPrompt-owned private storage before a run
 * can pass quality review. The strict host allowlist also prevents provider
 * URLs from becoming a worker-side SSRF primitive.
 */
export function createProviderOutputPersister(options: ProviderOutputPersisterOptions): RenderOutputPersister {
  const hosts = normalizedHosts(options.allowedHosts);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? 2;
  const downloadTimeoutMs = options.downloadTimeoutMs ?? 2 * 60_000;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("provider_output_max_bytes_invalid");
  if (!Number.isSafeInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > 5) {
    throw new Error("provider_output_redirect_limit_invalid");
  }
  if (!Number.isSafeInteger(downloadTimeoutMs) || downloadTimeoutMs < 1_000 || downloadTimeoutMs > 10 * 60_000) {
    throw new Error("provider_output_download_timeout_invalid");
  }
  const fetcher = options.fetcher ?? fetch;
  const resolveHost = options.resolveHost ?? defaultResolveHost;
  const normalizer = options.normalizer ?? normalizeDeliveryMp4;

  return {
    async persist(input) {
      const log = (message: string, fields: Record<string, unknown> = {}) => options.logger?.info(message, { renderRunId: input.runId, projectId: input.projectId, attemptNumber: input.attemptNumber, ...fields });
      log("render_media_download_started");
      const providerBytes = await download(input.sourceUrl, {
        fetcher,
        hosts,
        maxBytes,
        maxRedirects,
        timeoutMs: downloadTimeoutMs,
        resolveHost,
        usePinnedHttps: options.fetcher === undefined,
      });
      const campaignVoice = await options.voiceRenderer?.render(input.configuration);
      log("render_media_downloaded", { sizeBytes: providerBytes.byteLength });
      const generation = input.configuration.generation;
      const generationConfiguration = generation && typeof generation === "object" && !Array.isArray(generation)
        ? generation as Record<string, unknown>
        : input.configuration;
      const aspectRatio = generationConfiguration.aspectRatio;
      const delivery: { aspectRatio?: "9:16" | "1:1" | "4:5" | "16:9"; campaignText?: CampaignOutputText } =
        aspectRatio === "9:16" || aspectRatio === "1:1" || aspectRatio === "4:5" || aspectRatio === "16:9"
        ? { aspectRatio }
        : {};
      const campaignText = campaignOutputText(input.configuration);
      if (campaignText) delivery.campaignText = campaignText;
      const bytes = await normalizer(providerBytes, campaignVoice, Object.keys(delivery).length ? delivery : undefined);
      log("render_media_normalized", { sizeBytes: bytes.byteLength, format: delivery.aspectRatio, contactCardIncluded: Boolean(campaignText) });
      if (!bytes.byteLength || bytes.byteLength > maxBytes || !isMp4(bytes)) {
        throw new Error("normalized_output_invalid");
      }
      const checksum = createHash("sha256").update(bytes).digest("hex");
      const objectKey = objectKeys.creatorOutput({
        userId: input.userId,
        projectId: input.projectId,
        versionId: input.projectVersionId,
        outputId: `render-${input.runId}-attempt-${input.attemptNumber}.mp4`,
      });
      const saved = await options.storage.put({
        bucket: options.storage.outputsBucket,
        key: objectKey,
        body: bytes,
        contentType: "video/mp4",
        metadata: {
          "sha256-hex": checksum,
          "render-run-id": input.runId,
          "quality-attempt": String(input.attemptNumber),
          "delivery-video-codec": "h264",
          "delivery-audio-codec": "aac",
        },
      });
      log("render_clean_master_saved_r2", { sizeBytes: bytes.byteLength });
      if (options.createPreview) {
        const preview = await options.createPreview(bytes);
        await options.storage.put({ bucket: saved.bucket, key: previewObjectKey(saved.key), body: preview, contentType: "video/mp4", metadata: { "sha256-hex": createHash("sha256").update(preview).digest("hex") } });
        log("render_watermarked_preview_saved_r2", { sizeBytes: preview.byteLength });
      }
      return { bucket: saved.bucket, objectKey: saved.key };
    },
  };
}
