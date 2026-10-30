import { useEffect, useState } from "react";
import { isFeatureEnabled } from "@/config/features";
import { portableCreatorApi } from "@/lib/api/portableApiClient";

/** Availability is live policy, independent of a draft's immutable recipe. */
export function useEnabledTemplateDurations(
  templateId: string,
  supported: readonly number[],
) {
  const supportedKey = supported.join(",");
  const enabled = isFeatureEnabled("portableAuth");
  const [state, setState] = useState<{
    id: string;
    durations?: readonly number[];
    error?: unknown;
  } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const load = () => {
      void portableCreatorApi
        .getTemplate(templateId)
        .then((template) => {
          if (active)
            setState({
              id: templateId,
              durations:
                template.supportedDurations ??
                supportedKey.split(",").map(Number),
            });
        })
        .catch((error) => {
          if (active) setState({ id: templateId, error });
        });
    };
    load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, [templateId, enabled, supportedKey]);
  const matching = state?.id === templateId ? state : null;
  return {
    durations: supported.filter((value) =>
      (matching?.durations ?? supported).includes(value),
    ),
    ready: !enabled || Boolean(matching?.durations),
    error: matching?.error,
  };
}
