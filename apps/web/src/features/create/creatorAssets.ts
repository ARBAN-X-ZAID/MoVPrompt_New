import {
  AssetReadyResponseSchema,
  GuestClaimOperationResponseSchema,
  GuestClaimResponseSchema,
  MirroredAssetResponseSchema,
  SignedAssetDownloadResponseSchema,
  SignedAssetUploadResponseSchema,
  type GuestClaimReceipt,
  type GuestClaimSnapshot,
  type CreatorAssetKind,
} from "@movprompt/contracts";

import type { CreatorAsset } from "./types";
import { canonicalCreatorAssetId } from "./creatorAssetIdentity";

type CreatorSourceMimeType = NonNullable<CreatorAsset["mimeType"]>;

/** Factual browser-visible checkpoints emitted only at durable claim boundaries. */
export type GuestClaimProgress =
  | { stage: "creating" }
  | { stage: "asset"; localAssetId: string; current: number; total: number }
  | { stage: "verifying" };

function abortError(): DOMException {
  return new DOMException("The private campaign claim was cancelled.", "AbortError");
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : abortError();
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
    || error instanceof Error && error.name === "AbortError";
}

function parseCreatorSourceMimeType(value: string): CreatorSourceMimeType {
  if (["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"].includes(value)) return value;
  throw new Error("MovPrompt received an unsupported image type or video type from storage. Your local draft is unchanged.");
}

function apiOrigin(): string {
  const configured = import.meta.env.VITE_API_ORIGIN?.trim();
  return configured ? new URL(configured).origin : window.location.origin;
}

async function sha256(blob: Blob) {
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function jsonResponse(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) return body;
  const error = body && typeof body === "object" && "error" in body ? body.error : null;
  const message = error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : "MovPrompt could not save this image.";
  throw new Error(message);
}

async function reservePrivateAsset(
  projectId: string,
  idempotencyKey: string,
  body: string,
  signal?: AbortSignal,
): Promise<Response> {
  const request = () => fetch(
    `${apiOrigin()}/api/v1/projects/${projectId}/assets/upload-url`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body,
      signal,
    },
  );
  assertNotAborted(signal);
  const first = await request();
  // A newly claimed project can become visible to a second pooled database
  // connection a fraction later. Retry the same idempotent reservation once;
  // every other failure remains fail-closed and surfaces immediately.
  if (first.status !== 404) return first;
  assertNotAborted(signal);
  await new Promise((resolve) => window.setTimeout(resolve, 120));
  assertNotAborted(signal);
  return request();
}

export class GuestClaimAssetFailure extends Error {
  constructor(readonly localAssetId: string, cause: unknown) {
    super("MovPrompt could not secure this image. Your local draft is unchanged.");
    this.name = "GuestClaimAssetFailure";
    this.cause = cause;
  }
}

export type ClaimedGuestAsset = {
  localAssetId: string;
  assetId: string;
  storagePath: string;
  kind: CreatorAssetKind;
  mimeType: CreatorSourceMimeType;
  checksum: string;
  durationMs?: number;
  url: string;
};

export async function requestClaimOperation(
  pendingGenerationId: string,
  signal?: AbortSignal,
): Promise<ReturnType<typeof GuestClaimOperationResponseSchema.parse>["operation"]> {
  assertNotAborted(signal);
  const response = await fetch(`${apiOrigin()}/api/v1/drafts/claim/${pendingGenerationId}`, {
    credentials: "include",
    signal,
  });
  if (response.status === 404) throw new GuestClaimOperationMissingError();
  return GuestClaimOperationResponseSchema.parse(await jsonResponse(response)).operation;
}

export class GuestClaimOperationMissingError extends Error {
  constructor() {
    super("The campaign save has not started yet.");
    this.name = "GuestClaimOperationMissingError";
  }
}

