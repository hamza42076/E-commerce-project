"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { removeFromWishlist, saveToWishlist } from "@/lib/wishlist/actions";
import { useAuthUser } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { useWishlistStore } from "@/stores/wishlist";

export function WishlistButton({
  productId,
  productName,
  className = "",
  label,
}: {
  productId: string;
  productName: string;
  className?: string;
  label?: string;
}) {
  const user = useAuthUser();
  const saved = useWishlistStore((state) => state.productIds.includes(productId));
  const setSaved = useWishlistStore((state) => state.setSaved);
  const showToast = useUIStore((state) => state.showToast);
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggleWishlist() {
    if (!user) {
      const back = window.location.pathname + window.location.search;
      showToast("Sign in to save products", "You will return to this page after signing in");
      router.push(`/login?next=${encodeURIComponent(back)}`);
      return;
    }

    setPending(true);
    try {
      if (saved) {
        await removeFromWishlist(productId);
        setSaved(productId, false);
        showToast("Removed from wishlist", productName);
      } else {
        await saveToWishlist(productId);
        setSaved(productId, true);
        showToast("Saved to wishlist", productName);
      }
      router.refresh();
    } catch (error) {
      console.error("Could not update wishlist:", error);
      showToast("Wishlist update failed", "Please try again.");
    } finally {
      setPending(false);
    }
  }

  const action = saved ? "Remove from" : "Add to";

  return (
    <button
      type="button"
      onClick={toggleWishlist}
      disabled={pending}
      aria-label={`${action} wishlist: ${productName}`}
      aria-pressed={saved}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-line bg-surface-raised/95 p-2.5 text-muted shadow-sm transition hover:border-rose-300 hover:text-rose-600 disabled:cursor-wait disabled:opacity-60 ${
        saved ? "text-rose-600 dark:text-rose-400" : ""
      } ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label && <span className="text-sm font-medium">{saved ? "Saved" : label}</span>}
    </button>
  );
}
