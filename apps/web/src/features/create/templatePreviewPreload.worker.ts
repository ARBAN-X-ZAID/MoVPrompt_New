const APPROVED_PREVIEW = /\/api\/v1\/template-previews\/v[13]\/[a-z0-9-]+\.mp4(?:\?|$)/;
const controllers = new Map<number, AbortController>();

type PreviewWorkerRequest =
  | { type: "load"; id: number; url: string }
  | { type: "abort"; id: number };

self.onmessage = (event: MessageEvent<PreviewWorkerRequest>) => {
  if (event.data.type === "abort") {
    controllers.get(event.data.id)?.abort();
    return;
  }
  void loadPreview(event.data.id, event.data.url);
};

async function loadPreview(id: number, url: string) {
  if (!APPROVED_PREVIEW.test(url)) {
    self.postMessage({ id, ok: false, aborted: false });
    return;
  }
  const controller = new AbortController();
  controllers.set(id, controller);
  const prefetchUrl = url.includes("?") ? `${url}&prefetch=1` : `${url}?prefetch=1`;
  try {
    const response = await fetch(prefetchUrl, { credentials: "omit", signal: controller.signal });
    if (!response.ok) {
      self.postMessage({ id, ok: false, aborted: false });
      return;
    }
    const buffer = await response.arrayBuffer();
    if (controller.signal.aborted) {
      self.postMessage({ id, ok: false, aborted: true });
      return;
    }
    self.postMessage({ id, ok: true, aborted: false, buffer }, [buffer]);
  } catch (error) {
    const aborted = controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError");
    self.postMessage({ id, ok: false, aborted });
  } finally {
    controllers.delete(id);
  }
}
