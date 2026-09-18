import { describe, expect, it } from "vitest";

import { assertOwnedProjectKey, assertStorageKey, objectKeys } from "../src/keys";
import { validateUploadMetadata } from "../src/validation";

const checksum = "a".repeat(64);

describe("stable object keys", () => {
  it("encodes ownership without using an unsafe browser filename", () => {
    const key = objectKeys.creatorAsset({
      userId: "0f6e7df7-c2f8-4611-937f-932bd737eab7",
      projectId: "2b8d7657-8322-40cc-8b25-ec46367e3818",
      assetId: "13ae03ad-5014-4ac6-94d4-a5958453f39f",
      kind: "product",
      checksumSha256: checksum,
    });

    expect(key).toContain("/assets/product/");
    expect(key).not.toContain("../");
    expect(() =>
      assertOwnedProjectKey(
        key,
        "0f6e7df7-c2f8-4611-937f-932bd737eab7",
        "2b8d7657-8322-40cc-8b25-ec46367e3818",
      ),
    ).not.toThrow();
  });

  it("rejects traversal and invalid upload metadata", () => {
    expect(() => assertStorageKey("users/me/../other/file")).toThrow();
    expect(() =>
      validateUploadMetadata({ mimeType: "text/html", sizeBytes: 4, checksumSha256: checksum }),
    ).toThrow(/MIME/);
    expect(() =>
      validateUploadMetadata({ mimeType: "image/png", sizeBytes: 0, checksumSha256: checksum }),
    ).toThrow(/size/);
  });
});
