import { describe, expect, it, vi } from "vitest";

import {
  MAX_REMOTE_IMAGE_BYTES,
  createRemoteImageFetcher,
} from "./remote-image-fetcher.js";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02]);

function imageResponse(
  body: BodyInit | null = JPEG,
  options: { contentType?: string; contentLength?: number; status?: number } = {},
): Response {
  const headers = new Headers();
  if (options.contentType !== undefined) headers.set("content-type", options.contentType);
  if (options.contentLength !== undefined) {
    headers.set("content-length", String(options.contentLength));
  }
  return new Response(body, { status: options.status ?? 200, headers });
}

describe("remote image fetcher security", () => {
  it("blocks private and metadata-style addresses before making a request", async () => {
    const transport = vi.fn();
    const fetcher = createRemoteImageFetcher({
      fetch: transport,
      resolveHost: vi.fn(async () => ["169.254.169.254"]),
    });

    await expect(fetcher.fetch("http://metadata.example.test/latest/meta-data"))
      .rejects.toMatchObject({ code: "remote_image_url_blocked", status: 400 });
    expect(transport).not.toHaveBeenCalled();
  });

  it("blocks hexadecimal IPv4-mapped loopback literals without consulting DNS", async () => {
    const transport = vi.fn();
    const fetcher = createRemoteImageFetcher({ fetch: transport });

    await expect(fetcher.fetch("http://[::ffff:7f00:1]/private.jpg"))
      .rejects.toMatchObject({ code: "remote_image_url_blocked", status: 400 });
    expect(transport).not.toHaveBeenCalled();
  });

  it("revalidates DNS and blocks a redirect to a private host", async () => {
    const transport = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: { location: "http://internal.example.test/secret.jpg" },
      }),
    );
    const resolveHost = vi.fn(async (hostname: string) =>
      hostname === "public.example.test" ? ["8.8.8.8"] : ["127.0.0.1"],
    );
    const fetcher = createRemoteImageFetcher({ fetch: transport, resolveHost });

    await expect(fetcher.fetch("https://public.example.test/product.jpg"))
      .rejects.toMatchObject({ code: "remote_image_url_blocked", status: 400 });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0]?.[2]).toEqual(["8.8.8.8"]);
    expect(resolveHost).toHaveBeenNthCalledWith(2, "internal.example.test");
  });

  it("rejects a non-image MIME type even when the bytes resemble an image", async () => {
    const fetcher = createRemoteImageFetcher({
      fetch: vi.fn(async () => imageResponse(JPEG, { contentType: "text/html" })),
      resolveHost: vi.fn(async () => ["8.8.8.8"]),
    });

    await expect(fetcher.fetch("https://public.example.test/product.jpg"))
      .rejects.toMatchObject({ code: "remote_image_content_unsupported", status: 415 });
  });

  it("rejects bytes whose magic signature does not match the declared image MIME type", async () => {
    const fetcher = createRemoteImageFetcher({
      fetch: vi.fn(async () => imageResponse(JPEG, { contentType: "image/png" })),
      resolveHost: vi.fn(async () => ["8.8.8.8"]),
    });

    await expect(fetcher.fetch("https://public.example.test/product.png"))
      .rejects.toMatchObject({ code: "remote_image_signature_mismatch", status: 415 });
  });

  it("rejects an oversized declared body before reading it", async () => {
    const fetcher = createRemoteImageFetcher({
      fetch: vi.fn(async () => imageResponse(JPEG, {
        contentType: "image/jpeg",
        contentLength: MAX_REMOTE_IMAGE_BYTES + 1,
      })),
      resolveHost: vi.fn(async () => ["8.8.8.8"]),
    });

    await expect(fetcher.fetch("https://public.example.test/large.jpg"))
      .rejects.toMatchObject({ code: "remote_image_too_large", status: 413 });
  });

  it("stops a streamed response that exceeds the configured byte limit", async () => {
    const fetcher = createRemoteImageFetcher({
      fetch: vi.fn(async () => imageResponse(JPEG, { contentType: "image/jpeg" })),
      resolveHost: vi.fn(async () => ["8.8.8.8"]),
      maxBytes: 5,
    });

    await expect(fetcher.fetch("https://public.example.test/streamed-large.jpg"))
      .rejects.toMatchObject({ code: "remote_image_too_large", status: 413 });
  });

  it("applies the request deadline to DNS resolution as well as body streaming", async () => {
    const transport = vi.fn();
    const fetcher = createRemoteImageFetcher({
      fetch: transport,
      resolveHost: vi.fn(() => new Promise<string[]>(() => undefined)),
      timeoutMs: 5,
    });

    await expect(fetcher.fetch("https://slow-dns.example.test/product.jpg"))
      .rejects.toMatchObject({ code: "remote_image_timeout", status: 504, retryable: true });
    expect(transport).not.toHaveBeenCalled();
  });

  it("returns only verified bytes and records the validated public addresses", async () => {
    const transport = vi.fn(async () => imageResponse(JPEG, { contentType: "image/jpeg" }));
    const fetcher = createRemoteImageFetcher({
      fetch: transport,
      resolveHost: vi.fn(async () => ["8.8.8.8", "2606:4700:4700::1111"]),
    });

    const result = await fetcher.fetch("https://public.example.test/products/hero.jpg");
    expect(result).toMatchObject({
      canonicalUrl: "https://public.example.test/products/hero.jpg",
      mimeType: "image/jpeg",
      originalFilename: "hero.jpg",
      checksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(Array.from(result.bytes)).toEqual(Array.from(JPEG));
    expect(transport.mock.calls[0]?.[2]).toEqual([
      "8.8.8.8",
      "2606:4700:4700::1111",
    ]);
  });
});