async function secureClaimAsset(input: {
  projectId: string;
  pendingGenerationId: string;
  localAssetId: string;
  kind: CreatorAssetKind;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  durationMs?: number;
  blob: Blob;
  signal?: AbortSignal;
}): Promise<ClaimedGuestAsset> {
  assertNotAborted(input.signal);
  if (input.blob.size !== input.sizeBytes || input.blob.type !== input.mimeType || await sha256(input.blob) !== input.checksumSha256) {
    throw new Error("local_asset_integrity_mismatch");
  }
  const uploadResponse = await reservePrivateAsset(
    input.projectId,
    `asset:${input.localAssetId}:${input.checksumSha256.slice(0, 24)}`,
    JSON.stringify({
      assetId: input.localAssetId,
      kind: input.kind,
      metadata: {
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        checksumSha256: input.checksumSha256,
        ...(input.durationMs === undefined ? {} : { durationMs: input.durationMs }),
      },
    }),
    input.signal,
  );
  const upload = SignedAssetUploadResponseSchema.parse(await jsonResponse(uploadResponse));
  const canonicalAssetId = await canonicalCreatorAssetId(input.localAssetId);
  if (
    (upload.asset.id !== input.localAssetId && upload.asset.id !== canonicalAssetId) ||
    upload.asset.projectId !== input.projectId ||
    upload.asset.mimeType !== input.mimeType ||
    upload.asset.sizeBytes !== input.sizeBytes ||
    upload.asset.checksumSha256 !== input.checksumSha256
  ) {
    throw new Error("claim_asset_metadata_mismatch");
  }
  const stored = await fetch(
    `${apiOrigin()}/api/v1/projects/${input.projectId}/assets/${upload.asset.id}/content`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": upload.asset.mimeType },
      body: input.blob,
      signal: input.signal,
    },
  );
  // A signed preview may exist only in this response. Claim recovery stores neither it nor the object key.
  const download = SignedAssetDownloadResponseSchema.parse(await jsonResponse(stored));
  if (download.asset.id !== upload.asset.id || download.asset.projectId !== input.projectId || download.asset.checksumSha256 !== input.checksumSha256) {
    throw new Error("claim_asset_upload_mismatch");
  }
  const completed = await fetch(
    `${apiOrigin()}/api/v1/projects/${input.projectId}/assets/${upload.asset.id}/complete`,
    {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pendingGenerationId: input.pendingGenerationId, localAssetId: input.localAssetId }),
      signal: input.signal,
    },
  );
  const ready = AssetReadyResponseSchema.parse(await jsonResponse(completed));
  if (ready.asset.id !== upload.asset.id || ready.asset.projectId !== input.projectId || ready.asset.checksumSha256 !== input.checksumSha256) {
    throw new Error("claim_asset_completion_mismatch");
  }
  return {
    localAssetId: input.localAssetId,
    assetId: ready.asset.id,
    storagePath: ready.asset.objectKey,
    kind: ready.asset.kind,
    mimeType: parseCreatorSourceMimeType(ready.asset.mimeType),
    checksum: ready.asset.checksumSha256,
    ...(ready.asset.durationMs === undefined ? {} : { durationMs: ready.asset.durationMs }),
    // The URL remains in active component state only. projectStore removes it
    // before the project cache is written to durable browser storage.
    url: download.download.url,
  };
}

/**
 * Browser claim orchestration deliberately follows the server's next checkpoint.
 * It never deletes or rewrites supplied blobs; cleanup is gated by canonical receipt verification.
 */
