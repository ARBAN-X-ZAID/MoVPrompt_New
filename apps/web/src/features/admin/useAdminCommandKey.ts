import { useRef } from "react";

/** Network retries of the same review reuse the original operation. New inputs
 * or revision fences create a new key, so an unknown response cannot duplicate
 * a template, copy or queued operation. Keys never contain customer content. */
export function useAdminCommandKey() {
  const operations = useRef(new Map<string, string>());
  return (input: unknown) => {
    const hash = JSON.stringify(input);
    let key = operations.current.get(hash);
    if (!key) {
      key = crypto.randomUUID();
      operations.current.set(hash, key);
    }
    return key;
  };
}
