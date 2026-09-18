import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { AuthGateway } from "./auth-gateway.js";
import { createApi } from "./app.js";
import type { AssetRepository, OwnedAssetRecord } from "./asset-repository.js";
import type { AssetStorageGateway } from "./asset-storage.js";
import { FootageVerificationError, type FootageVerifier } from "./footage-verifier.js";
import { loadApiConfig } from "./config.js";
import type { GuestClaimService } from "./guest-claim-service.js";
import type { RemoteImageFetcher } from "./remote-image-fetcher.js";
import type { RequestRateLimiter } from "./request-rate-limiter.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";
const ASSET_ID = "44444444-4444-4444-8444-444444444444";
const CHECKSUM = "a".repeat(64);
const VALID_PNG = new Uint8Array(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAEElEQVR4nGP8wwACLGCSAQANBAECv1AVswAAAABJRU5ErkJggg==",
  "base64",
));
const PNG_SIGNATURE_AND_IHDR_ONLY = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01,
  0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
]);

const config = loadApiConfig({
  APP_ENV: "test",
  API_PORT: "3001",
  FEATURE_AUTHENTICATION: "true",
  FEATURE_ASSETS: "true",
});

function authGateway(userId: string | null = USER_ID): AuthGateway {
  return {
    handle: vi.fn(async () => new Response("auth-ok")),
    getSession: vi.fn(async () =>
      userId
        ? {
            user: {
              id: userId,
              email: "owner@example.test",
              emailVerified: true,
              name: "Owner",
              role: "user" as const,
            },
            session: { id: "session-1" },
          }
        : null,
    ),
  };
}

function ownedAsset(userId = USER_ID): OwnedAssetRecord {
  return {
    id: ASSET_ID,
    projectId: PROJECT_ID,
    userId,
    kind: "product",
    bucket: "creator-assets",
    objectKey: `users/${userId}/projects/${PROJECT_ID}/assets/product/${ASSET_ID}/${CHECKSUM}`,
    mimeType: "image/jpeg",
    sizeBytes: 1_024,
    checksumSha256: CHECKSUM,
    originalFilename: "perfume.jpg",
  };
}

function repository(options: {
  projectOwned?: boolean;
  asset?: OwnedAssetRecord | null;
} = {}): AssetRepository {
  return {
    isProjectOwned: vi.fn(async () => options.projectOwned ?? true),
    createOrFind: vi.fn(async (record) => record),
    findOwned: vi.fn(async () => (options.asset === undefined ? ownedAsset() : options.asset)),
    updateVerifiedFootage: vi.fn(async ({ durationMs }) => {
      const asset = options.asset === undefined ? ownedAsset() : options.asset;
      return asset ? { ...asset, durationMs } : null;
    }),
    updateVerifiedImage: vi.fn(async ({ width, height }) => {
      const asset = options.asset === undefined ? ownedAsset() : options.asset;
      return asset ? { ...asset, width, height } : null;
    }),
  };
}

function storage(): AssetStorageGateway {
  return {
    assetsBucket: "creator-assets",
    outputsBucket: "creator-outputs",
    signUpload: vi.fn(async (input) => ({
      method: "PUT" as const,
      url: "https://storage.example.test/upload?signature=private",
      bucket: input.bucket,
      key: input.key,
      expiresInSeconds: 900,
      headers: {},
      metadata: {
        ...input.metadata,
        mimeType: input.metadata.mimeType.toLowerCase(),
        checksumSha256: input.metadata.checksumSha256.toLowerCase(),
      },
    })),
    signDownload: vi.fn(async (input) => ({
      method: "GET" as const,
      url: "https://storage.example.test/download?signature=private",
      bucket: input.bucket,
      key: input.key,
      expiresInSeconds: 900,
    })),
    put: vi.fn(async (input) => ({ bucket: input.bucket, key: input.key })),
    get: vi.fn(async () => ({
      body: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
      contentType: "image/jpeg",
      checksumSha256: CHECKSUM,
    })),
    head: vi.fn(async () => ({
      contentLength: 1_024,
      contentType: "image/jpeg",
      checksumSha256: CHECKSUM,
    })),
  };
}

