import { beforeEach, describe, expect, it } from "vitest";
import {
  consumeAuthReturnIntent,
  readAuthReturnIntent,
  rememberAuthReturnIntent,
  resolveAuthReturnPath,
  safeAuthReturnPath,
} from "./returnPath";

describe("portable auth return paths", () => {
  beforeEach(() => sessionStorage.clear());

  it("keeps same-origin paths with query and hash", () => {
    expect(safeAuthReturnPath("/create/draft-1?step=review#quote")).toBe(
      "/create/draft-1?step=review#quote",
    );
  });

  it("rejects every hostile or auth-loop return path", () => {
    expect(safeAuthReturnPath("https://evil.example/steal")).toBe("/create");
    expect(safeAuthReturnPath("//evil.example/steal")).toBe("/create");
    expect(safeAuthReturnPath("/\\evil.example/steal")).toBe("/create");
    expect(safeAuthReturnPath("/auth?next=/auth")).toBe("/create");
    expect(safeAuthReturnPath("/auth/callback")).toBe("/create");
    expect(safeAuthReturnPath("/api/auth/callback/google")).toBe("/create");
    expect(safeAuthReturnPath("/%2f%2fevil.example/steal")).toBe("/create");
    expect(safeAuthReturnPath("/%E0%A4%A")).toBe("/create");
  });

  it("prefers opaque pending intent over an explicit safe next", () => {
    rememberAuthReturnIntent("/create/draft-1?generate=1", "pending-generation-123");
    expect(readAuthReturnIntent()).toBe("/create/draft-1?generate=1");
    expect(resolveAuthReturnPath("/projects")).toBe("/create/draft-1?generate=1");
    expect(consumeAuthReturnIntent()).toBe("/create/draft-1?generate=1");
    expect(readAuthReturnIntent()).toBe("/create");
  });

  it("preserves a safe intent through reset or cancellation without external URLs", () => {
    rememberAuthReturnIntent("https://evil.example/reset", "pending-generation-123");
    expect(resolveAuthReturnPath("https://evil.example/cancel")).toBe("/create");
  });
});
