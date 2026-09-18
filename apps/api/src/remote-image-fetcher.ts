import { createHash } from "node:crypto";
import { resolve4, resolve6 } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";

import { ApiHttpError } from "./errors.js";
import {
  DEFAULT_REMOTE_TIMEOUT_MS,
  MAX_REMOTE_REDIRECTS,
  defaultResolvePublicHost,
  isPublicAddress,
  parsePublicHttpUrl,
  pinnedNodeFetch as sharedPinnedNodeFetch,
} from "./network-media-policy.js";

export const MAX_REMOTE_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_REDIRECTS = MAX_REMOTE_REDIRECTS;
const DEFAULT_TIMEOUT_MS = DEFAULT_REMOTE_TIMEOUT_MS;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ResolveRemoteImageHost = (hostname: string) => Promise<string[]>;
export type RemoteImageFetchTransport = (
  input: string,
  init: RequestInit,
  pinnedAddresses?: readonly string[],
) => Promise<Response>;

export type FetchedRemoteImage = {
  canonicalUrl: string;
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  checksumSha256: string;
  originalFilename: string;
};

export interface RemoteImageFetcher {
  fetch(url: string): Promise<FetchedRemoteImage>;
}

export type RemoteImageFetcherOptions = {
  fetch?: RemoteImageFetchTransport;
  resolveHost?: ResolveRemoteImageHost;
  timeoutMs?: number;
  maxBytes?: number;
};

async function defaultResolveHost(hostname: string): Promise<string[]> {
  const normalizedHostname = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
  if (isIP(normalizedHostname)) return [normalizedHostname];
  const [v4, v6] = await Promise.all([
    resolve4(normalizedHostname).catch(() => []),
    resolve6(normalizedHostname).catch(() => []),
  ]);
  return [...v4, ...v6];
}

function remoteImageUrl(value: string, base?: URL): URL {
  try {
    return parsePublicHttpUrl(value, base);
  } catch {
    throw new ApiHttpError({
      code: "invalid_remote_image_url",
      message: "The selected image link is invalid.",
      status: 400,
      retryable: false,
    });
  }
}

async function resolvePublicHost(
  url: URL,
  resolveHost: ResolveRemoteImageHost,
): Promise<string[]> {
  let addresses: string[];
  try {
    addresses = await resolveHost(url.hostname);
  } catch {
    throw new ApiHttpError({
      code: "remote_image_fetch_failed",
      message: "MovPrompt could not reach the selected image.",
      status: 422,
      retryable: true,
    });
  }
  if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) {
    throw new ApiHttpError({
      code: "remote_image_url_blocked",
      message: "The selected image does not resolve to a public address.",
      status: 400,
      retryable: false,
    });
  }
  return addresses;
}

async function pinnedNodeFetch(
  input: string,
  init: RequestInit,
  pinnedAddresses: readonly string[] = [],
): Promise<Response> {
  const url = new URL(input);
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  if (!pinnedAddresses.length) throw new Error("A validated public address is required.");

  return new Promise<Response>((resolve, reject) => {
    const requestHeaders: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      requestHeaders[key] = value;
    });
    const clientRequest = request(
      url,
      {
        method: init.method ?? "GET",
        headers: requestHeaders,
        signal: init.signal ?? undefined,
        lookup: (_hostname, options, callback) => {
          const records = pinnedAddresses.map((address) => ({ address, family: isIP(address) }));
          if (options.all) callback(null, records);
          else callback(null, records[0]!.address, records[0]!.family);
        },
      },
      (incoming) => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(incoming.headers)) {
          if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
          else if (value !== undefined) headers.set(key, value);
        }
        resolve(
          new Response(Readable.toWeb(incoming) as ReadableStream<Uint8Array>, {
            status: incoming.statusCode ?? 500,
            ...(incoming.statusMessage ? { statusText: incoming.statusMessage } : {}),
            headers,
          }),
        );
      },
    );
    clientRequest.once("error", reject);
    clientRequest.end();
  });
}

function normalizedMimeType(response: Response): FetchedRemoteImage["mimeType"] {
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new ApiHttpError({
      code: "remote_image_content_unsupported",
      message: "The selected link did not return a supported JPG, PNG or WebP image.",
      status: 415,
      retryable: false,
    });
  }
  return mimeType as FetchedRemoteImage["mimeType"];
}

function hasMatchingMagic(bytes: Uint8Array, mimeType: FetchedRemoteImage["mimeType"]): boolean {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((value, index) => bytes[index] === value);
  }
  return (
    bytes.length >= 12 &&
    Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"
  );
}

