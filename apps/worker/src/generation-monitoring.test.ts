import { describe, expect, it, vi } from "vitest";
import { createMongoRenderLifecycleStore } from "./mongo-render-lifecycle-store.js";
import type { MongoDatabase } from "@movprompt/db";

describe("provider submission preflight", () => {
  it("does not mark submission started when creating the attempt fails", async () => {
    const updateRun = vi.fn();
    const updateAttempt = vi.fn(async () => { throw new Error("duplicate index"); });
    const database = { collection: (name: string) => name === "render_attempts" ? { updateOne: updateAttempt } : { findOne: async () => ({ status: "submitting", qualityAttempt: 0, provider: null, providerRequestId: null }), updateOne: updateRun } } as unknown as MongoDatabase;
    const store = createMongoRenderLifecycleStore(database);
    await expect(store.beginProviderSubmission({ runId: "111111111111111111111111", userId: "222222222222222222222222", provider: "test-provider", attemptNumber: 0, now: new Date() })).rejects.toThrow("duplicate index");
    expect(updateRun).not.toHaveBeenCalled();
  });
});
