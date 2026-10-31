/**
 * Short in-process cache for expensive aggregate reads. Concurrent callers share
 * one load, and a failed or rejected load is never kept. Never store identity,
 * sessions or anything per-customer here: entries are shared across requests.
 */
export function createTtlCache<K, V>(
  ttlMs: number,
  options: { keep?: (value: V) => boolean; now?: () => number } = {},
) {
  const now = options.now ?? Date.now;
  const entries = new Map<K, { expiresAt: number; value: Promise<V> }>();
  return function read(key: K, load: () => Promise<V>): Promise<V> {
    const existing = entries.get(key);
    if (existing && existing.expiresAt > now()) return existing.value;
    for (const [other, entry] of entries)
      if (entry.expiresAt <= now()) entries.delete(other);
    const value = load();
    const entry = { expiresAt: now() + ttlMs, value };
    entries.set(key, entry);
    const discard = () => {
      if (entries.get(key) === entry) entries.delete(key);
    };
    value.then((result) => {
      if (options.keep && !options.keep(result)) discard();
    }, discard);
    return value;
  };
}
