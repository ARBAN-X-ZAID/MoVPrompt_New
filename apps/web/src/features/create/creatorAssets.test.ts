import { afterEach, describe, expect, it, vi } from "vitest";

import { claimGuestAssets, claimGuestImage, mirrorProductImages } from "./creatorAssets";
import type { CreatorAsset } from "./types";

describe("creator remote product image mirroring", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uploads a local image through the authenticated API before returning its private preview", async () => {
    const assetId = "11111111-1111-4111-8111-111111111111";
    const projectId = "22222222-2222-4222-8222-222222222222";
    const checksum = "b".repeat(64);
    const privateAsset = {
      id: assetId,
      projectId,
      kind: "product",
      objectKey: `users/u/projects/${projectId}/assets/product/${assetId}/${checksum}`,
      mimeType: "image/jpeg",
      sizeBytes: 4,
      checksumSha256: checksum,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        asset: privateAsset,
        upload: {
          method: "PUT",
          url: "https://storage.example.test/signed-upload",
          headers: { "content-type": "image/jpeg" },
          expiresInSeconds: 900,
        },
        requestId: "request-upload-url-1",
      }), { status: 201, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        asset: privateAsset,
        download: {
          method: "GET",
          url: "https://storage.example.test/private.jpg?signature=short-lived",
          expiresInSeconds: 900,
        },
        requestId: "request-upload-content-1",
      }), { status: 201, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" });

    const result = await claimGuestImage({
      userId: "user-1",
      projectId,
      assetId: "local-image-1",
      name: "product.jpg",
      blob,
      contentType: "image/jpeg",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]![0])).toMatch(
      new RegExp(`/api/v1/projects/${projectId}/assets/${assetId}/content$`),
    );
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "image/jpeg" },
      body: blob,
    });
    expect(result).toMatchObject({
      assetId,
      storagePath: privateAsset.objectKey,
      mimeType: "image/jpeg",
      url: "https://storage.example.test/private.jpg?signature=short-lived",
    });
  });

  it("retries one idempotent asset reservation when a newly claimed project is briefly unavailable", async () => {
    const assetId = "11111111-1111-4111-8111-111111111111";
    const projectId = "22222222-2222-4222-8222-222222222222";
    const checksum = "b".repeat(64);
    const privateAsset = {
      id: assetId,
      projectId,
      kind: "product",
      objectKey: `users/u/projects/${projectId}/assets/product/${assetId}/${checksum}`,
      mimeType: "image/jpeg",
      sizeBytes: 4,
      checksumSha256: checksum,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { code: "project_not_found", message: "The requested project was not found." },
      }), { status: 404, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        asset: privateAsset,
        upload: {
          method: "PUT",
          url: "https://storage.example.test/signed-upload",
          headers: { "content-type": "image/jpeg" },
          expiresInSeconds: 900,
        },
        requestId: "request-upload-url-retry",
      }), { status: 201, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        asset: privateAsset,
        download: {
          method: "GET",
          url: "https://storage.example.test/private.jpg?signature=short-lived",
          expiresInSeconds: 900,
        },
        requestId: "request-upload-content-retry",
      }), { status: 201, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await claimGuestImage({
      userId: "user-1",
      projectId,
      assetId: "local-image-1",
      name: "product.jpg",
      blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" }),
      contentType: "image/jpeg",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]![0]).toEqual(fetchMock.mock.calls[1]![0]);
    expect(fetchMock.mock.calls[0]![1]).toEqual(fetchMock.mock.calls[1]![1]);
  });

  it("resumes only the server-reported failed asset and keeps the supplied local blobs on failure", async () => {
    const projectId = "22222222-2222-4222-8222-222222222222";
    const pendingGenerationId = "33333333-3333-4333-8333-333333333333";
    const skippedAssetId = "44444444-4444-4444-8444-444444444444";
    const failedAssetId = "55555555-5555-4555-8555-555555555555";
    const failedBlob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" });
    const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await failedBlob.arrayBuffer())))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    const privateAsset = {
      id: failedAssetId,
      projectId,
      kind: "product",
      objectKey: `users/u/projects/${projectId}/assets/product/${failedAssetId}/${checksum}`,
      mimeType: "image/jpeg",
      sizeBytes: 4,
      checksumSha256: checksum,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        operation: {
          id: "66666666-6666-4666-8666-666666666666",
          projectId,
          draftId: "77777777-7777-4777-8777-777777777777",
          pendingGenerationId,
          snapshotDigest: "a".repeat(64),
          status: "failed",
          nextAsset: {
            id: "88888888-8888-4888-8888-888888888888",
            localAssetId: failedAssetId,
            ordinal: 1,
            status: "failed",
          },
        },
        requestId: "start-request",
      }), { status: 201, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        asset: privateAsset,
        upload: { method: "PUT", url: "https://storage.example.test/upload", headers: {}, expiresInSeconds: 900 },
        requestId: "reserve-request",
      }), { status: 201, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        asset: privateAsset,
        download: { method: "GET", url: "https://storage.example.test/short-lived", expiresInSeconds: 900 },
        requestId: "content-request",
      }), { status: 201, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { code: "asset_integrity_mismatch", message: "The uploaded asset could not be verified." },
      }), { status: 409, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const blobs = new Map([
      [skippedAssetId, new Blob(["already secure"], { type: "image/jpeg" })],
      [failedAssetId, failedBlob],
    ]);

    await expect(claimGuestAssets({
      snapshot: {
        draftId: "77777777-7777-4777-8777-777777777777",
        pendingGenerationId,
        snapshotDigest: "a".repeat(64),
        assetManifest: [
          { localAssetId: skippedAssetId, ordinal: 0, kind: "product", mimeType: "image/jpeg", sizeBytes: 14, checksumSha256: "c".repeat(64) },
          { localAssetId: failedAssetId, ordinal: 1, kind: "product", mimeType: "image/jpeg", sizeBytes: 4, checksumSha256: checksum },
        ],
        title: "Coffee campaign",
        mode: "template",
        configuration: {},
        productRecipe: {},
        campaignRecipe: {},
      },
      blobs,
    })).rejects.toMatchObject({ localAssetId: failedAssetId });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[1]![0])).toContain(`/assets/upload-url`);
    expect(JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body))).toMatchObject({ assetId: failedAssetId });
    expect(blobs.get(skippedAssetId)).toBeInstanceOf(Blob);
    expect(blobs.get(failedAssetId)).toBeInstanceOf(Blob);
  });

  it("reports factual private-claim stages in server checkpoint order and forwards one signal to every request", async () => {
    const projectId = "22222222-2222-4222-8222-222222222222";
    const pendingGenerationId = "33333333-3333-4333-8333-333333333333";
    const firstAssetId = "44444444-4444-4444-8444-444444444444";
    const secondAssetId = "55555555-5555-4555-8555-555555555555";
    const firstBlob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" });
    const secondBlob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe1])], { type: "image/jpeg" });
    const checksums = await Promise.all([firstBlob, secondBlob].map(async (blob) => Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())),
    ).map((value) => value.toString(16).padStart(2, "0")).join("")));
    const asset = (id: string, checksum: string) => ({
      id: id === firstAssetId ? "f1d11edf5c5cbe84bc60d6c5" : id,
      projectId,
      kind: "product",
      objectKey: `users/u/projects/${projectId}/assets/product/${id}/${checksum}`,
      mimeType: "image/jpeg",
      sizeBytes: 4,
      checksumSha256: checksum,
    });
    const operation = (nextAsset: { localAssetId: string; ordinal: number } | null) => ({
      operation: {
        id: "66666666-6666-4666-8666-666666666666",
        projectId,
        draftId: "77777777-7777-4777-8777-777777777777",
        pendingGenerationId,
        snapshotDigest: "a".repeat(64),
        status: "securing",
        nextAsset: nextAsset && {
          id: nextAsset.ordinal === 0 ? "88888888-8888-4888-8888-888888888888" : "99999999-9999-4999-8999-999999999999",
          localAssetId: nextAsset.localAssetId,
          ordinal: nextAsset.ordinal,
          status: "pending",
        },
      },
      requestId: "claim-operation-request",
    });
    const responseQueue = [
      operation({ localAssetId: firstAssetId, ordinal: 0 }),
      { asset: asset(firstAssetId, checksums[0]!), upload: { method: "PUT", url: "https://storage.example.test/upload-1", headers: {}, expiresInSeconds: 900 }, requestId: "reserve-1" },
      { asset: asset(firstAssetId, checksums[0]!), download: { method: "GET", url: "https://storage.example.test/download-1", expiresInSeconds: 900 }, requestId: "content-1" },
      { asset: asset(firstAssetId, checksums[0]!), status: "ready", requestId: "complete-1" },
      operation({ localAssetId: secondAssetId, ordinal: 1 }),
      { asset: asset(secondAssetId, checksums[1]!), upload: { method: "PUT", url: "https://storage.example.test/upload-2", headers: {}, expiresInSeconds: 900 }, requestId: "reserve-2" },
      { asset: asset(secondAssetId, checksums[1]!), download: { method: "GET", url: "https://storage.example.test/download-2", expiresInSeconds: 900 }, requestId: "content-2" },
      { asset: asset(secondAssetId, checksums[1]!), status: "ready", requestId: "complete-2" },
      operation(null),
    ];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _request?: RequestInit) => {
      const body = responseQueue.shift();
      return body
        ? new Response(JSON.stringify(body), { status: 201, headers: { "content-type": "application/json" } })
        : new Response(JSON.stringify({ error: { message: "finalize deliberately stops this stage-order test" } }), { status: 500, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const progress: string[] = [];

    await expect(claimGuestAssets({
      snapshot: {
        draftId: "77777777-7777-4777-8777-777777777777",
        pendingGenerationId,
        snapshotDigest: "a".repeat(64),
        assetManifest: [
          { localAssetId: firstAssetId, ordinal: 0, kind: "product", mimeType: "image/jpeg", sizeBytes: 4, checksumSha256: checksums[0]! },
          { localAssetId: secondAssetId, ordinal: 1, kind: "product", mimeType: "image/jpeg", sizeBytes: 4, checksumSha256: checksums[1]! },
        ],
        title: "Coffee campaign",
        mode: "template",
        configuration: {},
        productRecipe: {},
        campaignRecipe: {},
      },
      blobs: new Map([[firstAssetId, firstBlob], [secondAssetId, secondBlob]]),
      signal: controller.signal,
      onProgress: (stage) => progress.push(stage.stage === "asset" ? `${stage.stage}:${stage.current}/${stage.total}` : stage.stage),
    })).rejects.toThrow("finalize deliberately stops this stage-order test");

    expect(progress).toEqual(["creating", "asset:1/2", "asset:2/2", "verifying"]);
    expect(fetchMock).toHaveBeenCalledTimes(10);
    for (const [, request] of fetchMock.mock.calls) {
      expect(request).toMatchObject({ signal: controller.signal });
    }
  });

  it("stops an aborted claim before finalization and retains caller-owned blobs for an idempotent retry", async () => {
    const projectId = "22222222-2222-4222-8222-222222222222";
    const pendingGenerationId = "33333333-3333-4333-8333-333333333333";
    const assetId = "44444444-4444-4444-8444-444444444444";
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" });
    const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    const controller = new AbortController();
    const blobs = new Map([[assetId, blob]]);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, request?: RequestInit) => {
      if (fetchMock.mock.calls.length === 1) {
        return new Response(JSON.stringify({
          operation: {
            id: "66666666-6666-4666-8666-666666666666",
            projectId,
            draftId: "77777777-7777-4777-8777-777777777777",
            pendingGenerationId,
            snapshotDigest: "a".repeat(64),
            status: "securing",
            nextAsset: { id: "88888888-8888-4888-8888-888888888888", localAssetId: assetId, ordinal: 0, status: "pending" },
          },
          requestId: "start-request",
        }), { status: 201, headers: { "content-type": "application/json" } });
      }
      expect(request?.signal).toBe(controller.signal);
      controller.abort();
      throw new DOMException("The operation was aborted.", "AbortError");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(claimGuestAssets({
      snapshot: {
        draftId: "77777777-7777-4777-8777-777777777777",
        pendingGenerationId,
        snapshotDigest: "a".repeat(64),
        assetManifest: [{ localAssetId: assetId, ordinal: 0, kind: "product", mimeType: "image/jpeg", sizeBytes: 4, checksumSha256: checksum }],
        title: "Coffee campaign",
        mode: "template",
        configuration: {},
        productRecipe: {},
        campaignRecipe: {},
      },
      blobs,
      signal: controller.signal,
    })).rejects.toMatchObject({ name: "AbortError" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).not.toContain("/finalize");
    expect(blobs.get(assetId)).toBe(blob);
  });

  it("retains local blob identity while returning the canonical MongoDB ID on a successful claim and resume", async () => {
    const localAssetId = "44444444-4444-4444-8444-444444444444";
    const assetId = "f1d11edf5c5cbe84bc60d6c5";
    const projectId = "66e6d8e7c51fa82b8e426931";
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" });
    const checksumSha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())), value => value.toString(16).padStart(2, "0")).join("");
    const snapshot = { draftId: "77777777-7777-4777-8777-777777777777", pendingGenerationId: "33333333-3333-4333-8333-333333333333", snapshotDigest: "a".repeat(64), title: "Image claim", mode: "advanced" as const, configuration: {}, productRecipe: {}, campaignRecipe: {}, assetManifest: [{ localAssetId, ordinal: 0, kind: "product" as const, mimeType: "image/jpeg", sizeBytes: 4, checksumSha256 }] };
    const asset = { id: assetId, projectId, kind: "product", objectKey: `users/u/projects/${projectId}/assets/product/${localAssetId}/${checksumSha256}`, mimeType: "image/jpeg", sizeBytes: 4, checksumSha256 };
    const download = { asset, download: { method: "GET", url: "https://storage.example.test/image", expiresInSeconds: 900 }, requestId: "download" };
    const operation = { id: "66e6d8e7c51fa82b8e426932", projectId, draftId: snapshot.draftId, pendingGenerationId: snapshot.pendingGenerationId, snapshotDigest: snapshot.snapshotDigest, status: "securing", nextAsset: null };
    const version = { id: "66e6d8e7c51fa82b8e426933", projectId, parentVersionId: null, templateVersionId: null, mode: "advanced", versionNumber: 1, configuration: {}, productRecipe: {}, campaignRecipe: {}, changeReason: null, createdAt: "2026-09-15T00:00:00.000Z" };
    const project = { id: projectId, title: snapshot.title, mode: "advanced", status: "ready", currentWorkingVersionId: version.id, currentAcceptedVersionId: null, latestRenderRunId: null, latestRenderProjectVersionId: null, latestRenderRunStatus: null, deletedAt: null, createdAt: version.createdAt, updatedAt: version.createdAt, currentVersion: version, versionCount: 1, outputCount: 0 };
    const claim = { status: "ready", draftId: snapshot.draftId, pendingGenerationId: snapshot.pendingGenerationId, snapshotDigest: snapshot.snapshotDigest, assetManifest: snapshot.assetManifest, project, version };
    const json = (body: object) => new Response(JSON.stringify({ ...body, requestId: "request-test-claim" }), { status: 200, headers: { "content-type": "application/json" } });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ operation: { ...operation, nextAsset: { id: operation.id, localAssetId, ordinal: 0, status: "pending" } }, requestId: "start" }))
      .mockResolvedValueOnce(json({ asset, upload: { method: "PUT", url: "https://storage.example.test/upload", headers: {}, expiresInSeconds: 900 }, requestId: "reserve" }))
      .mockResolvedValueOnce(json(download))
      .mockResolvedValueOnce(json({ asset, status: "ready", requestId: "complete" }))
      .mockResolvedValueOnce(json({ operation, requestId: "resume" }))
      .mockResolvedValueOnce(json({ claim, requestId: "finalize" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await claimGuestAssets({ snapshot, blobs: new Map([[localAssetId, blob]]) });
    expect(result.assets[0]).toMatchObject({ localAssetId, assetId, storagePath: asset.objectKey });
    expect(String(fetchMock.mock.calls[3]![0])).toContain(`/assets/${assetId}/complete`);
    expect(JSON.parse(fetchMock.mock.calls[3]![1]!.body as string).localAssetId).toBe(localAssetId);
    fetchMock.mockReset().mockResolvedValueOnce(json({ operation, requestId: "start" })).mockResolvedValueOnce(json({ claim, requestId: "finalize" })).mockResolvedValueOnce(json(download));
    expect((await claimGuestAssets({ snapshot, blobs: new Map() })).assets[0]).toMatchObject({ localAssetId, assetId });
    fetchMock.mockReset().mockResolvedValueOnce(json({ operation: { ...operation, status: "ready" }, requestId: "resume" })).mockResolvedValueOnce(json({ claim, requestId: "finalize" })).mockResolvedValueOnce(json(download));
    expect((await claimGuestAssets({ snapshot, blobs: new Map(), resumeReady: true })).assets[0]).toMatchObject({ localAssetId, assetId });
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ credentials: "include" });
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/claim/start"))).toBe(false);
  });

  it("calls the authenticated mirror endpoint and returns only the private stored asset", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({
        asset: {
          id: "11111111-1111-4111-8111-111111111111",
          projectId: "22222222-2222-4222-8222-222222222222",
          kind: "product",
          objectKey: "users/u/projects/p/assets/product/a/checksum",
          mimeType: "image/jpeg",
          sizeBytes: 6,
          checksumSha256: "a".repeat(64),
        },
        download: {
          method: "GET",
          url: "https://storage.example.test/private.jpg?signature=short-lived",
          expiresInSeconds: 900,
        },
        requestId: "request-mirror-client-1",
      }), { status: 201, headers: { "content-type": "application/json" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const assets: CreatorAsset[] = [
      {
        id: "remote-1",
        name: "AirPods Max.jpg",
        url: "https://cdn.example.test/apple/airpods-max.jpg",
        source: "url",
      },
      {
        id: "uploaded-1",
        name: "Side angle.jpg",
        url: "blob:http://localhost/uploaded-1",
        storagePath: "users/u/projects/p/assets/product/uploaded-1/checksum",
        source: "upload",
      },
    ];

    const result = await mirrorProductImages(
      "22222222-2222-4222-8222-222222222222",
      assets,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(
      /\/api\/v1\/projects\/22222222-2222-4222-8222-222222222222\/assets\/mirror$/,
    );
    expect(request).toMatchObject({ method: "POST", credentials: "include" });
    expect((request as RequestInit).headers).toMatchObject({
      "content-type": "application/json",
      "idempotency-key": expect.stringMatching(/^asset-mirror:[a-f0-9]{48}$/),
    });
    expect(JSON.parse(String((request as RequestInit).body))).toEqual({
      kind: "product",
      url: "https://cdn.example.test/apple/airpods-max.jpg",
      originalFilename: "AirPods Max.jpg",
    });
    expect(result[0]).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      name: "AirPods Max.jpg",
      source: "url",
      url: "https://storage.example.test/private.jpg?signature=short-lived",
      storagePath: "users/u/projects/p/assets/product/a/checksum",
      checksum: "a".repeat(64),
    });
    expect(result[1]).toEqual(assets[1]);
  });

  it("rejects an unsupported storage MIME type instead of weakening the image contract", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      asset: {
        id: "11111111-1111-4111-8111-111111111111",
        projectId: "22222222-2222-4222-8222-222222222222",
        kind: "product",
        objectKey: "users/u/projects/p/assets/product/a/checksum",
        mimeType: "image/gif",
        sizeBytes: 6,
        checksumSha256: "a".repeat(64),
      },
      download: {
        method: "GET",
        url: "https://storage.example.test/private.gif?signature=short-lived",
        expiresInSeconds: 900,
      },
      requestId: "request-mirror-client-invalid-mime",
    }), { status: 201, headers: { "content-type": "application/json" } })));

    await expect(mirrorProductImages(
      "22222222-2222-4222-8222-222222222222",
      [{
        id: "remote-1",
        name: "AirPods Max.gif",
        url: "https://cdn.example.test/apple/airpods-max.gif",
        source: "url",
      }],
    )).rejects.toThrow("unsupported image type");
  });
});
