import { resolve4, resolve6 } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { Readable } from "node:stream";

export const DEFAULT_REMOTE_TIMEOUT_MS = 8_000;
export const MAX_REMOTE_REDIRECTS = 3;

export type ResolvePublicHost = (hostname: string) => Promise<string[]>;
export type PublicRemoteFetchTransport = (
  input: string,
  init: RequestInit,
  pinnedAddresses?: readonly string[],
) => Promise<Response>;

export class RemoteNetworkPolicyError extends Error {
  constructor(readonly kind: "invalid" | "blocked" | "unreachable" | "timeout" | "redirect") {
    super(kind);
  }
}

function ipv4Number(address: string): number {
  return address.split(".").reduce((value, part) => (value << 8) + Number(part), 0) >>> 0;
}

function inV4Range(address: string, base: string, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4Number(address) & mask) === (ipv4Number(base) & mask);
}

export function isPublicAddress(address: string): boolean {
  const normalized = address.split("%")[0]!.toLowerCase();
  const version = isIP(normalized);
  if (version === 4) {
    return ![
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
      ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
      ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
      ["224.0.0.0", 4], ["240.0.0.0", 4],
    ].some(([base, prefix]) => inV4Range(normalized, base as string, prefix as number));
  }
  if (version === 6) {
    if (normalized.startsWith("::ffff:")) {
      const mapped = normalized.slice("::ffff:".length);
      return isIP(mapped) === 4 ? isPublicAddress(mapped) : false;
    }
    return !(
      normalized === "::" || normalized === "::1" || normalized.startsWith("::") ||
      normalized.startsWith("fc") || normalized.startsWith("fd") || /^fe[89ab]/.test(normalized) ||
      /^fe[c-f]/.test(normalized) || normalized.startsWith("ff") ||
      normalized.startsWith("64:ff9b:") || normalized.startsWith("2001:db8")
    );
  }
  return false;
}

export function parsePublicHttpUrl(value: string, base?: URL): URL {
  let url: URL;
  try { url = base ? new URL(value, base) : new URL(value); } catch { throw new RemoteNetworkPolicyError("invalid"); }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
    throw new RemoteNetworkPolicyError("invalid");
  }
  return url;
}

export async function defaultResolvePublicHost(hostname: string): Promise<string[]> {
  if (isIP(hostname)) return [hostname];
  const [v4, v6] = await Promise.all([resolve4(hostname).catch(() => []), resolve6(hostname).catch(() => [])]);
  return [...v4, ...v6];
}

export async function pinnedNodeFetch(input: string, init: RequestInit, pinnedAddresses: readonly string[] = []): Promise<Response> {
  const url = new URL(input);
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  if (!pinnedAddresses.length) throw new Error("A validated public address is required.");
  return new Promise<Response>((resolve, reject) => {
    const requestHeaders: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => { requestHeaders[key] = value; });
    const clientRequest = request(url, {
      method: init.method ?? "GET", headers: requestHeaders, signal: init.signal ?? undefined,
      lookup: (_hostname, options, callback) => {
        const records = pinnedAddresses.map((address) => ({ address, family: isIP(address) }));
        if (options.all) callback(null, records); else callback(null, records[0]!.address, records[0]!.family);
      },
    }, (incoming) => {
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) value.forEach((item) => headers.append(key, item)); else if (value !== undefined) headers.set(key, value);
      }
      resolve(new Response(Readable.toWeb(incoming) as ReadableStream<Uint8Array>, { status: incoming.statusCode ?? 500, ...(incoming.statusMessage ? { statusText: incoming.statusMessage } : {}), headers }));
    });
    clientRequest.once("error", reject); clientRequest.end();
  });
}

function abortPromise(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const abort = () => reject(new RemoteNetworkPolicyError("timeout"));
    if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
  });
}

export function createPublicRemoteRequestPolicy(options: {
  fetch?: PublicRemoteFetchTransport;
  resolveHost?: ResolvePublicHost;
  timeoutMs?: number;
  maxRedirects?: number;
} = {}) {
  const fetcher = options.fetch ?? pinnedNodeFetch;
  const resolveHost = options.resolveHost ?? defaultResolvePublicHost;
  const timeoutMs = options.timeoutMs ?? DEFAULT_REMOTE_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? MAX_REMOTE_REDIRECTS;

  return {
    async fetch<T>(initialUrl: URL, input: {
      headers: HeadersInit;
      consume: (value: { response: Response; url: URL; signal: AbortSignal }) => Promise<T>;
    }): Promise<T> {
      let url = initialUrl;
      for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          let addresses: string[];
          try {
            addresses = await Promise.race([resolveHost(url.hostname), abortPromise(controller.signal)]);
          } catch (error) {
            if (error instanceof RemoteNetworkPolicyError) throw error;
            throw new RemoteNetworkPolicyError("unreachable");
          }
          if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) throw new RemoteNetworkPolicyError("blocked");
          let response: Response;
          try {
            response = await Promise.race([
              fetcher(url.toString(), { method: "GET", redirect: "manual", signal: controller.signal, headers: input.headers }, addresses),
              abortPromise(controller.signal),
            ]);
          } catch (error) {
            if (error instanceof RemoteNetworkPolicyError) throw error;
            throw new RemoteNetworkPolicyError("unreachable");
          }
          if ([301, 302, 303, 307, 308].includes(response.status)) {
            const location = response.headers.get("location");
            await response.body?.cancel().catch(() => undefined);
            if (!location || redirect === maxRedirects) throw new RemoteNetworkPolicyError("redirect");
            url = parsePublicHttpUrl(location, url);
            continue;
          }
          return await Promise.race([input.consume({ response, url, signal: controller.signal }), abortPromise(controller.signal)]);
        } finally { clearTimeout(timer); }
      }
      throw new RemoteNetworkPolicyError("redirect");
    },
  };
}
