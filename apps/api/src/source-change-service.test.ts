import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { createSourceChangeService } from "./source-change-service.js";

describe("source change service", () => {
  it("binds a canonical source fingerprint to one immutable source-replacement version", async () => {
    const projectId = randomUUID();
    const parentVersionId = randomUUID();
    const sourceAssetId = randomUUID();
    const repository = {
      replaceSource: vi.fn().mockResolvedValue({ id: randomUUID(), versionNumber: 2 }),
    };
    const service = createSourceChangeService({ repository });

    await service.replace({
      userId: randomUUID(),
      projectId,
      idempotencyKey: "source-change:coffee-v2",
      input: {
        parentVersionId,
        mode: "template",
        configuration: { creatorProject: { videoUrl: "https://old.example.test/output.mp4" } },
        productRecipe: { name: "Coffee", images: [{ assetId: sourceAssetId, checksum: "a".repeat(64) }] },
        campaignRecipe: { language: "en", cta: "Shop now" },
        source: {
          type: "upload",
          name: "Coffee",
          description: "Gift set",
          price: "12.500",
          brand: "Northfield",
          assetIds: [sourceAssetId],
        },
      },
    });

    expect(repository.replaceSource).toHaveBeenCalledWith(expect.objectContaining({
      userId: expect.any(String),
      projectId,
      parentVersionId,
      idempotencyKey: "source-change:coffee-v2",
      sourceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      input: expect.objectContaining({
        configuration: expect.objectContaining({ sourceFingerprint: expect.any(String) }),
      }),
    }));
    expect(repository.replaceSource.mock.calls[0]?.[0].input.configuration.creatorProject).toMatchObject({
      videoUrl: null,
      renderRunId: null,
      jobId: null,
    });
  });
});
