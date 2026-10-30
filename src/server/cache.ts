import "server-only";

/**
 * A small in-process cache for the public site's database reads.
 *
 * Public pages render on request (so a change in the admin shows at once and
 * the build never needs the database), and this keeps that cheap: each read
 * is shared for up to TTL_MS, and every admin write calls `invalidateContent()`
 * which empties the cache immediately. The admin and the site run in the same
 * Node process on Hostinger, so a saved change is visible on the very next
 * page load. The TTL is only the safety net if more than one process ever
 * serves the site.
 */
const TTL_MS = 30_000;

type Entry = { at: number; value: Promise<unknown> };
type Store = { map: Map<string, Entry> };
type Global = typeof globalThis & { __wefcCache?: Store };

const g = globalThis as Global;
const store: Store = (g.__wefcCache ??= { map: new Map() });

export function cached<T>(key: string, load: () => Promise<T>, ttlMs = TTL_MS): Promise<T> {
  const hit = store.map.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;

  const value = load();
  store.map.set(key, { at: Date.now(), value });
  // A failed read must not be served from the cache for the next 30 seconds.
  value.catch(() => {
    if (store.map.get(key)?.value === value) store.map.delete(key);
  });
  return value;
}

export function invalidateContent() {
  store.map.clear();
}
