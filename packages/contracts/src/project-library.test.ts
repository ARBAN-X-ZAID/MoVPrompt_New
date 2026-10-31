import { describe, expect, it } from "vitest";

import {
  ProjectLibraryQuerySchema,
  ProjectLibraryResponseSchema,
  draftProjectBucket,
  isRenderRunActive,
  renderRunBucket,
} from "./project-library.js";

const projectId = "507f1f77bcf86cd799439011";
const run = {
  id: "507f1f77bcf86cd799439012",
  projectId,
  projectVersionId: "507f1f77bcf86cd799439013",
  capability: "video.product_fidelity",
  quoteId: "507f1f77bcf86cd799439014",
  quotedCredits: 40,
  chargedCredits: 40,
  starterEntitlementUsed: false,
  status: "completed",
  processingStage: "ready",
  outputAvailable: true,
  error: null,
  createdAt: "2026-10-31T10:00:00.000Z",
  updatedAt: "2026-10-31T10:01:00.000Z",
  completedAt: "2026-10-31T10:01:00.000Z",
};
const response = {
  items: [{ kind: "run", run }, { kind: "draft", projectId }],
  projects: [],
  total: 2,
  page: 1,
  limit: 40,
  counts: { all: 2, ready: 1, progress: 0, attention: 0, drafts: 1 },
  hasActive: false,
  requestId: "req_1234567890",
};

describe("project library query", () => {
  it("defaults to the first 40 of everything", () => {
    expect(ProjectLibraryQuerySchema.parse({})).toEqual({ page: 1, limit: 40, filter: "all", search: "" });
  });

  it("coerces query strings and trims the search", () => {
    expect(ProjectLibraryQuerySchema.parse({ page: "3", limit: "20", filter: "drafts", search: "  summer " }))
      .toEqual({ page: 3, limit: 20, filter: "drafts", search: "summer" });
  });

  it.each([
    [{ page: "0" }],
    [{ limit: "41" }],
    [{ limit: "0" }],
    [{ filter: "trashed" }],
    [{ search: "x".repeat(121) }],
    [{ userId: "507f1f77bcf86cd799439011" }],
  ])("rejects %j", (query) => {
    expect(ProjectLibraryQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe("project library response", () => {
  it("accepts runs and drafts in display order", () => {
    const parsed = ProjectLibraryResponseSchema.parse(response);
    expect(parsed.items.map((item) => item.kind)).toEqual(["run", "draft"]);
  });

  it("rejects internal run fields", () => {
    const leaked = { ...response, items: [{ kind: "run", run: { ...run, provider: "internal" } }] };
    expect(ProjectLibraryResponseSchema.safeParse(leaked).success).toBe(false);
  });

  it("rejects unknown top-level and count keys", () => {
    expect(ProjectLibraryResponseSchema.safeParse({ ...response, cursor: "next" }).success).toBe(false);
    expect(ProjectLibraryResponseSchema.safeParse({ ...response, counts: { ...response.counts, trashed: 1 } }).success).toBe(false);
  });

  it("rejects a page larger than the limit", () => {
    const items = Array.from({ length: 41 }, () => ({ kind: "draft", projectId }));
    expect(ProjectLibraryResponseSchema.safeParse({ ...response, items }).success).toBe(false);
  });
});

describe("project library buckets", () => {
  it.each([
    ["completed", true, "ready"],
    ["completed", false, "progress"],
    ["failed", true, "attention"],
    ["failed", false, "attention"],
    ["cancelled", false, "attention"],
    ["submitting", false, "progress"],
    ["queued", false, "progress"],
    ["processing", false, "progress"],
    ["cancelling", false, "progress"],
  ] as const)("files a %s run (output %s) under %s", (status, outputAvailable, bucket) => {
    expect(renderRunBucket({ status, outputAvailable })).toBe(bucket);
  });

  it.each([
    ["generating", true, "progress"],
    ["failed", true, "attention"],
    ["ready", true, "ready"],
    ["completed", true, "ready"],
    ["ready", false, "drafts"],
    ["draft", undefined, "drafts"],
    ["review", false, "drafts"],
    ["exporting", false, "drafts"],
  ] as const)("files a %s project (generated %s) under %s", (status, hasGeneratedVideo, bucket) => {
    expect(draftProjectBucket({ status, hasGeneratedVideo })).toBe(bucket);
  });

  it("treats only unfinished statuses as active", () => {
    expect(["submitting", "queued", "processing", "cancelling"].every(isRenderRunActive)).toBe(true);
    expect(["completed", "failed", "cancelled"].some(isRenderRunActive)).toBe(false);
  });
});
