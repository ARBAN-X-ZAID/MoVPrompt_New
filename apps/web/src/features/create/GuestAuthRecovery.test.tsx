import { afterEach, describe, expect, it } from "vitest";

import { resolveAuthReturnPath, safeAuthReturnPath, rememberAuthReturnIntent } from "@/lib/auth/returnPath";
import type { CreationDraft } from "./contracts";
import { getGuestClaimRecoveryCopy, selectGuestClaimRecovery } from "./guestClaimRecovery";

const draft = { id: "draft-1", pendingGenerationId: "intent-1" } as CreationDraft;

describe("guest authentication recovery seam", () => {
  afterEach(() => sessionStorage.clear());

  it("prefers the stable pending intent and rejects unsafe callback destinations", () => {
    rememberAuthReturnIntent("/create?draft=draft-1&resume=generate", "intent-1");

    expect(resolveAuthReturnPath("/projects/other-user")).toBe("/create?draft=draft-1&resume=generate");
    expect(safeAuthReturnPath("https://unsafe.example/claim")).toBe("/create");
    expect(safeAuthReturnPath("//unsafe.example/claim")).toBe("/create");
    expect(safeAuthReturnPath("/auth/callback")).toBe("/create");
  });

  it("keeps local draft facts attached to cancellation, offline, source failure, mismatch, and retry states", () => {
    const cases = [
      ["claim_failed", "claim_failed"],
      ["import_failed", "import_failed"],
      ["network_offline", "offline"],
      ["session_mismatch", "session_mismatch"],
    ] as const;

    for (const [code, state] of cases) {
      const recovery = selectGuestClaimRecovery(draft, code);
      expect(recovery.state).toBe(state);
      expect(recovery.draft).toBe(draft);
    }

    expect(getGuestClaimRecoveryCopy("en", "offline").message).toBe(
      "You’re offline. Your campaign is still saved in this browser. Reconnect, then try again.",
    );
    expect(getGuestClaimRecoveryCopy("ar", "session_mismatch").message).toBe(
      "هذه الحملة تخص حساباً مسجلاً آخر. أبقيناها خاصة ولم نغيّرها.",
    );
  });
});
