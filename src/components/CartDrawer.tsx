"use client";

import Link from "next/link";
import { ProductImage } from "./ProductImage";
import { QuantityStepper } from "./QuantityStepper";
import { useCart } from "@/context/CartContext";
import { useUI } from "@/context/UIContext";
import { formatPrice } from "@/lib/format";
import { FREE_DELIVERY_THRESHOLD } from "@/lib/shipping";

export function CartDrawer() {
  const { cartOpen, closeCart } = useUI();
  const { entries, subtotal, itemCount, setQuantity, removeItem } = useCart();

  if (!cartOpen) return null;

  const remaining = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
  const progress = Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close cart"
        onClick={closeCart}
        className="animate-fade-in absolute inset-0 h-full w-full cursor-default bg-black/40 backdrop-blur-[2px]"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className="animate-slide-in-right absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-semibold">
            Your cart {itemCount > 0 && <span className="text-muted">({itemCount})</span>}
          </h2>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Close cart"
            className="-m-2 rounded-lg p-2 text-muted transition hover:bg-surface-sunken hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        {entries.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-sunken text-subtle">
              <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
                <path
                  d="M3 4h2l2.4 11.2a2 2 0 002 1.6h7.7a2 2 0 002-1.6L21 8H6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div>
              <p className="font-medium">Nothing in here yet</p>
              <p className="mt-1 text-sm text-muted">Add something and it shows up here.</p>
            </div>
            <Link
              href="/products"
              onClick={closeCart}
              className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Browse the shop
            </Link>
          </div>
        ) : (
          <>
            <div className="border-b border-line px-5 py-3">
              {remaining > 0 ? (
                <p className="text-xs text-muted">
                  Add <span className="font-medium text-ink">{formatPrice(remaining)}</span> more
                  for free delivery
                </p>
              ) : (
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  You have unlocked free delivery
                </p>
              )}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className="h-full rounded-full bg-brand-500 transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
              {entries.map(({ product, variant, color, quantity, lineTotal }) => (
                <li key={`${product.id}::${color}`} className="flex gap-3 py-4">
                  <Link
                    href={`/products/${product.slug}`}
                    onClick={closeCart}
                    className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-line"
                  >
                    <ProductImage
                      product={product}
                      src={variant.image}
                      alt={color ? `${product.name} in ${color}` : product.name}
                      iconClass="h-2/5 w-2/5"
                    />
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/products/${product.slug}`}
                        onClick={closeCart}
                        className="line-clamp-2 text-sm font-medium leading-snug hover:text-brand-600"
                      >
                        {product.name}
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeItem(product.id, color)}
                        aria-label={`Remove ${product.name}${color ? ` in ${color}` : ""}`}
                        className="-m-1 shrink-0 rounded p-1 text-subtle transition hover:text-rose-600"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                          <path
                            d="M6 6l12 12M18 6L6 18"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>

                    {color && (
                      <p className="flex items-center gap-1.5 text-xs text-muted">
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-black/15 dark:border-white/20"
                          style={{ backgroundColor: variant.colorCode || "#d4d4d8" }}
                        />
                        {color}
                      </p>
                    )}

                    <div className="mt-auto flex items-center justify-between gap-2">
                      <QuantityStepper
                        value={quantity}
                        max={variant.stock}
                        onChange={(next) => setQuantity(product.id, color, next)}
                      />
                      <span className="text-sm font-semibold tabular-nums">
                        {formatPrice(lineTotal)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="border-t border-line px-5 py-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="text-lg font-semibold tabular-nums">{formatPrice(subtotal)}</span>
              </div>
              <p className="mt-1 text-xs text-muted">Delivery calculated at the cart.</p>
              <Link
                href="/checkout"
                onClick={closeCart}
                className="mt-4 block rounded-lg bg-brand-600 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Checkout
              </Link>
              <Link
                href="/cart"
                onClick={closeCart}
                className="mt-2 block rounded-lg border border-line px-4 py-2.5 text-center text-sm transition hover:border-brand-400 hover:text-brand-600"
              >
                View cart
              </Link>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
