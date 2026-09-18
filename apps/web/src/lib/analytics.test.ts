import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/config/features", () => ({ isFeatureEnabled: (name: string) => name === "portableAuth" }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from, auth: { getUser: mocks.getUser } },
}));

import { trackGeneration, trackPageVisit } from "./analytics";

describe("analytics in portable mode", () => {
  it("does not write to the removed legacy database", async () => {
    await trackPageVisit("/learn");
    await trackGeneration("template", "server-owned");

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
});
