import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
}));

vi.mock("@/config/features", () => ({
  isFeatureEnabled: (feature: string) => feature === "portableAuth",
}));

vi.mock("@/lib/auth/portableAuthClient", () => ({
  portableAuthClient: {
    useSession: mocks.useSession,
  },
}));

vi.mock("@/lib/auth/portableAuthActions", () => ({
  portableAuthActions: { signOut: vi.fn() },
}));

import { useAuth } from "./useAuth";

describe("portable useAuth", () => {
  beforeEach(() => {
    mocks.useSession.mockReset();
  });

  it("keeps the projected user identity stable while the session user is unchanged", () => {
    const sessionUser = {
      id: "user-one",
      email: "creator@example.test",
      name: "Creator",
      image: null,
      createdAt: new Date("2026-09-14T10:00:00.000Z"),
    };
    const sessionState = {
      data: { user: sessionUser, session: { id: "session-one" } },
      isPending: false,
      error: null,
      refetch: vi.fn(),
    };
    mocks.useSession.mockReturnValue(sessionState);

    const { result, rerender } = renderHook(() => useAuth());
    const firstUser = result.current.user;

    rerender();

    expect(result.current.user).toBe(firstUser);
    expect(result.current.session?.user).toBe(firstUser);
  });
});
