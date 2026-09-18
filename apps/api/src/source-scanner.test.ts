import { describe, expect, it, vi } from "vitest";

import { createSourceScanner, isPublicAddress } from "./source-scanner.js";

describe("source scanner security", () => {
  it("blocks private, loopback, link-local, documentation and metadata-style addresses", () => {
    expect(isPublicAddress("127.0.0.1")).toBe(false);
    expect(isPublicAddress("10.10.0.2")).toBe(false);
    expect(isPublicAddress("169.254.169.254")).toBe(false);
    expect(isPublicAddress("192.168.1.1")).toBe(false);
    expect(isPublicAddress("203.0.113.5")).toBe(false);
    expect(isPublicAddress("::1")).toBe(false);
    expect(isPublicAddress("::127.0.0.1")).toBe(false);
    expect(isPublicAddress("::ffff:127.0.0.1")).toBe(false);
    expect(isPublicAddress("::ffff:7f00:1")).toBe(false);
    expect(isPublicAddress("fd00::1")).toBe(false);
    expect(isPublicAddress("fec0::1")).toBe(false);
    expect(isPublicAddress("64:ff9b::7f00:1")).toBe(false);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
    expect(isPublicAddress("8.8.8.8")).toBe(true);
  });

  it("revalidates the host after every redirect", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "http://internal.test/admin" } }),
      );
    const scanner = createSourceScanner({
      fetch: fetcher,
      resolveHost: vi.fn(async (hostname) =>
        hostname === "public.test" ? ["8.8.8.8"] : ["127.0.0.1"],
      ),
    });
    await expect(
      scanner.scan({
        url: "https://public.test/product",
        kind: "product",
        requestId: "request-scan-redirect",
      }),
    ).rejects.toMatchObject({ code: "source_url_blocked", status: 400 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[2]).toEqual(["8.8.8.8"]);
  });

  it("passes only the validated public addresses to the network transport", async () => {
    const fetcher = vi.fn(async () => new Response("<title>Public business</title>", {
      status: 200,
      headers: { "content-type": "text/html" },
    }));
    const scanner = createSourceScanner({
      fetch: fetcher,
      resolveHost: vi.fn(async () => ["8.8.8.8", "2606:4700:4700::1111"]),
    });
    await scanner.scan({
      url: "https://public.example.test",
      kind: "business",
      requestId: "request-pinned-dns",
    });
    expect(fetcher.mock.calls[0]?.[2]).toEqual(["8.8.8.8", "2606:4700:4700::1111"]);
  });

  it("extracts imported facts while clearly warning that users must confirm them", async () => {
    const html = `<!doctype html><html><head>
      <title>Fallback title</title>
      <meta property="og:title" content="Northfield No. 07">
      <meta name="description" content="A clean premium fragrance.">
      <meta property="product:price:amount" content="12.500">
      <meta property="og:image" content="/images/hero.jpg">
    </head><body><img src="https://cdn.example.test/angle.jpg"></body></html>`;
    const scanner = createSourceScanner({
      fetch: vi.fn(async () =>
        new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }),
      ),
      resolveHost: vi.fn(async () => ["8.8.8.8"]),
    });
    const result = await scanner.scan({
      url: "https://shop.example.test/products/no-07",
      kind: "product",
      requestId: "request-scan-product",
    });
    expect(result.facts).toEqual([
      { field: "name", value: "Northfield No. 07", provenance: "imported" },
      { field: "description", value: "A clean premium fragrance.", provenance: "imported" },
      { field: "price", value: "12.500", provenance: "imported" },
    ]);
    expect(result.imageCandidates).toEqual([
      "https://shop.example.test/images/hero.jpg",
      "https://cdn.example.test/angle.jpg",
    ]);
    expect(result.warnings[0]).toMatch(/confirm every imported fact/i);
  });

  it("stops streaming an oversized page", async () => {
    const scanner = createSourceScanner({
      fetch: vi.fn(async () =>
        new Response("x".repeat(2 * 1024 * 1024 + 1), {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
      resolveHost: vi.fn(async () => ["8.8.8.8"]),
    });
    await expect(
      scanner.scan({
        url: "https://public.test/too-large",
        kind: "business",
        requestId: "request-scan-large",
      }),
    ).rejects.toMatchObject({ code: "source_too_large", status: 413 });
  });
});
