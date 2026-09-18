import { describe, expect, it } from "vitest";

import { loadApiConfig } from "./config.js";

describe("API rate-limit configuration", () => {
  it("uses Render's assigned PORT when API_PORT is absent", () => {
    expect(loadApiConfig({ PORT: "10000" }).port).toBe(10000);
    expect(loadApiConfig({ PORT: "10000", API_PORT: "8787" }).port).toBe(8787);
  });

  it("uses the locked scan, mirror and direct-connection defaults", () => {
    expect(loadApiConfig({ API_PORT: "3001" })).toMatchObject({
      requestRateLimit: {
        publicScanLimit: 20,
        authenticatedMirrorLimit: 50,
        windowSeconds: 600,
        trustedProxyHops: 0,
      },
    });
  });

  it("fails startup for unsafe rate-limit and proxy values", () => {
    expect(() => loadApiConfig({ API_PORT: "3001", SOURCE_SCAN_RATE_LIMIT: "0" })).toThrow(/source scan/i);
    expect(() => loadApiConfig({ API_PORT: "3001", RATE_LIMIT_WINDOW_SECONDS: "0" })).toThrow(/window/i);
    expect(() => loadApiConfig({ API_PORT: "3001", TRUSTED_PROXY_HOPS: "-1" })).toThrow(/proxy/i);
  });
});
