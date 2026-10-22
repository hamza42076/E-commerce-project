"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { cartLineKey, findVariant, variantList } from "@/lib/products/variants";
import type { CartLine, Product, ProductVariant } from "@/types";

/**
 * The cart, kept in localStorage.
 *
 * A line is identified by product **and colour**, so two colours of the same
 * bag are two lines rather than a quantity of two.
 *
 * Only `{ productId, color, quantity }` is stored. Names, prices and stock are
 * read from the catalogue the server sends on every request, so a price change
 * or a colour being withdrawn shows up immediately instead of a stale copy
 * living on in somebody's browser.
 */

export type CartEntry = {
  product: Product;
  /** The colour's variant, or the synthetic one for a product without colours. */
  variant: ProductVariant;
  /** Empty string when the product has no colour choice. */
  color: string;
  quantity: number;
  lineTotal: number;
};

type CartState = {
  lines: CartLine[];
  checkoutKey: string | null;
  /** The server-rendered catalogue, used to resolve lines into products. */
  catalogue: Product[];
  /** False until localStorage has been read, so the UI can show a skeleton. */
  hydrated: boolean;

  setCatalogue: (catalogue: Product[]) => void;
  addItem: (productId: string, color: string, quantity?: number) => void;
  setQuantity: (productId: string, color: string, quantity: number) => void;
  removeItem: (productId: string, color: string) => void;
  clear: () => void;
  getOrCreateCheckoutKey: () => string;
};

/** Stock for one colour — never the product total, which would oversell. */
function stockFor(catalogue: Product[], productId: string, color: string): number {
  const product = catalogue.find((entry) => entry.id === productId);
  if (!product) return 0;
  return findVariant(product, color)?.stock ?? 0;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      checkoutKey: null,
      catalogue: [],
      hydrated: false,

      setCatalogue: (catalogue) => set({ catalogue }),

      addItem: (productId, color, quantity = 1) => {
        const stock = stockFor(get().catalogue, productId, color);
        if (stock < 1) return;

        const key = cartLineKey(productId, color);
        const lines = get().lines;
        const existing = lines.find((line) => cartLineKey(line.productId, line.color) === key);

        set({
          lines: existing
            ? lines.map((line) =>
                cartLineKey(line.productId, line.color) === key
                  ? { ...line, quantity: Math.min(line.quantity + quantity, stock) }
                  : line,
              )
            : [...lines, { productId, color, quantity: Math.min(quantity, stock) }],
          checkoutKey: null,
        });
      },

      setQuantity: (productId, color, quantity) => {
        const key = cartLineKey(productId, color);

        if (quantity < 1) {
          set({
            lines: get().lines.filter(
              (line) => cartLineKey(line.productId, line.color) !== key,
            ),
            checkoutKey: null,
          });
          return;
        }

        const stock = stockFor(get().catalogue, productId, color);
        set({
          lines: get().lines.map((line) =>
            cartLineKey(line.productId, line.color) === key
              ? { ...line, quantity: Math.min(quantity, stock || quantity) }
              : line,
          ),
          checkoutKey: null,
        });
      },

      removeItem: (productId, color) => {
        const key = cartLineKey(productId, color);
        set({
          lines: get().lines.filter((line) => cartLineKey(line.productId, line.color) !== key),
          checkoutKey: null,
        });
      },

      clear: () => set({ lines: [], checkoutKey: null }),

      getOrCreateCheckoutKey: () => {
        const existing = get().checkoutKey;
        if (existing) return existing;
        const key = globalThis.crypto.randomUUID();
        set({ checkoutKey: key });
        return key;
      },
    }),
    {
      name: "smartshop-cart",
      storage: createJSONStorage(() => localStorage),
      // The catalogue comes from the server on every request and `hydrated`
      // describes this tab; neither belongs in storage.
      partialize: (state) => ({ lines: state.lines, checkoutKey: state.checkoutKey }),
    },
  ),
);

// Deliberately out here rather than in `onRehydrateStorage`: that callback runs
// *during* create(), when `useCartStore` is still in its temporal dead zone, so
// anything touching the store from inside it silently does nothing. localStorage
// is synchronous, so by this line persist has already restored `lines`.
if (typeof window !== "undefined") {
  migrateOldCart();
  useCartStore.setState({ hydrated: true });
}

/**
 * Carries over a cart written before this store existed.
 *
 * Two earlier shapes: `cart:v1` had no colour, `cart:v2` had one. Both held the
 * same array this store keeps under `lines`, so they are read once, merged in,
 * and removed. Somebody who left a bag in their cart last week still finds it
 * there.
 */
function migrateOldCart(): void {
  // Newest shape first: somebody with both only wants the later one.
  const sources = [
    ["cart:v2", true],
    ["cart:v1", false],
  ] as const;

  // Nothing to carry over if this cart already has something in it. The old
  // keys are still cleared below — left in place they would come back the next
  // time somebody emptied their cart, which looks like items reappearing on
  // their own.
  let wanted = useCartStore.getState().lines.length === 0;

  for (const [key, hasColor] of sources) {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      return; // Storage blocked entirely; nothing to read or clear.
    }

    if (raw && wanted) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const lines = parsed.flatMap((entry) => {
            if (typeof entry !== "object" || entry === null) return [];
            const { productId, quantity, color } = entry as Partial<CartLine>;
            if (typeof productId !== "string" || typeof quantity !== "number") return [];
            if (!Number.isFinite(quantity) || quantity < 1) return [];
            return [
              {
                productId,
                color: hasColor && typeof color === "string" ? color : "",
                quantity: Math.floor(quantity),
              },
            ];
          });
          if (lines.length > 0) {
            useCartStore.setState({ lines });
            wanted = false;
          }
        }
      } catch {
        // Unreadable leftovers are not worth rescuing.
      }
    }

    try {
      window.localStorage.removeItem(key);
    } catch {
      // Best effort.
    }
  }
}

/** Cart lines with their product and colour resolved. */
export function useCartEntries(): CartEntry[] {
  const lines = useCartStore((state) => state.lines);
  const catalogue = useCartStore((state) => state.catalogue);

  const byId = new Map(catalogue.map((product) => [product.id, product]));

  return lines.flatMap((line) => {
    const product = byId.get(line.productId);
    if (!product) return [];

    // A colour the admin has since removed leaves the line unresolvable.
    // Dropping it beats showing a price for something unbuyable.
    const variant =
      findVariant(product, line.color) ??
      (product.variants.length === 0 ? variantList(product)[0] : null);
    if (!variant) return [];

    return [
      {
        product,
        variant,
        color: line.color,
        quantity: line.quantity,
        lineTotal: product.price * line.quantity,
      },
    ];
  });
}

export function useCartCount(): number {
  const entries = useCartEntries();
  return entries.reduce((sum, entry) => sum + entry.quantity, 0);
}

export function useCartSubtotal(): number {
  const entries = useCartEntries();
  return entries.reduce((sum, entry) => sum + entry.lineTotal, 0);
}
