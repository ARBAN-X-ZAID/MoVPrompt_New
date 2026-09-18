// Lightweight in-memory ring buffers for console logs and network requests.
// Used by the "Send debug report" button to give us reproducible context.

type LogLevel = "log" | "info" | "warn" | "error" | "debug";
export type LogEntry = {
  t: string;
  level: LogLevel;
  msg: string;
};

export type NetEntry = {
  t: string;
  method: string;
  url: string;
  status?: number;
  durationMs?: number;
  error?: string;
};

const MAX_LOGS = 200;
const MAX_NET = 100;

const logs: LogEntry[] = [];
const net: NetEntry[] = [];

function pushLog(entry: LogEntry) {
  logs.push(entry);
  if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
}

function pushNet(entry: NetEntry) {
  net.push(entry);
  if (net.length > MAX_NET) net.splice(0, net.length - MAX_NET);
}

function stringifyArg(a: unknown): string {
  if (a instanceof Error) return `${a.name}: ${a.message}`;
  if (typeof a === "string") return a;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

let installed = false;

export function installDebugRecorder() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  (["log", "info", "warn", "error", "debug"] as LogLevel[]).forEach((level) => {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      try {
        pushLog({
          t: new Date().toISOString(),
          level,
          msg: args.map(stringifyArg).join(" ").slice(0, 2000),
        });
      } catch {
        /* ignore */
      }
      original(...args);
    };
  });

  window.addEventListener("error", (e) => {
    pushLog({
      t: new Date().toISOString(),
      level: "error",
      msg: `window.error: ${e.message} @ ${e.filename}:${e.lineno}`,
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    pushLog({
      t: new Date().toISOString(),
      level: "error",
      msg: `unhandledrejection: ${stringifyArg(e.reason)}`,
    });
  });

  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const start = performance.now();
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    try {
      const res = await origFetch(input as RequestInfo, init);
      pushNet({
        t: new Date().toISOString(),
        method,
        url,
        status: res.status,
        durationMs: Math.round(performance.now() - start),
      });
      return res;
    } catch (err: any) {
      pushNet({
        t: new Date().toISOString(),
        method,
        url,
        durationMs: Math.round(performance.now() - start),
        error: err?.message || String(err),
      });
      throw err;
    }
  };
}

export function getDebugSnapshot(extra: Record<string, unknown> = {}) {
  return {
    capturedAt: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    viewport:
      typeof window !== "undefined"
        ? { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio }
        : null,
    ...extra,
    consoleLogs: [...logs],
    networkRequests: [...net],
  };
}
