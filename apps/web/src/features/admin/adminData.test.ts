import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { PortableApiError } from "@/lib/api/portableApiClient";
import { formatDuration, formatKwd } from "./adminData";
import { configureAdminQueries, invalidateAdminData } from "./adminQueries";

describe("admin formatting", () => {
  it("shows money with thousands and three decimals", () => {
    expect(formatKwd(17_805_000)).toBe("17,805.000 KWD");
    expect(formatKwd(500)).toBe("0.500 KWD");
    expect(formatKwd(null)).toBe("0.000 KWD");
  });
  it("shows long processing times in minutes", () => {
    expect(formatDuration(1151, false)).toBe("19 min 11 sec");
    expect(formatDuration(42, false)).toBe("42 sec");
    expect(formatDuration(0, false)).toBe("0 sec");
    expect(formatDuration(1151, true)).toBe("19 د 11 ث");
  });
});

describe("admin query behaviour", () => {
  it("caches admin data, skips focus refetches and retries only temporary failures", () => {
    const client = new QueryClient();
    configureAdminQueries(client);
    const defaults = client.getQueryDefaults(["admin", "customers"]);
    expect(defaults.staleTime).toBe(30_000);
    expect(defaults.refetchOnWindowFocus).toBe(false);
    const retry = defaults.retry as (failures: number, error: Error) => boolean;
    expect(retry(0, new PortableApiError("busy", "busy", true, undefined, 503))).toBe(true);
    expect(retry(1, new PortableApiError("busy", "busy", true, undefined, 503))).toBe(false);
    expect(retry(0, new PortableApiError("no", "forbidden", false, undefined, 403))).toBe(false);
    expect(retry(0, new Error("plain"))).toBe(false);
  });
  it("does not leak admin defaults to customer queries", () => {
    const client = new QueryClient();
    configureAdminQueries(client);
    expect(client.getQueryDefaults(["projects"]).staleTime).toBeUndefined();
  });
  it("refreshes data after a change without re-checking identity", () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    invalidateAdminData(client);
    const { predicate } = invalidate.mock.calls[0]![0]! as unknown as { predicate: (query: { queryKey: unknown[] }) => boolean };
    expect(predicate({ queryKey: ["admin", "identity"] })).toBe(false);
    expect(predicate({ queryKey: ["admin", "customers"] })).toBe(true);
  });
});
