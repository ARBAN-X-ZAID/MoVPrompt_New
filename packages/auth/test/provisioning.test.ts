import { describe, expect, it, vi } from "vitest";

import {
  createAuthProvisioningHooks,
  type AuthUserProvisioner,
} from "../src/provisioning";

describe("authentication benefit provisioning hooks", () => {
  it("provisions new and updated users and repairs benefits when a session is created", async () => {
    const provisioner: AuthUserProvisioner = {
      ensure: vi.fn(async () => undefined),
      ensureById: vi.fn(async () => undefined),
    };
    const hooks = createAuthProvisioningHooks(provisioner);

    await hooks.user.create.after({ id: "new-user", emailVerified: false });
    await hooks.user.update.after({ id: "verified-user", emailVerified: true });
    await hooks.session.create.after({ userId: "returning-user" });

    expect(provisioner.ensure).toHaveBeenNthCalledWith(1, {
      id: "new-user",
      emailVerified: false,
    });
    expect(provisioner.ensure).toHaveBeenNthCalledWith(2, {
      id: "verified-user",
      emailVerified: true,
    });
    expect(provisioner.ensureById).toHaveBeenCalledExactlyOnceWith("returning-user");
  });
});
