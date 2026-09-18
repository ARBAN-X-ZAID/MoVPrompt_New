import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  createClient.mockReset();
});

describe("legacy Supabase boundary", () => {
  it("allows portable pages to import without legacy credentials", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    const { supabase } = await import("./client");
    expect(createClient).not.toHaveBeenCalled();
    expect(() => supabase.auth).toThrow("Legacy Supabase is not configured");
  });

  it("initializes legacy auth once on use and preserves the client method receiver", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://legacy.example.test");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-public-key");
    const client = { auth: {}, from() { return this; } };
    createClient.mockReturnValue(client);
    const { supabase } = await import("./client");
    expect(createClient).not.toHaveBeenCalled();
    expect(supabase.auth).toBe(client.auth);
    expect(supabase.from("profiles")).toBe(client);
    expect(createClient).toHaveBeenCalledOnce();
  });
});
