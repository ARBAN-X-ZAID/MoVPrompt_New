const ready = new Map<string, string>();
const waiting = new Map<string, Array<(url: string | null) => void>>();
const queued: string[] = [];
let active = 0;
let nextId = 0;
const inflight = new Map<number, string>();

type PreviewWorker = {
  postMessage(message: { id: number; url: string }): void;
  onmessage: ((event: MessageEvent<{ id: number; ok: boolean; buffer?: ArrayBuffer }>) => void) | null;
};

let worker: PreviewWorker | null = null;

function previewWorker(): PreviewWorker | null {
  if (worker) return worker;
  if (typeof Worker === "undefined") return null;
  const created = new Worker(new URL("./templatePreviewPreload.worker.ts", import.meta.url), { type: "module" });
  created.onmessage = (event: MessageEvent<{ id: number; ok: boolean; buffer?: ArrayBuffer }>) => {
    const url = inflight.get(event.data.id);
    inflight.delete(event.data.id);
    active = Math.max(0, active - 1);
    const blobUrl = event.data.ok && event.data.buffer
      ? URL.createObjectURL(new Blob([event.data.buffer], { type: "video/mp4" }))
      : null;
    if (url && blobUrl) ready.set(url, blobUrl);
    for (const listener of waiting.get(url ?? "") ?? []) listener(blobUrl);
    waiting.delete(url ?? "");
    pump();
  };
  worker = created;
  return created;
}

function pump() {
  const current = previewWorker();
  if (!current) return;
  while (active < 2 && queued.length) {
    const url = queued.shift();
    if (!url || ready.has(url)) continue;
    const id = nextId++;
    inflight.set(id, url);
    active += 1;
    current.postMessage({ id, url });
  }
}

/** Download an approved template demo off the main thread. */
export function preloadTemplatePreview(url: string | null | undefined) {
  if (!url || ready.has(url) || queued.includes(url) || [...inflight.values()].includes(url)) return;
  queued.push(url);
  pump();
}

export function preloadedTemplatePreview(url: string | null | undefined) {
  return url ? ready.get(url) ?? null : null;
}

export function whenTemplatePreviewReady(url: string, listener: (url: string | null) => void) {
  const cached = ready.get(url);
  if (cached) {
    listener(cached);
    return () => undefined;
  }
  const listeners = waiting.get(url) ?? [];
  listeners.push(listener);
  waiting.set(url, listeners);
  return () => {
    const remaining = (waiting.get(url) ?? []).filter((item) => item !== listener);
    if (remaining.length) waiting.set(url, remaining);
    else waiting.delete(url);
  };
}
