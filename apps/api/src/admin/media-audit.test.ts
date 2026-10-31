import { describe, expect, it } from "vitest";
import { createMediaOpenLog } from "./media-audit.js";
import { cacheableAdminMedia } from "./routes.js";
import { createTtlCache } from "./ttl-cache.js";

const video = { kind: "generation", id: "a".repeat(24), download: false };

describe("media open audit", () => {
  it("records an open and lets only its follow-up ranges skip the audit", () => {
    const log = createMediaOpenLog();
    expect(log.needsAudit("session", video)).toBe(true);
    log.recorded("session", video);
    expect(log.needsAudit("session", { ...video, range: "bytes=1048576-" })).toBe(false);
    expect(log.needsAudit("session", { ...video, range: "bytes=0-" })).toBe(true);
  });
  it("never lets a crafted range reach unopened media unrecorded", () => {
    const log = createMediaOpenLog();
    expect(log.needsAudit("session", { ...video, range: "bytes=1-" })).toBe(true);
    expect(log.needsAudit("session", { ...video, range: "bytes=-1024" })).toBe(true);
    log.recorded("other-session", video);
    expect(log.needsAudit("session", { ...video, range: "bytes=1-" })).toBe(true);
    log.recorded("session", { ...video, id: "b".repeat(24) });
    expect(log.needsAudit("session", { ...video, range: "bytes=1-" })).toBe(true);
  });
  it("always records downloads and restricted views, and old opens expire", () => {
    let now = 0;
    const log = createMediaOpenLog(() => now);
    log.recorded("session", video);
    expect(log.needsAudit("session", { ...video, download: true, range: "bytes=9-" })).toBe(true);
    expect(log.needsAudit("session", { ...video, restricted: true, range: "bytes=9-" })).toBe(true);
    now = 31 * 60 * 1000;
    expect(log.needsAudit("session", { ...video, range: "bytes=9-" })).toBe(true);
  });
  it("only allows browser caching of plain views of immutable media", () => {
    expect(cacheableAdminMedia("generation", false, false)).toBe(true);
    expect(cacheableAdminMedia("campaign", false, false)).toBe(true);
    for (const kind of ["asset", "owned"]) expect(cacheableAdminMedia(kind, false, false)).toBe(false);
    expect(cacheableAdminMedia("generation", true, false)).toBe(false);
    expect(cacheableAdminMedia("generation", false, true)).toBe(false);
  });
});

describe("short aggregate cache", () => {
  it("shares one load per key until the entry expires", async () => {
    let now = 0;
    let loads = 0;
    const read = createTtlCache<number, number>(1000, { now: () => now });
    const load = async () => ++loads;
    expect(await Promise.all([read(1, load), read(1, load)])).toEqual([1, 1]);
    expect(await read(2, load)).toBe(2);
    now = 999;
    expect(await read(1, load)).toBe(1);
    now = 1000;
    expect(await read(1, load)).toBe(3);
  });
  it("never keeps a failure or a value the caller rejects", async () => {
    const read = createTtlCache<string, { complete: boolean }>(1000, { keep: value => value.complete });
    await expect(read("key", async () => { throw new Error("down"); })).rejects.toThrow("down");
    let loads = 0;
    const partial = async () => { loads += 1; return { complete: false }; };
    await read("key", partial);
    await new Promise(resolve => setImmediate(resolve));
    await read("key", partial);
    expect(loads).toBe(2);
  });
});
