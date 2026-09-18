import type { S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import { R2Storage } from "../src/service.js";

function storageWith(send: S3Client["send"]): R2Storage {
  return new R2Storage({
    accountId: "a".repeat(32),
    accessKeyId: "test-access-key",
    secretAccessKey: "test-secret-key",
    assetsBucket: "creator-assets",
    outputsBucket: "creator-outputs",
  }, { send } as unknown as S3Client);
}

const objectKey = `users/user-1/projects/project-1/assets/product/asset-1/${"b".repeat(64)}`;

describe("R2Storage bounded server reads", () => {
  it("reads private bytes with normalized MIME metadata and a streaming cap", async () => {
    async function* body() {
      yield Uint8Array.from([1, 2]);
      yield Uint8Array.from([3, 4]);
    }
    const send = vi.fn(async () => ({
      Body: body(),
      ContentLength: 4,
      ContentType: "image/png; charset=binary",
      Metadata: { "sha256-hex": "a".repeat(64) },
    }));

    await expect(storageWith(send as unknown as S3Client["send"]).get({
      bucket: "creator-assets",
      key: objectKey,
      maxBytes: 4,
    })).resolves.toEqual({
      body: Uint8Array.from([1, 2, 3, 4]),
      contentType: "image/png",
      checksumSha256: "a".repeat(64),
    });
    expect(send).toHaveBeenCalledOnce();
  });

  it("rejects declared and streamed objects beyond the caller's cap", async () => {
    async function* oversizedBody() {
      yield Uint8Array.from([1, 2, 3]);
      yield Uint8Array.from([4, 5, 6]);
    }
    const send = vi.fn()
      .mockResolvedValueOnce({ Body: oversizedBody(), ContentLength: 6, ContentType: "image/jpeg" })
      .mockResolvedValueOnce({ Body: oversizedBody(), ContentType: "image/jpeg" });
    const storage = storageWith(send as unknown as S3Client["send"]);
    const request = { bucket: "creator-assets", key: objectKey, maxBytes: 5 };

    await expect(storage.get(request)).rejects.toThrow("exceeds the configured read limit");
    await expect(storage.get(request)).rejects.toThrow("exceeds the configured read limit");
  });
});


describe("R2 project cleanup", () => {
  it("deletes only the exact project prefix in the two private buckets", async () => {
    const owner = "a".repeat(24), project = "b".repeat(24);
    const prefix = `users/${owner}/projects/${project}/`;
    const send = vi.fn().mockResolvedValueOnce({ Contents: [{ Key: `${prefix}video.mp4` }] }).mockResolvedValueOnce({}).mockResolvedValueOnce({ Contents: [] }).mockResolvedValueOnce({ Contents: [] });
    await storageWith(send as unknown as S3Client["send"]).deleteProjectMedia(owner, project);
    expect(send.mock.calls.map(([command]) => command.input)).toEqual([
      { Bucket: "creator-assets", Prefix: prefix, MaxKeys: 500 },
      { Bucket: "creator-assets", Key: `${prefix}video.mp4` },
      { Bucket: "creator-assets", Prefix: prefix, MaxKeys: 500 },
      { Bucket: "creator-outputs", Prefix: prefix, MaxKeys: 500 },
    ]);
  });
  it("rejects invalid identifiers and out-of-scope object results before deleting", async () => {
    const send = vi.fn().mockResolvedValue({ Contents: [{ Key: "users/someone-else/private.mp4" }] });
    const storage = storageWith(send as unknown as S3Client["send"]);
    await expect(storage.deleteProjectMedia("../", "b".repeat(24))).rejects.toThrow("Invalid");
    expect(send).not.toHaveBeenCalled();
    await expect(storage.deleteProjectMedia("a".repeat(24), "b".repeat(24))).rejects.toThrow("namespace");
    expect(send).toHaveBeenCalledOnce();
  });
});
