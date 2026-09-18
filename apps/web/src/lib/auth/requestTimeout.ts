export const AUTH_REQUEST_TIMEOUT_MS = 30_000;

export class AuthRequestTimeoutError extends Error {
  constructor(timeoutMs = AUTH_REQUEST_TIMEOUT_MS) {
    super(`Authentication request timed out after ${Math.round(timeoutMs / 1_000)} seconds.`);
    this.name = "AuthRequestTimeoutError";
  }
}

export async function withAuthRequestTimeout<T>(
  request: Promise<T>,
  timeoutMs = AUTH_REQUEST_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new AuthRequestTimeoutError(timeoutMs)), timeoutMs);
  });

  try {
    return await Promise.race([request, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function isAuthRequestTimeout(error: unknown): boolean {
  if (error instanceof AuthRequestTimeoutError) return true;
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || /timed?\s*out|timeout/i.test(error.message);
}
