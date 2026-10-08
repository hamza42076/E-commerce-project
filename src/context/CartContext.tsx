"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  getServerSnapshot,
  getSnapshot,
  hydratedStore,
  subscribe,
  updateLines,
} from "@/lib/cart-store";
import { cartLineKey, findVariant, variantList } from "@/lib/products/variants";
import type { CartLine, Product, ProductVariant } from "@/types";

/** A cart line with its product and colour resolved. */
export type CartEntry = {
  product: Product;
  /** The colour's variant, or the synthetic one for a product without colours. */
  variant: ProductVariant;
  /** Empty string when the product has no colour choice. */
  color: string;
  quantity: number;
  lineTotal: number;
};

type CartContextValue = {
  /** False during SSR and hydration, so the UI can show a skeleton instead of a flash. */
  ready: boolean;
  lines: CartLine[];
  entries: CartEntry[];
  itemCount: number;
  subtotal: number;
  addItem: (productId: string, color: string, quantity?: number) => void;
  setQuantity: (productId: string, color: string, quantity: number) => void;
  removeItem: (productId: string, color: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  catalogue,
  children,
}: {
  /** Full product list, fetched on the server so the cart can resolve stored ids. */
  catalogue: Product[];
  children: ReactNode;
}) {
  const lines = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(
    hydratedStore.subscribe,
    hydratedStore.getSnapshot,
    hydratedStore.getServerSnapshot,
  );

  const productsById = useMemo(
    () => new Map(catalogue.map((product) => [product.id, product])),
    [catalogue],
  );

  /** Stock for one colour — never the product total, which would oversell. */
  const stockFor = useCallback(
    (productId: string, color: string): number => {
      const product = productsById.get(productId);
      if (!product) return 0;
      return findVariant(product, color)?.stock ?? 0;
    },
    [productsById],
  );

  const addItem = useCallback(
    (productId: string, color: string, quantity = 1) => {
      const stock = stockFor(productId, color);
      if (stock < 1) return;

      updateLines((current) => {
        const key = cartLineKey(productId, color);
        const existing = current.find(
          (line) => cartLineKey(line.productId, line.color) === key,
        );
        if (!existing) {
          return [...current, { productId, color, quantity: Math.min(quantity, stock) }];
        }
        return current.map((line) =>
          cartLineKey(line.productId, line.color) === key
            ? { ...line, quantity: Math.min(line.quantity + quantity, stock) }
            : line,
        );
      });
    },
    [stockFor],
  );

  const setQuantity = useCallback(
    (productId: string, color: string, quantity: number) => {
      const key = cartLineKey(productId, color);

      if (quantity < 1) {
        updateLines((current) =>
          current.filter((line) => cartLineKey(line.productId, line.color) !== key),
        );
        return;
      }

      const stock = stockFor(productId, color);
      updateLines((current) =>
        current.map((line) =>
          cartLineKey(line.productId, line.color) === key
            ? { ...line, quantity: Math.min(quantity, stock || quantity) }
            : line,
        ),
      );
    },
    [stockFor],
  );

  const removeItem = useCallback((productId: string, color: string) => {
    const key = cartLineKey(productId, color);
    updateLines((current) =>
      current.filter((line) => cartLineKey(line.productId, line.color) !== key),
    );
  }, []);

  const clear = useCallback(() => updateLines(() => []), []);

  const entries = useMemo<CartEntry[]>(
    () =>
      lines.flatMap((line) => {
        const product = productsById.get(line.productId);
        if (!product) return [];

        // A colour the admin has since removed leaves the line unresolvable.
        // Dropping it is better than showing a price for something unbuyable.
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
      }),
    [lines, productsById],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      ready,
      lines,
      entries,
      itemCount: entries.reduce((sum, entry) => sum + entry.quantity, 0),
      subtotal: entries.reduce((sum, entry) => sum + entry.lineTotal, 0),
      addItem,
      setQuantity,
      removeItem,
      clear,
    }),
    [ready, lines, entries, addItem, setQuantity, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside a <CartProvider>");
  return context;
}
