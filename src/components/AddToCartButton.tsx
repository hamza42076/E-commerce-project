"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { useUI } from "@/context/UIContext";
import { useIsSignedIn } from "@/context/SessionContext";
import { findVariant } from "@/lib/products/variants";
import type { Product } from "@/types";

export function AddToCartButton({
  product,
  /** Which colour is being added. Empty string for a product without colours. */
  color,
  quantity = 1,
  /** Slide the cart open after adding. Used where the intent is deliberate. */
  revealCart = false,
  className = "",
}: {
  product: Product;
  color: string;
  quantity?: number;
  revealCart?: boolean;
  className?: string;
}) {
  const { addItem } = useCart();
  const { showToast, openCart } = useUI();
  const signedIn = useIsSignedIn();
  const router = useRouter();
  const [justAdded, setJustAdded] = useState(false);
  // This colour's stock, not the product total — a bag can be sold out in red
  // while black is still available.
  const soldOut = (findVariant(product, color)?.stock ?? 0) < 1;

  function handleClick() {
    // Shopping needs an account. The checkout action re-checks this on the
    // server; this is only so the person is not led down a dead end.
    if (!signedIn) {
      // Read at click time rather than through a hook, so no Suspense
      // boundary is needed and any active filters are preserved.
      const back = window.location.pathname + window.location.search;
      showToast("Sign in to add items", "Takes a moment, then you are back here");
      router.push(`/login?next=${encodeURIComponent(back)}`);
      return;
    }

    addItem(product.id, color, quantity);
    showToast(
      "Added to cart",
      [color, quantity > 1 ? `x${quantity}` : null].filter(Boolean).join(" ") ||
        product.name,
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
      ) : signedIn ? (
        "Add to cart"
      ) : (
        "Sign in to buy"
      )}
    </button>
  );
}
