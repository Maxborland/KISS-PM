type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

export function createCapacityCache<T>(ttlMs: number, maxEntries = 32) {
  const store = new Map<string, CacheEntry<T>>();

  return {
    get(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key: string, value: T) {
      if (store.size >= maxEntries) {
        const firstKey = store.keys().next().value;
        if (firstKey) store.delete(firstKey);
      }
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
    invalidateTenant(tenantId: string) {
      for (const key of store.keys()) {
        if (key.startsWith(`${tenantId}:`)) store.delete(key);
      }
    },
    clear() {
      store.clear();
    }
  };
}
