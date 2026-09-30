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
import type { CartLine, Product } from "@/types";

export type CartEntry = {
  product: Product;
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
  addItem: (productId: string, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
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

  const addItem = useCallback(
    (productId: string, quantity = 1) => {
      const product = productsById.get(productId);
      if (!product || product.stock < 1) return;
      updateLines((current) => {
        const existing = current.find((line) => line.productId === productId);
        if (!existing) {
          return [...current, { productId, quantity: Math.min(quantity, product.stock) }];
        }
        return current.map((line) =>
          line.productId === productId
            ? { ...line, quantity: Math.min(line.quantity + quantity, product.stock) }
            : line,
        );
      });
    },
    [productsById],
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity < 1) {
        updateLines((current) => current.filter((line) => line.productId !== productId));
        return;
      }
      const stock = productsById.get(productId)?.stock ?? quantity;
      updateLines((current) =>
        current.map((line) =>
          line.productId === productId ? { ...line, quantity: Math.min(quantity, stock) } : line,
        ),
      );
    },
    [productsById],
  );

  const removeItem = useCallback((productId: string) => {
    updateLines((current) => current.filter((line) => line.productId !== productId));
  }, []);

  const clear = useCallback(() => updateLines(() => []), []);

  const entries = useMemo<CartEntry[]>(
    () =>
      lines.flatMap((line) => {
        const product = productsById.get(line.productId);
        if (!product) return [];
        return [{ product, quantity: line.quantity, lineTotal: product.price * line.quantity }];
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
