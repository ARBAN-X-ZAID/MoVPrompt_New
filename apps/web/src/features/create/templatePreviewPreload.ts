const ready = new Map<string, string>();
const waiting = new Map<string, Array<(url: string | null) => void>>();
const queued: string[] = [];
let active = 0;
let nextId = 0;
const inflight = new Map<number, string>();
const dropped = new Set<number>();

type PreviewWorker = {
  postMessage(message: { type: "load"; id: number; url: string } | { type: "abort"; id: number }): void;
  onmessage: ((event: MessageEvent<{ id: number; ok: boolean; aborted?: boolean; buffer?: ArrayBuffer }>) => void) | null;
};

let worker: PreviewWorker | null = null;
const sent: string[] = [];

function previewWorker(): PreviewWorker | null {
  if (worker) return worker;
  if (typeof Worker === "undefined") return null;
  const created = new Worker(new URL("./templatePreviewPreload.worker.ts", import.meta.url), { type: "module" });
  created.onmessage = (event: MessageEvent<{ id: number; ok: boolean; aborted?: boolean; buffer?: ArrayBuffer }>) => {
    const url = inflight.get(event.data.id);
    const ignored = dropped.has(event.data.id);
    inflight.delete(event.data.id);
    dropped.delete(event.data.id);
    if (!ignored) active = Math.max(0, active - 1);
    if (ignored || event.data.aborted) {
      if (url && !ready.has(url) && !queued.includes(url)) queued.push(url);
      pump();
      return;
    }
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
    if (!url || ready.has(url) || [...inflight.values()].includes(url)) continue;
    const id = nextId++;
    inflight.set(id, url);
    active += 1;
    sent.push(url);
    current.postMessage({ type: "load", id, url });
  }
}

function enqueue(url: string, priority: boolean) {
  const existing = queued.indexOf(url);
  if (existing >= 0) queued.splice(existing, 1);
  if (priority) queued.unshift(url);
  else queued.push(url);
}

/** Download an approved template demo off the main thread. */
export function preloadTemplatePreview(url: string | null | undefined, options?: { priority?: boolean }) {
  if (!url || ready.has(url)) return;
  const priority = options?.priority === true;
  const current = previewWorker();
  if (priority && current) {
    for (const [id, inflightUrl] of [...inflight.entries()]) {
      if (inflightUrl === url) continue;
      dropped.add(id);
      inflight.delete(id);
      active = Math.max(0, active - 1);
      current.postMessage({ type: "abort", id });
      if (!queued.includes(inflightUrl)) queued.push(inflightUrl);
    }
  }
  if ([...inflight.values()].includes(url)) return;
  enqueue(url, priority);
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

/** Test-only view of the order downloads were started. */
export function previewDownloadOrder() {
  return [...sent];
}

export function resetPreviewDownloadsForTests() {
  ready.clear();
  waiting.clear();
  queued.length = 0;
  inflight.clear();
  dropped.clear();
  sent.length = 0;
  active = 0;
  nextId = 0;
  worker = null;
}
