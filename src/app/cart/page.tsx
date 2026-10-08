"use client";

import Link from "next/link";
import { ProductImage } from "@/components/ProductImage";
import { QuantityStepper } from "@/components/QuantityStepper";
import { useCart } from "@/context/CartContext";
import { formatPrice } from "@/lib/format";
import { DELIVERY_FEE, FREE_DELIVERY_THRESHOLD, deliveryFeeFor } from "@/lib/shipping";

export default function CartPage() {
  const { ready, entries, subtotal, itemCount, setQuantity, removeItem, clear } = useCart();

  if (!ready) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="skeleton h-9 w-40 rounded-lg" aria-hidden="true" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-28 rounded-2xl" aria-hidden="true" />
            ))}
          </div>
          <div className="skeleton h-64 rounded-2xl" aria-hidden="true" />
        </div>
        <span className="sr-only">Loading your cart</span>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-surface-sunken text-subtle">
          <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden="true">
            <path
              d="M3 4h2l2.4 11.2a2 2 0 002 1.6h7.7a2 2 0 002-1.6L21 8H6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Your cart is empty</h1>
        <p className="mt-2 text-muted">Nothing in here yet. Have a look at what is in stock.</p>
        <Link
          href="/products"
          className="mt-7 inline-block rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-medium text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 active:scale-[0.98]"
        >
          Browse the shop
        </Link>
      </div>
    );
  }

  const delivery = deliveryFeeFor(subtotal);
  const total = subtotal + delivery;
  const remaining = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Cart <span className="text-subtle">({itemCount})</span>
        </h1>
        <button
          type="button"
          onClick={clear}
          className="text-sm text-muted underline-offset-4 transition hover:text-rose-600 hover:underline"
        >
          Clear cart
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_21rem]">
        <ul className="space-y-4">
          {entries.map(({ product, variant, color, quantity, lineTotal }) => (
            <li
              // Product and colour together, so two colours of one bag are two
              // rows rather than one with a quantity of two.
              key={`${product.id}::${color}`}
              className="flex gap-4 rounded-2xl border border-line bg-surface-raised p-4 transition hover:border-brand-200"
            >
              <Link
                href={`/products/${product.slug}`}
                className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-line"
              >
                <ProductImage
                  product={product}
                  src={variant.image}
                  alt={color ? `${product.name} in ${color}` : product.name}
                  iconClass="h-2/5 w-2/5"
                />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/products/${product.slug}`}
                      className="line-clamp-2 font-medium transition hover:text-brand-600"
                    >
                      {product.name}
                    </Link>
                    {color && (
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                        <span
                          className="h-3 w-3 rounded-full border border-black/15 dark:border-white/20"
                          style={{ backgroundColor: variant.colorCode || "#d4d4d8" }}
                        />
                        {color}
                      </p>
                    )}
                    <p className="mt-0.5 text-sm text-muted">
                      {formatPrice(product.price)} each
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">{formatPrice(lineTotal)}</p>
                </div>

                <div className="mt-auto flex items-center gap-4">
                  <QuantityStepper
                    value={quantity}
                    max={variant.stock}
                    onChange={(next) => setQuantity(product.id, color, next)}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(product.id, color)}
                    className="text-sm text-muted underline-offset-4 transition hover:text-rose-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-2xl border border-line bg-surface-raised p-5 lg:sticky lg:top-24">
          <h2 className="font-semibold">Order summary</h2>

          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Delivery</dt>
              <dd className="tabular-nums">
                {delivery === 0 ? (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Free</span>
                ) : (
                  formatPrice(delivery)
                )}
              </dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatPrice(total)}</dd>
            </div>
          </dl>

          {remaining > 0 && (
            <div className="mt-4 rounded-xl bg-surface-sunken p-3">
              <p className="text-xs text-muted">
                Add <span className="font-medium text-ink">{formatPrice(remaining)}</span> more to
                skip the {formatPrice(DELIVERY_FEE)} delivery fee.
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-brand-500 transition-[width] duration-500"
                  style={{ width: `${Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100)}%` }}
                />
              </div>
            </div>
          )}

          <Link
            href="/checkout"
            className="mt-5 block rounded-xl bg-brand-600 px-4 py-3.5 text-center text-sm font-medium text-white transition hover:bg-brand-700 active:scale-[0.99]"
          >
            Checkout
          </Link>
          <p className="mt-2 text-center text-xs text-subtle">Cash on delivery</p>

          <Link
            href="/products"
            className="mt-4 block text-center text-sm font-medium text-brand-600 transition hover:text-brand-700"
          >
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
