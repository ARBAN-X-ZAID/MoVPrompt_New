const APPROVED_PREVIEW = /\/api\/v1\/template-previews\/v[13]\/[a-z0-9-]+\.mp4(?:\?|$)/;

self.onmessage = (event: MessageEvent<{ id: number; url: string }>) => {
  const { id, url } = event.data;
  void loadPreview(id, url);
};

async function loadPreview(id: number, url: string) {
  if (!APPROVED_PREVIEW.test(url)) {
    self.postMessage({ id, ok: false });
    return;
  }
  const prefetchUrl = url.includes("?") ? `${url}&prefetch=1` : `${url}?prefetch=1`;
  try {
    const response = await fetch(prefetchUrl, { credentials: "omit" });
    if (!response.ok) {
      self.postMessage({ id, ok: false });
      return;
    }
    const buffer = await response.arrayBuffer();
    self.postMessage({ id, ok: true, buffer }, [buffer]);
  } catch {
    self.postMessage({ id, ok: false });
  }
}