async function readLimitedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new ApiHttpError({
      code: "remote_image_too_large",
      message: "The selected image is larger than 12 MB.",
      status: 413,
      retryable: false,
    });
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new ApiHttpError({
      code: "remote_image_invalid",
      message: "The selected image was empty.",
      status: 415,
      retryable: false,
    });
  }
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new ApiHttpError({
        code: "remote_image_too_large",
        message: "The selected image is larger than 12 MB.",
        status: 413,
        retryable: false,
      });
    }
    chunks.push(value);
  }
  if (!byteLength) {
    throw new ApiHttpError({
      code: "remote_image_invalid",
      message: "The selected image was empty.",
      status: 415,
      retryable: false,
    });
  }
  return Buffer.concat(chunks, byteLength);
}

function safeFilename(url: URL, mimeType: FetchedRemoteImage["mimeType"]): string {
  const extension = mimeType === "image/jpeg" ? ".jpg" : mimeType === "image/png" ? ".png" : ".webp";
  let filename = "";
  try {
    filename = decodeURIComponent(url.pathname.split("/").pop() ?? "");
  } catch {
    filename = "";
  }
  filename = [...filename]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint > 31 && codePoint !== 127 && character !== "/" && character !== "\\";
    })
    .join("")
    .trim();
  if (!filename) return `imported-product${extension}`;
  if (!/\.(?:jpe?g|png|webp)$/i.test(filename)) filename += extension;
  return filename.slice(0, 255);
}

function translateNetworkError(error: unknown): ApiHttpError {
  if (error instanceof ApiHttpError) return error;
  if (error instanceof Error && error.name === "AbortError") {
    return new ApiHttpError({
      code: "remote_image_timeout",
      message: "The selected image took too long to download.",
      status: 504,
      retryable: true,
    });
  }
  return new ApiHttpError({
    code: "remote_image_fetch_failed",
    message: "MovPrompt could not download the selected image.",
    status: 422,
    retryable: true,
  });
}

function rejectWhenAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const rejectAbort = () => {
      const error = new Error("Remote image request timed out.");
      error.name = "AbortError";
      reject(error);
    };
    if (signal.aborted) rejectAbort();
    else signal.addEventListener("abort", rejectAbort, { once: true });
  });
}

export function createRemoteImageFetcher(
  options: RemoteImageFetcherOptions = {},
): RemoteImageFetcher {
  const fetcher = options.fetch ?? sharedPinnedNodeFetch;
  const resolveHost = options.resolveHost ?? defaultResolvePublicHost;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? MAX_REMOTE_IMAGE_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_REMOTE_IMAGE_BYTES) {
    throw new Error(`Remote image limit must be between 1 and ${MAX_REMOTE_IMAGE_BYTES} bytes.`);
  }

  return {
    async fetch(inputUrl) {
      let url = remoteImageUrl(inputUrl);
      for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          // The same deadline covers DNS resolution, connection, headers and
          // streamed body consumption. A slow resolver cannot bypass it.
          const pinnedAddresses = await Promise.race([
            resolvePublicHost(url, resolveHost),
            rejectWhenAborted(controller.signal),
          ]);
          const response = await fetcher(
            url.toString(),
            {
              method: "GET",
              redirect: "manual",
              signal: controller.signal,
              headers: {
                accept: "image/jpeg,image/png,image/webp",
                "user-agent": "MovPromptRemoteImageMirror/1.0",
              },
            },
            pinnedAddresses,
          );

          if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get("location");
            await response.body?.cancel().catch(() => undefined);
            if (!location || redirect === MAX_REDIRECTS) {
              throw new ApiHttpError({
                code: "remote_image_redirect_invalid",
                message: "The selected image redirected too many times.",
                status: 422,
                retryable: false,
              });
            }
            url = remoteImageUrl(location, url);
            continue;
          }

          if (!response.ok) {
            await response.body?.cancel().catch(() => undefined);
            throw new ApiHttpError({
              code: "remote_image_fetch_failed",
              message: "The selected image could not be downloaded.",
              status: 422,
              retryable: true,
            });
          }

          let mimeType: FetchedRemoteImage["mimeType"];
          try {
            mimeType = normalizedMimeType(response);
          } catch (error) {
            await response.body?.cancel().catch(() => undefined);
            throw error;
          }
          const bytes = await readLimitedBody(response, maxBytes);
          if (!hasMatchingMagic(bytes, mimeType)) {
            throw new ApiHttpError({
              code: "remote_image_signature_mismatch",
              message: "The selected file contents do not match its image type.",
              status: 415,
              retryable: false,
            });
          }
          return {
            canonicalUrl: url.toString(),
            bytes,
            mimeType,
            checksumSha256: createHash("sha256").update(bytes).digest("hex"),
            originalFilename: safeFilename(url, mimeType),
          };
        } catch (error) {
          throw translateNetworkError(error);
        } finally {
          clearTimeout(timer);
        }
      }

      throw new ApiHttpError({
        code: "remote_image_redirect_invalid",
        message: "The selected image redirected too many times.",
        status: 422,
        retryable: false,
      });
    },
  };
}