function rateLimiter(allowed = true): RequestRateLimiter {
  return {
    consume: vi.fn(),
    consumePublicScan: vi.fn(),
    consumeAuthenticatedMirror: vi.fn(async () => ({ allowed, retryAfterSeconds: 120 })),
  };
}

function guestClaimService(): GuestClaimService {
  return {
    claimGuestDraft: vi.fn(),
    startClaim: vi.fn(),
    resumeClaim: vi.fn(),
    markAssetVerified: vi.fn(async () => ({
      id: "claim-1",
      projectId: PROJECT_ID,
      draftId: "55555555-5555-4555-8555-555555555555",
      pendingGenerationId: "66666666-6666-4666-8666-666666666666",
      snapshotDigest: CHECKSUM,
      status: "securing",
      nextAsset: null,
    })),
    markAssetFailed: vi.fn(),
    finalizeClaim: vi.fn(),
  };
}

describe("private asset API", () => {
  it("derives a stable key from the authenticated owner and server asset ID", async () => {
    const repo = repository();
    const objectStorage = storage();
    const app = createApi({
      config,
      authGateway: authGateway(),
      assetRepository: repo,
      assetStorage: objectStorage,
    });
    const response = await app.request(`/api/v1/projects/${PROJECT_ID}/assets/upload-url`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "request-assets-1",
        "idempotency-key": "asset-upload-request-1",
      },
      body: JSON.stringify({
        kind: "product",
        metadata: {
          mimeType: "image/jpeg",
          sizeBytes: 1_024,
          checksumSha256: CHECKSUM,
          originalFilename: "my private perfume.jpg",
          width: 1_080,
          height: 1_920,
        },
      }),
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      asset: { id: string; objectKey: string };
      requestId: string;
    };
    expect(body.requestId).toBe("request-assets-1");
    expect(body.asset.objectKey).toMatch(
      new RegExp(
        `^users/${USER_ID}/projects/${PROJECT_ID}/assets/product/${body.asset.id}/${CHECKSUM}$`,
      ),
    );
    expect(body.asset.objectKey).not.toContain("perfume.jpg");
    expect(repo.createOrFind).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        projectId: PROJECT_ID,
        objectKey: body.asset.objectKey,
      }),
    );
  });

  it("returns the same asset identity for repeated idempotent requests", async () => {
    let persisted: OwnedAssetRecord | undefined;
    const repo: AssetRepository = {
      isProjectOwned: vi.fn(async () => true),
      createOrFind: vi.fn(async (record) => {
        persisted ??= record;
        return persisted;
      }),
      findOwned: vi.fn(async () => persisted ?? null),
    };
    const app = createApi({
      config,
      authGateway: authGateway(),
      assetRepository: repo,
      assetStorage: storage(),
    });
    const request = () =>
      app.request(`/api/v1/projects/${PROJECT_ID}/assets/upload-url`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "asset-upload-repeated",
        },
        body: JSON.stringify({
          kind: "reference",
          metadata: {
            mimeType: "image/png",
            sizeBytes: 2_048,
            checksumSha256: "b".repeat(64),
          },
        }),
      });

    const first = await request();
    const second = await request();
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstBody = (await first.json()) as { asset: { id: string; objectKey: string } };
    const secondBody = (await second.json()) as { asset: { id: string; objectKey: string } };
    expect(secondBody.asset).toEqual(firstBody.asset);
  });

  it("accepts an authenticated image body only after size, type and checksum verification", async () => {
    const bytes = VALID_PNG;
    const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
    const asset = {
      ...ownedAsset(),
      mimeType: "image/png",
      sizeBytes: bytes.byteLength,
      checksumSha256,
      objectKey: `users/${USER_ID}/projects/${PROJECT_ID}/assets/product/${ASSET_ID}/${checksumSha256}`,
    };
    const objectStorage = storage();
    objectStorage.head = vi.fn(async () => ({
      contentLength: bytes.byteLength,
      contentType: "image/png",
      checksumSha256,
    }));
    const repo = repository({ asset });
    const app = createApi({
      config,
      authGateway: authGateway(),
      assetRepository: repo,
      assetStorage: objectStorage,
    });

    const response = await app.request(
      `/api/v1/projects/${PROJECT_ID}/assets/${ASSET_ID}/content`,
      {
        method: "PUT",
        headers: { "content-type": "image/png" },
        body: bytes,
      },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      asset: { id: ASSET_ID, checksumSha256 },
      download: { method: "GET" },
    });
    expect(objectStorage.put).toHaveBeenCalledWith(expect.objectContaining({
      body: bytes,
      contentType: "image/png",
      metadata: { "sha256-hex": checksumSha256 },
    }));
    expect(repo.updateVerifiedImage).toHaveBeenCalledWith(expect.objectContaining({ width: 2, height: 2 }));
  });

  it("accepts owner-scoped MP4 footage only after the shared server verifier derives its duration", async () => {
    const bytes = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
    const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
    const asset: OwnedAssetRecord = {
      ...ownedAsset(),
      kind: "footage",
      objectKey: `users/${USER_ID}/projects/${PROJECT_ID}/assets/footage/${ASSET_ID}/${checksumSha256}`,
      mimeType: "video/mp4",
      sizeBytes: bytes.byteLength,
      checksumSha256,
      durationMs: 10_000,
    };
    const objectStorage = storage();
    objectStorage.head = vi.fn(async () => ({
      contentLength: bytes.byteLength,
      contentType: "video/mp4",
      checksumSha256,
    }));
    const repo = repository({ asset });
    const app = createApi({
      config,
      authGateway: authGateway(),
      assetRepository: repo,
      assetStorage: objectStorage,
      footageVerifier: {
        verify: vi.fn(async () => ({ durationMs: 10_000 })),
      },
    });

    const response = await app.request(
      `/api/v1/projects/${PROJECT_ID}/assets/${ASSET_ID}/content`,
      { method: "PUT", headers: { "content-type": "video/mp4" }, body: bytes },
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      asset: { id: ASSET_ID, kind: "footage", durationMs: 10_000, checksumSha256 },
    });
    expect(objectStorage.put).toHaveBeenCalledWith(expect.objectContaining({ contentType: "video/mp4" }));
    expect(repo.updateVerifiedFootage).toHaveBeenCalledWith(expect.objectContaining({ durationMs: 10_000 }));
  });

  it("maps the browser UUID to a native MongoDB asset ID before advancing the matching checkpoint", async () => {
    const bytes = VALID_PNG;
    const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
    const asset = {
      ...ownedAsset(),
      id: createHash("sha256").update(ASSET_ID).digest("hex").slice(0, 24),
      mimeType: "image/png",
      sizeBytes: bytes.byteLength,
      checksumSha256,
      objectKey: `users/${USER_ID}/projects/${PROJECT_ID}/assets/product/${ASSET_ID}/${checksumSha256}`,
    };
    const claims = guestClaimService();
    const objectStorage = storage();
    objectStorage.head = vi.fn(async () => ({
      contentLength: bytes.byteLength,
      contentType: "image/png",
      checksumSha256,
    }));
    objectStorage.get = vi.fn(async () => ({ body: bytes, contentType: "image/png", checksumSha256 }));
    const app = createApi({
      config,
      authGateway: authGateway(),
      assetRepository: repository({ asset }),
      assetStorage: objectStorage,
      guestClaimService: claims,
    });

    const response = await app.request(
      `/api/v1/projects/${PROJECT_ID}/assets/${asset.id}/complete`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pendingGenerationId: "66666666-6666-4666-8666-666666666666",
          localAssetId: ASSET_ID,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(claims.markAssetVerified).toHaveBeenCalledWith({
      userId: USER_ID,
      pendingGenerationId: "66666666-6666-4666-8666-666666666666",
      localAssetId: ASSET_ID,
      bucket: "creator-assets",
      objectKey: asset.objectKey,
    });
  });

  it("rejects arbitrary bytes labelled image/png on direct-upload completion", async () => {
    const bytes = new TextEncoder().encode("not an image");
    const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
    const asset: OwnedAssetRecord = {
      ...ownedAsset(),
      mimeType: "image/png",
      sizeBytes: bytes.byteLength,
      checksumSha256,
      objectKey: `users/${USER_ID}/projects/${PROJECT_ID}/assets/product/${ASSET_ID}/${checksumSha256}`,
    };
    const claims = guestClaimService();
    const objectStorage = storage();
    objectStorage.head = vi.fn(async () => ({ contentLength: bytes.byteLength, contentType: "image/png", checksumSha256 }));
    objectStorage.get = vi.fn(async () => ({ body: bytes, contentType: "image/png", checksumSha256 }));
    const app = createApi({
      config,
      authGateway: authGateway(),
      assetRepository: repository({ asset }),
      assetStorage: objectStorage,
      guestClaimService: claims,
    });

    const response = await app.request(`/api/v1/projects/${PROJECT_ID}/assets/${ASSET_ID}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pendingGenerationId: "66666666-6666-4666-8666-666666666666",
        localAssetId: ASSET_ID,
      }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "invalid_asset_content" } });
    expect(claims.markAssetVerified).not.toHaveBeenCalled();
  });

  it("rejects a signature-and-IHDR-only image before a signed direct upload can advance a guest claim", async () => {
    const bytes = PNG_SIGNATURE_AND_IHDR_ONLY;
    const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
    const asset: OwnedAssetRecord = {
      ...ownedAsset(),
      mimeType: "image/png",
      sizeBytes: bytes.byteLength,
      checksumSha256,
      objectKey: `users/${USER_ID}/projects/${PROJECT_ID}/assets/product/${ASSET_ID}/${checksumSha256}`,
    };
    const claims = guestClaimService();
    const objectStorage = storage();
    objectStorage.head = vi.fn(async () => ({ contentLength: bytes.byteLength, contentType: "image/png", checksumSha256 }));
    objectStorage.get = vi.fn(async () => ({ body: bytes, contentType: "image/png", checksumSha256 }));
    const app = createApi({
      config,
      authGateway: authGateway(),
      assetRepository: repository({ asset }),
      assetStorage: objectStorage,
      guestClaimService: claims,
    });

    const response = await app.request(`/api/v1/projects/${PROJECT_ID}/assets/${ASSET_ID}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pendingGenerationId: "66666666-6666-4666-8666-666666666666",
        localAssetId: ASSET_ID,
      }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "invalid_asset_content" } });
    expect(claims.markAssetVerified).not.toHaveBeenCalled();
  });

  it("rejects direct-upload footage that only mimics an MP4 header before a guest claim can advance", async () => {
    const bytes = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
    const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
    const asset: OwnedAssetRecord = {
      ...ownedAsset(),
      kind: "footage",
      objectKey: `users/${USER_ID}/projects/${PROJECT_ID}/assets/footage/${ASSET_ID}/${checksumSha256}`,
      mimeType: "video/mp4",
      sizeBytes: bytes.byteLength,
      checksumSha256,
      durationMs: 1_000,
    };
    const repo = repository({ asset });
    const claims = guestClaimService();
    const objectStorage = storage();
    objectStorage.head = vi.fn(async () => ({ contentLength: bytes.byteLength, contentType: "video/mp4", checksumSha256 }));
    objectStorage.get = vi.fn(async () => ({ body: bytes, contentType: "video/mp4", checksumSha256 }));
    const verifier: FootageVerifier = {
      verify: vi.fn(async () => { throw new FootageVerificationError("invalid", "The uploaded file is not a decodable MP4 or MOV video."); }),
    };
    const app = createApi({ config, authGateway: authGateway(), assetRepository: repo, assetStorage: objectStorage, guestClaimService: claims, footageVerifier: verifier });

    const response = await app.request(`/api/v1/projects/${PROJECT_ID}/assets/${ASSET_ID}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pendingGenerationId: "66666666-6666-4666-8666-666666666666", localAssetId: ASSET_ID }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "invalid_asset_content" } });
    expect(claims.markAssetVerified).not.toHaveBeenCalled();
  });

  it("persists a verifier-derived duration instead of the caller declared duration before direct footage claim completion", async () => {
    const bytes = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
    const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
    const asset: OwnedAssetRecord = {
      ...ownedAsset(), kind: "footage", mimeType: "video/mp4", sizeBytes: bytes.byteLength, checksumSha256,
      objectKey: `users/${USER_ID}/projects/${PROJECT_ID}/assets/footage/${ASSET_ID}/${checksumSha256}`,
      durationMs: 1_000,
    };
    const repo = repository({ asset });
    const claims = guestClaimService();
    const objectStorage = storage();
    objectStorage.head = vi.fn(async () => ({ contentLength: bytes.byteLength, contentType: "video/mp4", checksumSha256 }));
    objectStorage.get = vi.fn(async () => ({ body: bytes, contentType: "video/mp4", checksumSha256 }));
    const app = createApi({
      config, authGateway: authGateway(), assetRepository: repo, assetStorage: objectStorage, guestClaimService: claims,
      footageVerifier: { verify: vi.fn(async () => ({ durationMs: 12_345 })) },
    });
    const response = await app.request(`/api/v1/projects/${PROJECT_ID}/assets/${ASSET_ID}/complete`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ pendingGenerationId: "66666666-6666-4666-8666-666666666666", localAssetId: ASSET_ID }),
    });
    expect(response.status).toBe(200);
    expect(repo.updateVerifiedFootage).toHaveBeenCalledWith(expect.objectContaining({ durationMs: 12_345 }));
    expect(claims.markAssetVerified).toHaveBeenCalledWith(expect.objectContaining({ durationMs: 12_345 }));
  });

  it("rejects image bytes that do not match the declared checksum", async () => {
    const bytes = new Uint8Array(1_024);
    bytes.set([0xff, 0xd8, 0xff, 0xe0]);
    const objectStorage = storage();
    const app = createApi({
      config,
      authGateway: authGateway(),
      assetRepository: repository(),
      assetStorage: objectStorage,
    });

    const response = await app.request(
      `/api/v1/projects/${PROJECT_ID}/assets/${ASSET_ID}/content`,
      {
        method: "PUT",
        headers: { "content-type": "image/jpeg" },
        body: bytes,
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "asset_integrity_mismatch", retryable: false },
    });
    expect(objectStorage.put).not.toHaveBeenCalled();
  });

  it("does not reveal a project owned by another account", async () => {
    const objectStorage = storage();
    const app = createApi({
      config,
      authGateway: authGateway(OTHER_USER_ID),
      assetRepository: repository({ projectOwned: false }),
      assetStorage: objectStorage,
    });
    const response = await app.request(`/api/v1/projects/${PROJECT_ID}/assets/upload-url`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "asset-upload-request-2",
      },
      body: JSON.stringify({
        kind: "product",
        metadata: {
          mimeType: "image/jpeg",
          sizeBytes: 1_024,
          checksumSha256: CHECKSUM,
        },
      }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "project_not_found", retryable: false },
    });
    expect(objectStorage.signUpload).not.toHaveBeenCalled();
  });

  it("mirrors a verified remote image into owner-scoped private storage", async () => {
    const bytes = VALID_PNG;
    const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
    const remoteImageFetcher: RemoteImageFetcher = {
      fetch: vi.fn(async () => ({
        canonicalUrl: "https://cdn.example.test/products/perfume.jpg",
        bytes,
        mimeType: "image/png" as const,
        checksumSha256,
        originalFilename: "perfume.jpg",
      })),
    };
    const objectStorage = storage();
    objectStorage.head = vi.fn(async () => ({
      contentLength: bytes.byteLength,
      contentType: "image/png",
      checksumSha256,
    }));
    const repo = repository();
    const app = createApi({
      config,
      authGateway: authGateway(),
      assetRepository: repo,
      assetStorage: objectStorage,
      remoteImageFetcher,
      requestRateLimiter: rateLimiter(),
    });

    const response = await app.request(`/api/v1/projects/${PROJECT_ID}/assets/mirror`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "asset-mirror-perfume-1",
        "x-request-id": "request-assets-mirror-1",
      },
      body: JSON.stringify({
        kind: "product",
        url: "https://cdn.example.test/products/perfume.jpg#preview",
        originalFilename: "perfume.jpg",
      }),
    });

    expect(response.status).toBe(201);
    const responseText = await response.text();
    expect(responseText).not.toContain("cdn.example.test");
    expect(JSON.parse(responseText)).toMatchObject({
      asset: {
        projectId: PROJECT_ID,
        kind: "product",
        mimeType: "image/png",
        sizeBytes: bytes.byteLength,
        checksumSha256,
      },
      download: { method: "GET", expiresInSeconds: 900 },
      requestId: "request-assets-mirror-1",
    });
    expect(remoteImageFetcher.fetch).toHaveBeenCalledWith(
      "https://cdn.example.test/products/perfume.jpg",
    );
    expect(repo.createOrFind).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        projectId: PROJECT_ID,
        sourceUrlHash: createHash("sha256")
          .update("https://cdn.example.test/products/perfume.jpg")
          .digest("hex"),
      }),
    );
    expect(objectStorage.put).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "creator-assets",
        body: bytes,
        contentType: "image/png",
        metadata: { "sha256-hex": checksumSha256 },
      }),
    );
  });

  it("rejects a truncated mirrored image before it is persisted", async () => {
    const bytes = PNG_SIGNATURE_AND_IHDR_ONLY;
    const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
    const remoteImageFetcher: RemoteImageFetcher = {
      fetch: vi.fn(async () => ({
        canonicalUrl: "https://cdn.example.test/products/truncated.png",
        bytes,
        mimeType: "image/png" as const,
        checksumSha256,
        originalFilename: "truncated.png",
      })),
    };
    const objectStorage = storage();
    const app = createApi({
      config,
      authGateway: authGateway(),
      assetRepository: repository(),
      assetStorage: objectStorage,
      remoteImageFetcher,
      requestRateLimiter: rateLimiter(),
    });

    const response = await app.request(`/api/v1/projects/${PROJECT_ID}/assets/mirror`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "asset-mirror-truncated" },
      body: JSON.stringify({ kind: "product", url: "https://cdn.example.test/products/truncated.png" }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "invalid_asset_content" } });
    expect(objectStorage.put).not.toHaveBeenCalled();
  });

  it("does not fetch or store a remote image for a project owned by another account", async () => {
    const remoteImageFetcher: RemoteImageFetcher = {
      fetch: vi.fn(),
    };
    const objectStorage = storage();
    const app = createApi({
      config,
      authGateway: authGateway(OTHER_USER_ID),
      assetRepository: repository({ projectOwned: false }),
      assetStorage: objectStorage,
      remoteImageFetcher,
      requestRateLimiter: rateLimiter(),
    });
    const response = await app.request(`/api/v1/projects/${PROJECT_ID}/assets/mirror`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "asset-mirror-cross-owner",
      },
      body: JSON.stringify({
        kind: "product",
        url: "https://cdn.example.test/products/private.jpg",
      }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "project_not_found", retryable: false },
    });
    expect(remoteImageFetcher.fetch).not.toHaveBeenCalled();
    expect(objectStorage.put).not.toHaveBeenCalled();
  });

  it("rejects a rate-limited mirror before it fetches or stores remote media", async () => {
    const remoteImageFetcher: RemoteImageFetcher = { fetch: vi.fn() };
    const objectStorage = storage();
    const app = createApi({
      config,
      authGateway: authGateway(),
      assetRepository: repository(),
      assetStorage: objectStorage,
      remoteImageFetcher,
      requestRateLimiter: rateLimiter(false),
    });

    const response = await app.request(`/api/v1/projects/${PROJECT_ID}/assets/mirror`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "asset-mirror-limited", "x-request-id": "request-mirror-limited" },
      body: JSON.stringify({ kind: "product", url: "https://cdn.example.test/product.jpg" }),
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("120");
    await expect(response.json()).resolves.toMatchObject({ error: { code: "remote_image_rate_limited", requestId: "request-mirror-limited" } });
    expect(remoteImageFetcher.fetch).not.toHaveBeenCalled();
    expect(objectStorage.put).not.toHaveBeenCalled();
  });

  it("rejects reuse of a mirror idempotency key for a different remote URL", async () => {
    const bytes = VALID_PNG;
    const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
    let persisted: OwnedAssetRecord | undefined;
    const repo: AssetRepository = {
      isProjectOwned: vi.fn(async () => true),
      createOrFind: vi.fn(async (record) => {
        persisted ??= record;
        return persisted;
      }),
      findOwned: vi.fn(async () => persisted ?? null),
    };
    const remoteImageFetcher: RemoteImageFetcher = {
      fetch: vi.fn(async (url) => ({
        canonicalUrl: url,
        bytes,
        mimeType: "image/png" as const,
        checksumSha256,
        originalFilename: "product.jpg",
      })),
    };
    const objectStorage = storage();
    objectStorage.head = vi.fn(async () => ({
      contentLength: bytes.byteLength,
      contentType: "image/png",
      checksumSha256,
    }));
    const app = createApi({
      config,
      authGateway: authGateway(),
      assetRepository: repo,
      assetStorage: objectStorage,
      remoteImageFetcher,
      requestRateLimiter: rateLimiter(),
    });
    const request = (url: string) => app.request(
      `/api/v1/projects/${PROJECT_ID}/assets/mirror`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "asset-mirror-immutable-source",
        },
        body: JSON.stringify({ kind: "product", url }),
      },
    );

    expect((await request("https://cdn.example.test/product-a.jpg")).status).toBe(201);
    const conflict = await request("https://cdn.example.test/product-b.jpg");
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({
      error: { code: "idempotency_conflict", retryable: false },
    });
    expect(objectStorage.put).toHaveBeenCalledTimes(1);
  });

  it("requires an authenticated Better Auth session", async () => {
    const app = createApi({
      config,
      authGateway: authGateway(null),
      assetRepository: repository(),
      assetStorage: storage(),
    });
    const response = await app.request(`/api/v1/projects/${PROJECT_ID}/assets/upload-url`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": "asset-upload-request-3",
      },
      body: JSON.stringify({
        kind: "product",
        metadata: {
          mimeType: "image/jpeg",
          sizeBytes: 1_024,
          checksumSha256: CHECKSUM,
        },
      }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "authentication_required", retryable: false },
    });
  });

  it("verifies object integrity before signing a download", async () => {
    const objectStorage = storage();
    const app = createApi({
      config,
      authGateway: authGateway(),
      assetRepository: repository(),
      assetStorage: objectStorage,
    });
    const response = await app.request(
      `/api/v1/projects/${PROJECT_ID}/assets/${ASSET_ID}/download-url`,
      { headers: { "x-request-id": "request-assets-2" } },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      asset: { id: ASSET_ID, projectId: PROJECT_ID },
      download: { method: "GET", expiresInSeconds: 900 },
      requestId: "request-assets-2",
    });
    const headCallOrder = (objectStorage.head as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0];
    const signCallOrder = (objectStorage.signDownload as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0];
    expect(headCallOrder).toBeLessThan(signCallOrder!);
  });

  it("rejects a mismatched object without issuing a download URL", async () => {
    const objectStorage = storage();
    objectStorage.head = vi.fn(async () => ({
      contentLength: 999,
      contentType: "image/jpeg",
      checksumSha256: CHECKSUM,
    }));
    const app = createApi({
      config,
      authGateway: authGateway(),
      assetRepository: repository(),
      assetStorage: objectStorage,
    });
    const response = await app.request(
      `/api/v1/projects/${PROJECT_ID}/assets/${ASSET_ID}/download-url`,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "asset_integrity_mismatch", retryable: false },
    });
    expect(objectStorage.signDownload).not.toHaveBeenCalled();
  });
});
