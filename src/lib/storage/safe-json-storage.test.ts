import { describe, expect, it, vi } from "vitest";
import type { StateStorage } from "zustand/middleware";
import { createSafeJSONStorage } from "./safe-json-storage";

function memoryStorage(initial: Record<string, string>): StateStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

describe("safe persisted JSON storage", () => {
  it("discards truncated persisted JSON instead of crashing hydration", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const storage = createSafeJSONStorage(() =>
      memoryStorage({ "smartshop-cart": '{"state":' }),
    );

    expect(storage?.getItem("smartshop-cart")).toBeNull();
    expect(warning).toHaveBeenCalledWith(
      '[storage] Discarding malformed persisted state for "smartshop-cart".',
    );
    warning.mockRestore();
  });

  it("keeps valid persisted JSON available to Zustand", () => {
    const raw = JSON.stringify({ state: { lines: [] }, version: 0 });
    const storage = createSafeJSONStorage(() => memoryStorage({ "smartshop-auth": raw }));

    expect(storage?.getItem("smartshop-auth")).toEqual({
      state: { lines: [] },
      version: 0,
    });
  });
});
