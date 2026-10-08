import type { CartLine } from "@/types";

/**
 * The cart lives in localStorage and is read through `useSyncExternalStore`,
 * which keeps the server render and the hydrated render in step and picks up
 * changes made in other tabs.
 *
 * A line is identified by product **and colour**, so two colours of the same bag
 * are two lines rather than a quantity of two.
 */

const STORAGE_KEY = "cart:v2";
/** Pre-variant carts, read once and migrated. Lines there had no colour. */
const LEGACY_KEY = "cart:v1";

const EMPTY: CartLine[] = [];

/** Cached so `getSnapshot` returns a stable reference between renders. */
let snapshot: CartLine[] | null = null;
const listeners = new Set<() => void>();

function parse(raw: string | null, legacy: boolean): CartLine[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;

    const lines = parsed.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null) return [];
      const { productId, quantity, color } = entry as Partial<CartLine>;
      if (typeof productId !== "string" || typeof quantity !== "number") return [];
      if (!Number.isFinite(quantity) || quantity < 1) return [];
      // A v1 line has no colour; treat it as "no colour chosen", which is
      // exactly how a product without variants is represented.
      const resolved = legacy ? "" : typeof color === "string" ? color : "";
      return [{ productId, color: resolved, quantity: Math.floor(quantity) }];
    });
    return lines.length > 0 ? lines : EMPTY;
  } catch {
    return EMPTY;
  }
}

function load(): CartLine[] {
  try {
    const current = window.localStorage.getItem(STORAGE_KEY);
    if (current !== null) return parse(current, false);

    // First visit since variants shipped: carry the old cart over, then write it
    // in the new shape so this only happens once.
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy === null) return EMPTY;

    const migrated = parse(legacy, true);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      window.localStorage.removeItem(LEGACY_KEY);
    } catch {
      // Migration is best-effort; the lines are still usable this session.
    }
    return migrated;
  } catch {
    // Storage can be blocked entirely in private mode.
    return EMPTY;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    snapshot = load();
    emit();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getSnapshot(): CartLine[] {
  snapshot ??= load();
  return snapshot;
}

export function getServerSnapshot(): CartLine[] {
  return EMPTY;
}

export function updateLines(updater: (current: CartLine[]) => CartLine[]): void {
  const next = updater(getSnapshot());
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota or private mode — the cart still works for this session.
  }
  emit();
}

/** `false` during SSR and the hydration pass, `true` afterwards. */
export const hydratedStore = {
  subscribe: () => () => {},
  getSnapshot: () => true,
  getServerSnapshot: () => false,
};
