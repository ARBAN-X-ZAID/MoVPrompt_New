const AUTH_RETURN_INTENT_KEY = "movprompt.auth.return-intent.v2";

type StoredAuthReturnIntent = {
  pendingGenerationId?: string;
  returnPath: string;
};

function hasBlockedAuthDestination(pathname: string): boolean {
  return ["/auth", "/reset-password", "/api/auth"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Only a decoded, root-relative in-app path may be used after authentication. */
export function safeAuthReturnPath(value: string | null | undefined, fallback = "/create"): string {
  if (!value) return fallback;
  const candidate = value.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return fallback;
  try {
    const decoded = decodeURIComponent(candidate);
    if (decoded.startsWith("//") || decoded.includes("\\")) return fallback;
    const parsed = new URL(candidate, window.location.origin);
    if (parsed.origin !== window.location.origin || hasBlockedAuthDestination(parsed.pathname)) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function parseStoredIntent(value: string | null): StoredAuthReturnIntent | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || typeof (parsed as StoredAuthReturnIntent).returnPath !== "string") {
      return null;
    }
    const intent = parsed as StoredAuthReturnIntent;
    return {
      returnPath: safeAuthReturnPath(intent.returnPath),
      ...(typeof intent.pendingGenerationId === "string" ? { pendingGenerationId: intent.pendingGenerationId } : {}),
    };
  } catch {
    // Upgrade legacy v1 values without trusting them more than any other input.
    return { returnPath: safeAuthReturnPath(value) };
  }
}

export function rememberAuthReturnIntent(path: string, pendingGenerationId?: string): string {
  const safePath = safeAuthReturnPath(path);
  const intent: StoredAuthReturnIntent = {
    returnPath: safePath,
    ...(pendingGenerationId?.trim() ? { pendingGenerationId } : {}),
  };
  try {
    sessionStorage.setItem(AUTH_RETURN_INTENT_KEY, JSON.stringify(intent));
  } catch {
    // Redirect still carries the callback URL; storage is recovery only.
  }
  return safePath;
}

export function readAuthReturnIntent(fallback = "/create"): string {
  try {
    return parseStoredIntent(sessionStorage.getItem(AUTH_RETURN_INTENT_KEY))?.returnPath ?? fallback;
  } catch {
    return fallback;
  }
}

/** Pending intent is local-only and always wins over any callback query parameter. */
export function resolveAuthReturnPath(next: string | null | undefined, fallback = "/create"): string {
  try {
    const intent = parseStoredIntent(sessionStorage.getItem(AUTH_RETURN_INTENT_KEY));
    if (intent?.pendingGenerationId) return intent.returnPath;
  } catch {
    // A privacy-restricted browser can still use the safe callback path below.
  }
  return safeAuthReturnPath(next, fallback);
}

export function consumeAuthReturnIntent(fallback = "/create"): string {
  const path = readAuthReturnIntent(fallback);
  try {
    sessionStorage.removeItem(AUTH_RETURN_INTENT_KEY);
  } catch {
    // Non-fatal in privacy-restricted browsers.
  }
  return path;
}

export function authCallbackUrl(path: string, pendingGenerationId?: string): string {
  const safePath = rememberAuthReturnIntent(path, pendingGenerationId);
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", safePath);
  return callback.toString();
}
