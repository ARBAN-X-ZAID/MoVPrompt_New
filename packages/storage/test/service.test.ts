import { HeadBucketCommand, type S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { R2Storage } from "../src/service.js";

describe("R2Storage signed uploads", () => {
  it("probes only configured private buckets", async () => {
    const send = vi.fn(async () => ({}));
    const storage = new R2Storage({
      accountId: "a".repeat(32),
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      assetsBucket: "creator-assets",
      outputsBucket: "creator-outputs",
    }, { send } as unknown as S3Client);

    await storage.checkBucket("creator-assets");
    expect(send).toHaveBeenCalledWith(expect.any(HeadBucketCommand));
    await expect(storage.checkBucket("attacker-bucket")).rejects.toThrow("not allowed");
  });

  it("returns the declared content type as a required browser upload header", async () => {
    const storage = new R2Storage({
      accountId: "a".repeat(32),
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      assetsBucket: "creator-assets",
      outputsBucket: "creator-outputs",
    });
    const signed = await storage.signUpload({
      bucket: "creator-assets",
      key: `users/user-1/projects/project-1/assets/product/asset-1/${"a".repeat(64)}`,
      metadata: {
        mimeType: "image/jpeg",
        sizeBytes: 1_024,
        checksumSha256: "a".repeat(64),
      },
    });

    expect(signed.headers).toEqual({ "content-type": "image/jpeg" });
    expect(signed.url).toContain("x-amz-meta-sha256-hex=");
  });
});
