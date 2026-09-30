"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Toast = {
  id: number;
  title: string;
  description?: string;
};

type UIContextValue = {
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toasts: Toast[];
  showToast: (title: string, description?: string) => void;
  dismissToast: (id: number) => void;
};

const UIContext = createContext<UIContextValue | null>(null);

const TOAST_DURATION = 2600;

export function UIProvider({ children }: { children: ReactNode }) {
  const [cartOpen, setCartOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (title: string, description?: string) => {
      const id = (nextId.current += 1);
      setToasts((current) => [...current.slice(-2), { id, title, description }]);
      timers.current.set(
        id,
        setTimeout(() => dismissToast(id), TOAST_DURATION),
      );
    },
    [dismissToast],
  );

  // Close the drawer on Escape and stop the page behind it from scrolling.
  useEffect(() => {
    if (!cartOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCartOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [cartOpen]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const value = useMemo<UIContextValue>(
    () => ({ cartOpen, openCart, closeCart, toasts, showToast, dismissToast }),
    [cartOpen, openCart, closeCart, toasts, showToast, dismissToast],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used inside a <UIProvider>");
  return context;
}
