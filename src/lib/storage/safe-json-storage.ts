import { createJSONStorage, type StateStorage } from "zustand/middleware";

function validateStoredJSON(raw: string | null, key: string, storage: StateStorage): string | null {
  if (raw === null) return null;

  try {
    JSON.parse(raw);
    return raw;
  } catch {
    console.warn(`[storage] Discarding malformed persisted state for "${key}".`);
    storage.removeItem(key);
    return null;
  }
}

function browserStorage(): StateStorage {
  if (typeof window === "undefined") {
    throw new Error("Browser storage is unavailable during server rendering.");
  }
  return {
      getItem: (key) => window.localStorage.getItem(key),
      setItem: (key, value) => window.localStorage.setItem(key, value),
      removeItem: (key) => window.localStorage.removeItem(key),
  };
}

export function createSafeJSONStorage(getStorage: () => StateStorage = browserStorage) {
  return createJSONStorage(() => {
    const storage = getStorage();
    return {
      ...storage,
      getItem: (key) => {
        const raw = storage.getItem(key);
        return raw instanceof Promise
          ? raw.then((value) => validateStoredJSON(value, key, storage))
          : validateStoredJSON(raw, key, storage);
      },
    };
  });
}
