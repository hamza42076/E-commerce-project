"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { useUI } from "@/context/UIContext";
import type { Product } from "@/types";

export function AddToCartButton({
  product,
  quantity = 1,
  /** Slide the cart open after adding. Used where the intent is deliberate. */
  revealCart = false,
  className = "",
}: {
  product: Product;
  quantity?: number;
  revealCart?: boolean;
  className?: string;
}) {
  const { addItem } = useCart();
  const { showToast, openCart } = useUI();
  const [justAdded, setJustAdded] = useState(false);
  const soldOut = product.stock < 1;

  function handleClick() {
    addItem(product.id, quantity);
    showToast(
      "Added to cart",
      quantity > 1 ? `${quantity} x ${product.name}` : product.name,
    );
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1400);
    if (revealCart) openCart();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={soldOut}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-subtle disabled:active:scale-100 ${
        justAdded
          ? "bg-emerald-600 text-white"
          : "bg-brand-600 text-white hover:bg-brand-700"
      } ${className}`}
    >
      {soldOut ? (
        "Sold out"
      ) : justAdded ? (
        <>
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M5 12.5l4.2 4.2L19 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Added
        </>
      ) : (
        "Add to cart"
      )}
    </button>
  );
}
