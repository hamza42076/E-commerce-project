"use client";

import { useEffect } from "react";
import { useAuthStore, type AuthUser } from "@/stores/auth";
import { useCartStore } from "@/stores/cart";
import type { Product } from "@/types";

/**
 * Feeds what the server knows into the client stores on every render.
 *
 * Two things only the server can supply: the catalogue (so the cart can turn
 * stored ids into products and prices) and who the session cookie says is
 * signed in. The cookie is the authority, so this also corrects a stale user
 * left in localStorage after it expired or after another tab signed out.
 *
 * Renders nothing.
 */
export function StoreHydrator({
  catalogue,
  user,
}: {
  catalogue: Product[];
  user: AuthUser | null;
}) {
  useEffect(() => {
    useCartStore.getState().setCatalogue(catalogue);
  }, [catalogue]);

  useEffect(() => {
    useAuthStore.getState().syncFromServer(user);
    // Comparing by value: a fresh object arrives on every render, and the store
    // itself ignores a sync that changes nothing.
  }, [user?.email, user?.role, user?.name, user]);

  return null;
}
