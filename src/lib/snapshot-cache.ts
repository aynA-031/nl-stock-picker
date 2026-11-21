import type { MarketBundle } from "./fuyao";

interface CacheEntry {
  bundle: MarketBundle;
  createdAt: number;
}

const TTL_MS = 30 * 60 * 1000;
const store = new Map<string, CacheEntry>();

export function putSnapshot(bundle: MarketBundle): string {
  const id = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  store.set(id, { bundle, createdAt: Date.now() });
  // Soft bound memory
  if (store.size > 40) {
    const oldest = [...store.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
    if (oldest) store.delete(oldest[0]);
  }
  return id;
}

export function getSnapshot(id?: string | null): MarketBundle | null {
  if (!id) return null;
  const hit = store.get(id);
  if (!hit) return null;
  if (Date.now() - hit.createdAt > TTL_MS) {
    store.delete(id);
    return null;
  }
  return hit.bundle;
}