export async function claimGuestAssets(input: {
  snapshot: GuestClaimSnapshot;
  blobs: ReadonlyMap<string, Blob>;
  signal?: AbortSignal;
  resumeReady?: boolean;
  onProgress?: (progress: GuestClaimProgress) => void;
}): Promise<{ receipt: GuestClaimReceipt; assets: ClaimedGuestAsset[] }> {
  assertNotAborted(input.signal);
  input.onProgress?.({ stage: "creating" });
  const started = input.resumeReady ? null : await fetch(`${apiOrigin()}/api/v1/drafts/claim/start`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
      "idempotency-key": input.snapshot.pendingGenerationId,
    },
    body: JSON.stringify(input.snapshot),
    signal: input.signal,
  });
  let operation = started
    ? GuestClaimOperationResponseSchema.parse(await jsonResponse(started)).operation
    : await requestClaimOperation(input.snapshot.pendingGenerationId, input.signal);
  if (input.resumeReady && operation.status !== "ready") throw new Error("The saved campaign is not ready for recovery.");
  const manifest = new Map(input.snapshot.assetManifest.map((asset) => [asset.localAssetId, asset]));
  const securedAssets = new Map<string, ClaimedGuestAsset>();

  while (operation.nextAsset) {
    assertNotAborted(input.signal);
    const checkpoint = operation.nextAsset;
    const asset = manifest.get(checkpoint.localAssetId);
    const blob = asset ? input.blobs.get(asset.localAssetId) : undefined;
    if (!asset || !blob) throw new GuestClaimAssetFailure(checkpoint.localAssetId, new Error("local_asset_missing"));
    input.onProgress?.({
      stage: "asset",
      localAssetId: checkpoint.localAssetId,
      current: checkpoint.ordinal + 1,
      total: input.snapshot.assetManifest.length,
    });
    try {
      const secured = await secureClaimAsset({
        projectId: operation.projectId,
        pendingGenerationId: input.snapshot.pendingGenerationId,
        localAssetId: asset.localAssetId,
        kind: asset.kind,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        checksumSha256: asset.checksumSha256,
        ...(asset.durationMs === undefined ? {} : { durationMs: asset.durationMs }),
        blob,
        signal: input.signal,
      });
      securedAssets.set(secured.localAssetId, secured);
    } catch (error) {
      if (isAbortError(error)) throw error;
      throw new GuestClaimAssetFailure(checkpoint.localAssetId, error);
    }
    operation = await requestClaimOperation(input.snapshot.pendingGenerationId, input.signal);
  }

  assertNotAborted(input.signal);
  input.onProgress?.({ stage: "verifying" });
  const finalized = await fetch(
    `${apiOrigin()}/api/v1/drafts/claim/${input.snapshot.pendingGenerationId}/finalize`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "idempotency-key": input.snapshot.pendingGenerationId,
      },
      body: JSON.stringify({}),
      signal: input.signal,
    },
  );
  const receipt = GuestClaimResponseSchema.parse(await jsonResponse(finalized)).claim;
  // A retry may resume after a browser interruption, leaving some assets
  // already verified by an earlier attempt. Refresh their signed previews
  // from the owned endpoint while retaining only stable metadata in projects.
  for (const asset of receipt.assetManifest) {
    assertNotAborted(input.signal);
    if (securedAssets.has(asset.localAssetId)) continue;
    const response = await fetch(
      `${apiOrigin()}/api/v1/projects/${receipt.project.id}/assets/${asset.localAssetId}/download-url`,
      { credentials: "include", signal: input.signal },
    );
    const download = SignedAssetDownloadResponseSchema.parse(await jsonResponse(response));
    const canonicalAssetId = await canonicalCreatorAssetId(asset.localAssetId);
    if ((download.asset.id !== asset.localAssetId && download.asset.id !== canonicalAssetId) || download.asset.projectId !== receipt.project.id || download.asset.checksumSha256 !== asset.checksumSha256) {
      throw new GuestClaimAssetFailure(asset.localAssetId, new Error("claim_asset_resume_mismatch"));
    }
    securedAssets.set(asset.localAssetId, {
      localAssetId: asset.localAssetId,
      assetId: download.asset.id,
      storagePath: download.asset.objectKey,
      kind: download.asset.kind,
      mimeType: parseCreatorSourceMimeType(download.asset.mimeType),
      checksum: download.asset.checksumSha256,
      ...(download.asset.durationMs === undefined ? {} : { durationMs: download.asset.durationMs }),
      url: download.download.url,
    });
  }
  return { receipt, assets: [...securedAssets.values()] };
}

export async function claimGuestImage(input: {
  userId: string;
  projectId: string;
  assetId: string;
  name: string;
  blob: Blob;
  contentType: string;
  kind?: Extract<CreatorAssetKind, "product" | "reference">;
}) {
  const checksum = await sha256(input.blob);
  const idempotencyKey = `asset:${input.assetId}:${checksum.slice(0, 24)}`;
  const uploadResponse = await reservePrivateAsset(
    input.projectId,
    idempotencyKey,
    JSON.stringify({
      kind: input.kind ?? "product",
      metadata: {
        mimeType: input.contentType || "image/jpeg",
        sizeBytes: input.blob.size,
        checksumSha256: checksum,
        originalFilename: input.name,
      },
    }),
  );
  const upload = SignedAssetUploadResponseSchema.parse(await jsonResponse(uploadResponse));
  const stored = await fetch(
    `${apiOrigin()}/api/v1/projects/${input.projectId}/assets/${upload.asset.id}/content`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": upload.asset.mimeType },
      body: input.blob,
    },
  );
  const download = SignedAssetDownloadResponseSchema.parse(await jsonResponse(stored));
  return {
    assetId: upload.asset.id,
    storagePath: upload.asset.objectKey,
    mimeType: parseCreatorSourceMimeType(upload.asset.mimeType),
    url: download.download.url,
    checksum,
  };
}

export async function mirrorProductImages(projectId: string, assets: CreatorAsset[]) {
  const mirrored: CreatorAsset[] = [];
  for (const asset of assets) {
    if (asset.source !== "url" || asset.storagePath) {
      mirrored.push(asset);
      continue;
    }

    const urlChecksum = await sha256(new Blob([asset.url], { type: "text/plain" }));
    const response = await fetch(
      `${apiOrigin()}/api/v1/projects/${projectId}/assets/mirror`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "idempotency-key": `asset-mirror:${urlChecksum.slice(0, 48)}`,
        },
        body: JSON.stringify({
          kind: "product",
          url: asset.url,
          originalFilename: asset.name,
        }),
      },
    );
    const result = MirroredAssetResponseSchema.parse(await jsonResponse(response));
    mirrored.push({
      ...asset,
      id: result.asset.id,
      storagePath: result.asset.objectKey,
      mimeType: parseCreatorSourceMimeType(result.asset.mimeType),
      url: result.download.url,
      checksum: result.asset.checksumSha256,
    });
  }
  return mirrored;
}
