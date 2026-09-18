import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import { imageDimensions } from "./gateway-video-smoke.js";
import {
  createGatewayFirstFramePreparer,
  createVerifiedReferenceUrlResolver,
} from "./reference-frame-preparer.js";

function pngBytes(): Uint8Array {
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
}

function jpegWithDimensions(width: number, height: number): Uint8Array {
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    0xff, 0xd9,
  ]);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function verifiedReference(body: Uint8Array, mimeType = "image/png") {
  const checksumSha256 = sha256(body);
  return {
    reference: {
      objectKey: `users/user-1/projects/project-1/assets/product/asset-1/${checksumSha256}`,
      // This deliberately remains untrusted and incorrect in the first test.
      mimeType: "image/jpeg",
    },
    asset: {
      assetId: "asset-1",
      bucket: "creator-assets",
      objectKey: `users/user-1/projects/project-1/assets/product/asset-1/${checksumSha256}`,
      mimeType,
      sizeBytes: body.byteLength,
      checksumSha256,
    },
  } as const;
}

describe("Gateway private first-frame preparation", () => {
  it("trusts matching S3 metadata plus magic bytes, ignores client MIME and contain+pads to the exact canvas", async () => {
    const body = pngBytes();
    const verified = verifiedReference(body);
    const get = vi.fn(async () => ({
      body,
      contentType: "image/png",
      checksumSha256: verified.asset.checksumSha256,
    }));
    const verifyReference = vi.fn(async () => verified.asset);
    const runCommand = vi.fn(async (_command: string, args: readonly string[]) => {
      expect(args.join(" ")).toContain("scale=720:960:force_original_aspect_ratio=decrease");
      expect(args.join(" ")).toContain("pad=720:960:(ow-iw)/2:(oh-ih)/2:color=white");
      const inputPath = args[args.indexOf("-i") + 1]!;
      expect(inputPath.endsWith(".png")).toBe(true);
      expect(new Uint8Array(await readFile(inputPath)).subarray(0, 8)).toEqual(pngBytes().subarray(0, 8));
      await writeFile(args.at(-1)!, jpegWithDimensions(720, 960));
    });
    const prepare = createGatewayFirstFramePreparer({
      storage: { assetsBucket: "creator-assets", get },
      verifyReference,
      ffmpegPath: "/usr/local/bin/ffmpeg",
      runCommand,
    });

    const frame = await prepare(
      // The browser currently declares every path as JPEG. Storage metadata
      // and bytes—not this client value—must determine the decoder.
      verified.reference,
      {
        operationId: "run-1",
        userId: "user-1",
        projectId: "project-1",
        capability: "video.product_fidelity",
        prompt: "Preserve the product.",
        durationSeconds: 4,
        aspectRatio: "4:5",
        resolution: "720p",
        references: [],
        idempotencyKey: "submit:run-1",
      },
    );

    expect(frame).toMatchObject({ type: "file", mediaType: "image/jpeg" });
    expect(imageDimensions(Buffer.from(frame.data, "base64"), "image/jpeg"))
      .toEqual({ width: 720, height: 960 });
    expect(get).toHaveBeenCalledWith({
      bucket: "creator-assets",
      key: verified.asset.objectKey,
      maxBytes: 30 * 1024 * 1024,
    });
    expect(verifyReference).toHaveBeenCalledWith(
      verified.reference,
      expect.objectContaining({ userId: "user-1", projectId: "project-1" }),
    );
  });

  it("rejects a storage MIME/magic mismatch before invoking FFmpeg", async () => {
    const body = pngBytes();
    const verified = verifiedReference(body);
    const runCommand = vi.fn();
    const prepare = createGatewayFirstFramePreparer({
      storage: {
        assetsBucket: "creator-assets",
        get: async () => ({
          body,
          contentType: "image/jpeg",
          checksumSha256: verified.asset.checksumSha256,
        }),
      },
      verifyReference: async () => verified.asset,
      ffmpegPath: "ffmpeg",
      runCommand,
    });

    await expect(prepare(
      verified.reference,
      {
        operationId: "run-2",
        userId: "user-1",
        projectId: "project-1",
        capability: "video.product_fidelity",
        prompt: "Preserve the product.",
        references: [],
        idempotencyKey: "submit:run-2",
      },
    )).rejects.toThrow("gateway_first_frame_source_mime_invalid");
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("fails closed when FFmpeg does not return the requested dimensions", async () => {
    const body = pngBytes();
    const verified = verifiedReference(body);
    const prepare = createGatewayFirstFramePreparer({
      storage: {
        assetsBucket: "creator-assets",
        get: async () => ({
          body,
          contentType: "image/png",
          checksumSha256: verified.asset.checksumSha256,
        }),
      },
      verifyReference: async () => verified.asset,
      ffmpegPath: "ffmpeg",
      runCommand: async (_command, args) => {
        await writeFile(args.at(-1)!, jpegWithDimensions(480, 480));
      },
    });

    await expect(prepare(
      verified.reference,
      {
        operationId: "run-3",
        userId: "user-1",
        projectId: "project-1",
        capability: "video.cinematic",
        prompt: "Cinematic product motion.",
        aspectRatio: "9:16",
        resolution: "720p",
        references: [],
        idempotencyKey: "submit:run-3",
      },
    )).rejects.toThrow("gateway_first_frame_canvas_mismatch");
  });

  it("fails before FFmpeg when DB, S3 metadata or bytes do not match", async () => {
    const body = pngBytes();
    const verified = verifiedReference(body);
    const runCommand = vi.fn();
    const prepare = createGatewayFirstFramePreparer({
      storage: {
        assetsBucket: "creator-assets",
        get: async () => ({
          body,
          contentType: "image/png",
          checksumSha256: "0".repeat(64),
        }),
      },
      verifyReference: async () => verified.asset,
      ffmpegPath: "ffmpeg",
      runCommand,
    });

    await expect(prepare(verified.reference, {
      operationId: "run-integrity",
      userId: "user-1",
      projectId: "project-1",
      capability: "video.product_fidelity",
      prompt: "Preserve the product.",
      references: [],
      idempotencyKey: "submit:run-integrity",
    })).rejects.toThrow("gateway_first_frame_source_integrity_invalid");
    expect(runCommand).not.toHaveBeenCalled();
  });

  it("fails before storage access when ownership verification rejects the client key", async () => {
    const body = pngBytes();
    const verified = verifiedReference(body);
    const get = vi.fn();
    const prepare = createGatewayFirstFramePreparer({
      storage: { assetsBucket: "creator-assets", get },
      verifyReference: async () => { throw new Error("gateway_reference_not_owned"); },
      ffmpegPath: "ffmpeg",
    });

    await expect(prepare(verified.reference, {
      operationId: "run-owner",
      userId: "other-user",
      projectId: "other-project",
      capability: "video.product_fidelity",
      prompt: "Preserve the product.",
      references: [],
      idempotencyKey: "submit:run-owner",
    })).rejects.toThrow("gateway_reference_not_owned");
    expect(get).not.toHaveBeenCalled();
  });

  it("signs a non-frame reference only after authoritative DB and S3 verification", async () => {
    const body = pngBytes();
    const verified = verifiedReference(body);
    const signDownload = vi.fn(async () => ({ url: "https://assets.example.test/ref.png?signature=secret" }));
    const resolve = createVerifiedReferenceUrlResolver({
      storage: {
        assetsBucket: "creator-assets",
        get: async () => ({
          body,
          contentType: "image/png",
          checksumSha256: verified.asset.checksumSha256,
        }),
        signDownload,
      },
      verifyReference: async () => verified.asset,
    });

    await expect(resolve(verified.reference, {
      operationId: "run-direct",
      userId: "user-1",
      projectId: "project-1",
      capability: "video.cinematic",
      prompt: "Use the verified reference.",
      references: [],
      idempotencyKey: "submit:run-direct",
    })).resolves.toEqual({
      url: "https://assets.example.test/ref.png?signature=secret",
      mediaType: "image/png",
    });
    expect(signDownload).toHaveBeenCalledWith({
      bucket: "creator-assets",
      key: verified.asset.objectKey,
      expiresInSeconds: 3_600,
    });
  });
});
