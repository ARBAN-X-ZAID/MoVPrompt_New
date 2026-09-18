import { afterEach, describe, expect, it, vi } from "vitest";
import { createApi } from "./app.js";
import { loadApiConfig } from "./config.js";
import type { AuthGateway } from "./auth-gateway.js";
import type { CreatorRepository } from "./creator-repository.js";
import type { AssetStorageGateway } from "./asset-storage.js";

const userId = "111111111111111111111111";
const projectId = "222222222222222222222222";
const runId = "333333333333333333333333";
const path = `/api/v1/projects/${projectId}/render-runs/${runId}/output/file`;

function fixture({ guest = false, owned = true, signedIn = true } = {}) {
  const authGateway = { getSession: vi.fn(async () => signedIn ? { user: { id: userId }, session: { guest } } : null) } as unknown as AuthGateway;
  const findOwnedOutput = vi.fn(async () => owned ? { bucket: "movprompt", objectKey: "private/video.mp4" } : null);
  const creatorRepository = { findOwnedOutput } as unknown as CreatorRepository;
  const signDownload = vi.fn(async () => ({ url: "https://storage.example.test/private.mp4?signature=test", expiresInSeconds: 900 }));
  const assetStorage = { outputsBucket: "movprompt", signDownload } as unknown as AssetStorageGateway;
  const app = createApi({ config: loadApiConfig({ APP_ENV: "test", FEATURE_AUTHENTICATION: "true", FEATURE_TEMPLATE_MODE: "true" }), authGateway, creatorRepository, assetStorage });
  return { app, findOwnedOutput, signDownload };
}

afterEach(() => vi.unstubAllGlobals());

describe("private output file delivery", () => {
  it("streams the owned R2 output as a private attachment without exposing the signed URL", async () => {
    const { app, findOwnedOutput } = fixture();
    const fetch = vi.fn(async () => new Response("test-mp4", { headers: { "content-type": "video/mp4" } }));
    vi.stubGlobal("fetch", fetch);
    const response = await app.request(path);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("test-mp4");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("location")).toBeNull();
    expect(findOwnedOutput).toHaveBeenCalledWith(userId, projectId, runId);
  });

  it.each([{ guest: true }, { signedIn: false }])("denies a clean download without account authentication (%j)", async options => {
    const { app, signDownload } = fixture(options);
    expect((await app.request(path)).status).toBe(401);
    expect(signDownload).not.toHaveBeenCalled();
  });

  it("does not read another owner's media", async () => {
    const { app, signDownload } = fixture({ owned: false });
    expect((await app.request(path)).status).toBe(404);
    expect(signDownload).not.toHaveBeenCalled();
  });

  it("reports an R2 retrieval error without returning a successful attachment", async () => {
    const { app } = fixture();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("missing", { status: 404 })));
    const response = await app.request(path);
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe("output_download_failed");
  });
});
