import { describe, expect, it, vi } from "vitest";

import {
  RemoteNetworkPolicyError,
  createPublicRemoteRequestPolicy,
} from "./network-media-policy.js";

describe("public remote request policy", () => {
  it("rejects a mixed DNS answer before transport can connect", async () => {
    const transport = vi.fn();
    const policy = createPublicRemoteRequestPolicy({
      fetch: transport,
      resolveHost: vi.fn(async () => ["8.8.8.8", "127.0.0.1"]),
    });

    await expect(policy.fetch(new URL("https://public.example.test/source"), { headers: {}, consume: async () => undefined }))
      .rejects.toMatchObject<Partial<RemoteNetworkPolicyError>>({ kind: "blocked" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("pins the validated addresses and revalidates every redirect hop", async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/next" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const resolveHost = vi.fn(async (hostname: string) =>
      hostname === "public.example.test" ? ["8.8.8.8"] : ["1.1.1.1"],
    );
    const policy = createPublicRemoteRequestPolicy({ fetch: transport, resolveHost });

    const result = await policy.fetch(new URL("https://public.example.test/source"), {
      headers: {},
      consume: async ({ url }) => ({ url }),
    });

    expect(result.url.toString()).toBe("https://public.example.test/next");
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[0]?.[2]).toEqual(["8.8.8.8"]);
    expect(transport.mock.calls[1]?.[2]).toEqual(["8.8.8.8"]);
    expect(resolveHost).toHaveBeenCalledTimes(2);
  });
});
