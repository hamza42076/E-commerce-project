"use client";

import { create } from "zustand";

type WishlistState = {
  productIds: string[];
  syncFromServer: (productIds: string[]) => void;
  setSaved: (productId: string, saved: boolean) => void;
};

export const useWishlistStore = create<WishlistState>()((set) => ({
  productIds: [],

  syncFromServer: (productIds) => set({ productIds }),

  setSaved: (productId, saved) =>
    set((state) => ({
      productIds: saved
        ? state.productIds.includes(productId)
          ? state.productIds
          : [productId, ...state.productIds]
        : state.productIds.filter((id) => id !== productId),
    })),
}));
