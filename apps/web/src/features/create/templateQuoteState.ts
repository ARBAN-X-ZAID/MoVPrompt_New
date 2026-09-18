import type { GenerationConfiguration, GenerationQuoteResponse } from "@movprompt/contracts";

export type TemplateQuote = GenerationQuoteResponse["quote"] & { requestId?: string };

export type TemplateQuoteFailure = {
  code: string;
  message?: string;
  retryable: boolean;
  requestId?: string;
};

export type TemplateQuoteState = {
  key: string | null;
  status: "idle" | "loading" | "ready" | "unavailable" | "expired" | "changed";
  quote: TemplateQuote | null;
  retryable: boolean;
  requestId?: string;
  failure?: TemplateQuoteFailure;
};

export const idleTemplateQuoteState: TemplateQuoteState = {
  key: null,
  status: "idle",
  quote: null,
  retryable: false,
};

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** The full canonical payload is collision-free for local lifecycle identity. */
export function createTemplateQuoteKey(templateVersionId: string, configuration: GenerationConfiguration): string {
  return `${templateVersionId}:${canonicalize(configuration)}`;
}

export function beginTemplateQuote(key: string, previousKey?: string | null): TemplateQuoteState {
  return {
    key,
    status: previousKey && previousKey !== key ? "changed" : "loading",
    quote: null,
    retryable: false,
  };
}

/**
 * Configuration edits must remove the prior quote before any asynchronous
 * template lookup starts. This keeps Review and Generate fail-closed while the
 * replacement quote is loading.
 */
export function invalidateTemplateQuote(key: string): TemplateQuoteState {
  return {
    key,
    status: "loading",
    quote: null,
    retryable: false,
  };
}

export function resolveTemplateQuote(
  state: TemplateQuoteState,
  quote: TemplateQuote,
  now: Date,
): TemplateQuoteState {
  const expiresAt = new Date(quote.expiresAt);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) {
    return expireTemplateQuote(state);
  }
  return {
    ...state,
    status: "ready",
    quote,
    retryable: false,
    ...(quote.requestId ? { requestId: quote.requestId } : {}),
  };
}

export function unavailableTemplateQuote(
  state: TemplateQuoteState,
  failure: TemplateQuoteFailure,
): TemplateQuoteState {
  return {
    ...state,
    status: "unavailable",
    quote: null,
    retryable: failure.retryable,
    ...(failure.requestId ? { requestId: failure.requestId } : {}),
    failure,
  };
}

export function expireTemplateQuote(state: TemplateQuoteState): TemplateQuoteState {
  return {
    ...state,
    status: "expired",
    quote: null,
    retryable: true,
  };
}

export function quoteForGeneration(state: TemplateQuoteState, now: Date): TemplateQuote | null {
  if (state.status !== "ready" || !state.quote) return null;
  const expiresAt = new Date(state.quote.expiresAt);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) return null;
  return state.quote;
}
