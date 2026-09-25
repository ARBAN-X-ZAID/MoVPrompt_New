import { afterEach, describe, expect, it, vi } from "vitest";

class FakePreviewWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage(message: { type: string; id?: number; url?: string }) {
    FakePreviewWorker.messages.push(message);
  }
  static messages: Array<{ type: string; id?: number; url?: string }> = [];
}

describe("template preview download priority", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakePreviewWorker.messages = [];
  });

  it("starts a preview opened later before videos that were only waiting", async () => {
    vi.stubGlobal("Worker", FakePreviewWorker);
    const { preloadTemplatePreview, previewDownloadOrder, resetPreviewDownloadsForTests } = await import("./templatePreviewPreload");
    resetPreviewDownloadsForTests();
    FakePreviewWorker.messages = [];
    const waiting = "https://api.example.test/api/v1/template-previews/v1/waiting-demo.mp4";
    const opened = "https://api.example.test/api/v1/template-previews/v1/opened-demo.mp4";
    preloadTemplatePreview("https://api.example.test/api/v1/template-previews/v1/first-demo.mp4");
    preloadTemplatePreview("https://api.example.test/api/v1/template-previews/v1/second-demo.mp4");
    preloadTemplatePreview(waiting);
    preloadTemplatePreview(opened, { priority: true });

    expect(previewDownloadOrder().indexOf(opened)).toBeLessThan(previewDownloadOrder().indexOf(waiting));
    expect(FakePreviewWorker.messages.filter((message) => message.type === "abort").length).toBeGreaterThan(0);
  });
});
