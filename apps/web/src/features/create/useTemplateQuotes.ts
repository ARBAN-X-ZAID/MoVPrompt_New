import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GenerationConfiguration } from "@movprompt/contracts";

import { PortableApiError, portableCreatorApi } from "@/lib/api/portableApiClient";
import { resolvePortableTemplateVersionId } from "./projectStore";
import {
  createTemplateQuoteKey,
  expireTemplateQuote,
  invalidateTemplateQuote,
  idleTemplateQuoteState,
  resolveTemplateQuote,
  unavailableTemplateQuote,
  type TemplateQuoteState,
} from "./templateQuoteState";

type UseTemplateQuotesInput = {
  enabled: boolean;
  templateId: string;
  configuration: GenerationConfiguration;
};

export function useTemplateQuotes(input: UseTemplateQuotesInput) {
  const [state, setState] = useState<TemplateQuoteState>(idleTemplateQuoteState);
  const [retry, setRetry] = useState(0);
  const requestVersion = useRef(0);
  const configurationRef = useRef(input.configuration);
  configurationRef.current = input.configuration;
  const configurationKey = useMemo(
    () => JSON.stringify(input.configuration),
    [input.configuration],
  );

  useEffect(() => {
    if (!input.enabled) {
      setState(idleTemplateQuoteState);
      return;
    }

    const controller = new AbortController();
    const request = ++requestVersion.current;
    const configuration = configurationRef.current;
    // Set loading before resolving the asynchronous immutable template ID.
    // A previous price is never valid for a changed price, duration or ratio.
    const pendingKey = createTemplateQuoteKey(`pending:${input.templateId}`, configuration);
    setState(invalidateTemplateQuote(pendingKey));
    let expiryTimer: number | null = null;
    void (async () => {
      try {
        const templateVersionId = await resolvePortableTemplateVersionId(input.templateId);
        if (controller.signal.aborted || request !== requestVersion.current) return;
        const key = createTemplateQuoteKey(templateVersionId, configuration);
        setState(invalidateTemplateQuote(key));
        const quote = await portableCreatorApi.generationQuote({
          templateVersionId,
          configuration,
        }, { signal: controller.signal });
        if (controller.signal.aborted || request !== requestVersion.current) return;
        setState((current) => current.key === key
          ? resolveTemplateQuote(current, quote, new Date())
          : current);
        const expiresAt = new Date(quote.expiresAt).getTime();
        const delay = expiresAt - Date.now();
        if (Number.isFinite(delay) && delay > 0) {
          expiryTimer = window.setTimeout(() => {
            if (request !== requestVersion.current) return;
            setState((current) => current.key === key ? expireTemplateQuote(current) : current);
          }, delay);
        }
      } catch (error) {
        if (controller.signal.aborted || request !== requestVersion.current) return;
        const portableError = error instanceof PortableApiError ? error : null;
        setState((current) => unavailableTemplateQuote(current, {
          code: portableError?.code ?? "pricing_unavailable",
          message: portableError?.message ?? "Could not connect to the generation service. Please retry.",
          retryable: portableError?.retryable ?? true,
          ...(portableError?.requestId ? { requestId: portableError.requestId } : {}),
        }));
      }
    })();

    return () => {
      controller.abort();
      if (expiryTimer !== null) window.clearTimeout(expiryTimer);
    };
  }, [configurationKey, input.enabled, input.templateId, retry]);

  const retryQuote = useCallback(() => setRetry((value) => value + 1), []);
  return { ...state, retry: retryQuote };
}
