import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  startRender: vi.fn(),
  renderStatus: vi.fn(),
  outputDownload: vi.fn(),
  cancelRender: vi.fn(),
}));

vi.mock("@/config/features", () => ({ isFeatureEnabled: (name: string) => name === "portableAuth" }));
vi.mock("@/lib/api/portableApiClient", () => ({ portableCreatorApi: api }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn(() => { throw new Error("legacy_generation_called"); }) } },
}));

import {
  cancelCreatorGeneration,
  pollCreatorGeneration,
  startCreatorGeneration,
} from "./api";

const projectId = "11111111-1111-4111-8111-111111111111";
const versionId = "22222222-2222-4222-8222-222222222222";
const quoteId = "33333333-3333-4333-8333-333333333333";
const runId = "44444444-4444-4444-8444-444444444444";

function run(status: "queued" | "processing" | "completed" | "failed" | "cancelled", outputAvailable = false) {
  return {
    id: runId,
    projectId,
    projectVersionId: versionId,
    capability: "video.product_fidelity" as const,
    quoteId,
    quotedCredits: 4,
    chargedCredits: status === "completed" ? 4 : 0,
    starterEntitlementUsed: true,
    status,
    outputAvailable,
    error: status === "failed" ? { code: "provider_failed", message: "Provider failed." } : null,
    createdAt: "2026-08-14T18:00:00.000Z",
    updatedAt: "2026-08-14T18:01:00.000Z",
    completedAt: status === "completed" ? "2026-08-14T18:01:00.000Z" : null,
  };
}

describe("portable creator generation bridge", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts the canonical render instead of invoking the legacy edge function", async () => {
    api.startRender.mockResolvedValue(run("queued"));
    const result = await startCreatorGeneration({
      projectId,
      projectVersionId: versionId,
      quoteId,
      idempotencyKey: "render:one",
      mode: "template",
      prompt: "Create an AirPods Max product reveal.",
      capability: "video.product_fidelity",
      options: { duration: 4, aspect_ratio: "9:16", resolution: "720p", audio: true },
      rightsAttested: true,
    });

    expect(api.startRender).toHaveBeenCalledWith(
      { projectId, projectVersionId: versionId, quoteId, rightsAttested: true },
      "render:one",
    );
    expect(result.runId).toBe(runId);
    expect(result.job.status).toBe("queued");
  });

  it("fails closed before any render call when rights are not attested", async () => {
    await expect(startCreatorGeneration({
      projectId,
      projectVersionId: versionId,
      quoteId,
      idempotencyKey: "render:no-rights",
      mode: "template",
      prompt: "Create an AirPods Max product reveal.",
      capability: "video.product_fidelity",
      options: { duration: 4, aspect_ratio: "9:16", resolution: "720p", audio: true },
      rightsAttested: false,
    })).rejects.toThrow("Confirm that you have permission");
    expect(api.startRender).not.toHaveBeenCalled();
  });

  it("refreshes the private output URL only after a completed canonical render", async () => {
    api.renderStatus.mockResolvedValue(run("completed", true));
    api.outputDownload.mockResolvedValue("http://127.0.0.1:9000/signed-output");

    const result = await pollCreatorGeneration(runId);

    expect(api.outputDownload).toHaveBeenCalledWith(projectId, runId);
    expect(result.status).toBe("completed");
    expect(result.video_url).toBe("http://127.0.0.1:9000/signed-output");
  });

  it("cancels through the canonical idempotent endpoint", async () => {
    api.cancelRender.mockResolvedValue(run("cancelled"));
    await cancelCreatorGeneration(runId);
    expect(api.cancelRender).toHaveBeenCalledWith(runId, `render-cancel:${runId}`);
  });
});
