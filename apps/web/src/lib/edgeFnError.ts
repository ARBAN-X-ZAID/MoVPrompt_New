// Helper to extract a meaningful error message from a Supabase Functions invoke() failure.
// The SDK's `error` object hides the JSON `{error: "..."}` body inside `error.context.body`
// (a Response object). We read it and surface the real server message.

export type ParsedFnError = {
  status?: number;
  serverMessage?: string;
};

export async function parseEdgeFnError(error: unknown): Promise<ParsedFnError> {
  if (!error || typeof error !== "object") return {};
  const err = error as { context?: Response | { status?: number; body?: unknown }; status?: number; message?: string };
  const ctx = err.context;
  let status: number | undefined = err.status;
  let serverMessage: string | undefined;

  if (ctx instanceof Response) {
    status = ctx.status;
    try {
      const cloned = ctx.clone();
      const text = await cloned.text();
      try {
        const json = JSON.parse(text);
        serverMessage = json?.error ?? json?.message;
      } catch {
        if (text) serverMessage = text;
      }
    } catch {
      // ignore
    }
  } else if (ctx && typeof ctx === "object") {
    status = (ctx as { status?: number }).status ?? status;
    const body = (ctx as { body?: unknown }).body;
    if (typeof body === "string") {
      try {
        const json = JSON.parse(body);
        serverMessage = json?.error ?? json?.message;
      } catch {
        serverMessage = body;
      }
    } else if (body && typeof body === "object") {
      serverMessage = (body as { error?: string; message?: string }).error
        ?? (body as { error?: string; message?: string }).message;
    }
  }

  if (!serverMessage && err.message) serverMessage = err.message;
  return { status, serverMessage };
}

/** Map status + server message to a translation key. Caller resolves the key. */
export function pickErrorKey(parsed: ParsedFnError): string {
  if (parsed.status === 429) return "errors.aiRateLimit";
  if (parsed.status === 402) return "errors.aiCreditsExhausted";
  if (parsed.status === 504 || parsed.status === 408) return "errors.aiTimeout";
  if (parsed.status === 503 || parsed.status === 502 || parsed.status === 500) return "errors.aiServiceUnavailable";
  return "errors.aiUnknown";
}
