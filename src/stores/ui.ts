"use client";

import { create } from "zustand";

/**
 * Transient interface state: the cart drawer, and the toasts.
 *
 * Deliberately not persisted. A drawer that reopens itself on reload, or a
 * toast from yesterday appearing at breakfast, would both be bugs.
 */

export type Toast = {
  id: number;
  title: string;
  description?: string;
};

const TOAST_DURATION = 2600;

type UIState = {
  cartOpen: boolean;
  toasts: Toast[];

  openCart: () => void;
  closeCart: () => void;
  showToast: (title: string, description?: string) => void;
  dismissToast: (id: number) => void;
};

let nextToastId = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export const useUIStore = create<UIState>()((set, get) => ({
  cartOpen: false,
  toasts: [],

  openCart: () => set({ cartOpen: true }),
  closeCart: () => set({ cartOpen: false }),

  showToast: (title, description) => {
    const id = (nextToastId += 1);
    // At most three on screen; a burst should not bury the page.
    set({ toasts: [...get().toasts.slice(-2), { id, title, description }] });
    timers.set(
      id,
      setTimeout(() => get().dismissToast(id), TOAST_DURATION),
    );
  },

  dismissToast: (id) => {
    set({ toasts: get().toasts.filter((toast) => toast.id !== id) });
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
  },
}));

export const useCartOpen = () => useUIStore((state) => state.cartOpen);
export const useToasts = () => useUIStore((state) => state.toasts);
