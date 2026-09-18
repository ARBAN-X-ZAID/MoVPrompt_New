// Local persistence for in-progress Director chat state.
// Mirrors the bubbles/input/attachments so a page reload restores instantly,
// without waiting on the Supabase round-trip. Server remains source of truth.

import type { Attachment } from "./ingest";

const VERSION = 1;
const PREFIX = `director:state:v${VERSION}`;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_BYTES = 1_000_000; // ~1 MB hard cap

export type LocalBubble = any; // Bubble union lives in DirectorChat.tsx; keep loose here

export type LocalState = {
  v: number;
  savedAt: number;
  sessionId: string | null;
  bubbles: LocalBubble[];
  input: string;
  attachments: Attachment[];
};

const hasStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const scopeKey = (userId: string | null | undefined, scope: string) =>
  `${PREFIX}:${userId ?? "anon"}:${scope}`;

// Strip ephemeral blob: URLs that won't survive a reload, and mark the
// attachment so the UI can hint the user to re-upload if needed.
const sanitizeAttachment = (a: Attachment): Attachment => {
  const url = (a as any).url as string | undefined;
  if (url && url.startsWith("blob:")) {
    return { ...a, url: undefined, _ephemeral: true } as any;
  }
  return a;
};

export function save(
  userId: string | null | undefined,
  scope: string,
  state: Omit<LocalState, "v" | "savedAt">,
): void {
  if (!hasStorage()) return;
  try {
    const sanitized: LocalState = {
      v: VERSION,
      savedAt: Date.now(),
      sessionId: state.sessionId,
      input: state.input ?? "",
      bubbles: state.bubbles ?? [],
      attachments: (state.attachments ?? []).map(sanitizeAttachment),
    };
    let payload = JSON.stringify(sanitized);
    // Truncate oldest bubbles if payload is huge
    while (payload.length > MAX_BYTES && sanitized.bubbles.length > 2) {
      sanitized.bubbles.splice(0, 1);
      payload = JSON.stringify(sanitized);
    }
    if (payload.length > MAX_BYTES) return; // give up rather than throw
    window.localStorage.setItem(scopeKey(userId, scope), payload);
  } catch {
    // QuotaExceeded or serialization errors are silently ignored
  }
}

export function load(
  userId: string | null | undefined,
  scope: string,
): LocalState | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(scopeKey(userId, scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalState;
    if (!parsed || parsed.v !== VERSION) {
      window.localStorage.removeItem(scopeKey(userId, scope));
      return null;
    }
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(scopeKey(userId, scope));
      return null;
    }
    return parsed;
  } catch {
    try {
      window.localStorage.removeItem(scopeKey(userId, scope));
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function clear(
  userId: string | null | undefined,
  scope: string,
): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(scopeKey(userId, scope));
  } catch {
    /* ignore */
  }
}

// Move the "new" draft to its newly-minted session id after first persist.
export function migrate(
  userId: string | null | undefined,
  fromScope: string,
  toScope: string,
): void {
  if (!hasStorage()) return;
  try {
    const raw = window.localStorage.getItem(scopeKey(userId, fromScope));
    if (!raw) return;
    window.localStorage.setItem(scopeKey(userId, toScope), raw);
    window.localStorage.removeItem(scopeKey(userId, fromScope));
  } catch {
    /* ignore */
  }
}

// Clear every Director draft for a given user (e.g. on sign-out).
export function clearAllForUser(userId: string | null | undefined): void {
  if (!hasStorage()) return;
  try {
    const prefix = `${PREFIX}:${userId ?? "anon"}:`;
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) toRemove.push(k);
    }
    toRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
