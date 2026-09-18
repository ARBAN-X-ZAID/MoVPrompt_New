import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  useSession: vi.fn(),
  signIn: { email: vi.fn(), social: vi.fn() },
  signUp: { email: vi.fn() },
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("./portableAuthClient", () => ({ portableAuthClient: client }));

import { portableAuthActions } from "./portableAuthActions";

describe("portable auth actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses Better Auth email sign-in and sign-up contracts", async () => {
    await portableAuthActions.signInEmail({
      email: "creator@example.com",
      password: "secure-password",
      callbackURL: "http://localhost/create",
    });
    await portableAuthActions.signUpEmail({
      email: "creator@example.com",
      password: "secure-password",
      name: "Creator",
      callbackURL: "http://localhost/create",
    });
    expect(client.signIn.email).toHaveBeenCalledOnce();
    expect(client.signUp.email).toHaveBeenCalledOnce();
  });

  it("uses Better Auth sign-out and password reset contracts", async () => {
    await portableAuthActions.requestPasswordReset({
      email: "creator@example.com",
      redirectTo: "http://localhost/reset-password",
    });
    await portableAuthActions.resetPassword({ newPassword: "new-secure-password", token: "reset-token" });
    await portableAuthActions.signOut();
    expect(client.requestPasswordReset).toHaveBeenCalledOnce();
    expect(client.resetPassword).toHaveBeenCalledOnce();
    expect(client.signOut).toHaveBeenCalledOnce();
  });
});
