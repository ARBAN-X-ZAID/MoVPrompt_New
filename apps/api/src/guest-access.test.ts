import { describe, expect, it } from "vitest";
import { guestRouteAllowed, guestCookieToken, hashGuestToken } from "./guest-access.js";

describe("guest access boundary", () => {
  it("allows only creator work and watermarked output, never account or clean-output APIs", () => {
    expect(guestRouteAllowed("POST", "/api/v1/drafts/claim/start")).toBe(true);
    expect(guestRouteAllowed("POST", "/api/v1/render-runs")).toBe(true);
    expect(guestRouteAllowed("GET", "/api/v1/projects/a/render-runs/b/output")).toBe(false);
    expect(guestRouteAllowed("GET", "/api/auth/get-session")).toBe(false);
    expect(guestRouteAllowed("POST", "/api/v1/payments")).toBe(false);
  });
  it("rejects malformed cookies and persists only token digests", () => {
    expect(guestCookieToken(new Headers({cookie: "mp_guest=bad"}))).toBeNull();
    const token = "a".repeat(64);
    expect(guestCookieToken(new Headers({cookie: `mp_guest=${token}`}))).toBe(token);
    expect(hashGuestToken(token)).not.toBe(token);
    expect(hashGuestToken(token)).toHaveLength(64);
  });
});
