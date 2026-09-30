"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TextField, TextAreaField } from "@/components/form/TextField";
import { useCart } from "@/context/CartContext";
import { useUI } from "@/context/UIContext";
import { formatPrice } from "@/lib/format";
import { deliveryFeeFor } from "@/lib/shipping";
import { checkoutSchema, type CheckoutValues } from "@/lib/validation";
import { placeOrderAction } from "@/lib/orders/actions";

export default function CheckoutPage() {
  const { ready, entries, lines, subtotal, clear } = useCart();
  const { showToast } = useUI();
  const [placed, setPlaced] = useState<{ reference: string; total: number } | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    mode: "onBlur",
    defaultValues: { fullName: "", email: "", phone: "", address: "", city: "", notes: "" },
  });

  async function onSubmit(values: CheckoutValues) {
    const result = await placeOrderAction(values, lines);

    if (!result.ok) {
      setError("root", { message: result.message });
      return;
    }

    setPlaced({ reference: result.reference, total: result.total });
    clear();
    showToast("Order placed", `Reference ${result.reference}`);
  }

  if (placed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
          <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden="true">
            <path
              d="M5 12.5l4.2 4.2L19 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Order placed</h1>
        <p className="mt-2 text-muted">
          Your reference is <span className="font-mono font-medium text-ink">{placed.reference}</span>.
          We will call to confirm before dispatch.
        </p>
        <p className="mt-1 text-muted">
          Total due on delivery: <span className="font-medium text-ink">{formatPrice(placed.total)}</span>
        </p>
        <Link
          href="/products"
          className="mt-7 inline-block rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-medium text-white transition hover:bg-brand-700 active:scale-[0.98]"
        >
          Keep shopping
        </Link>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="skeleton h-9 w-40 rounded-lg" aria-hidden="true" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="skeleton h-96 rounded-2xl" aria-hidden="true" />
          <div className="skeleton h-64 rounded-2xl" aria-hidden="true" />
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Nothing to check out</h1>
        <p className="mt-2 text-muted">Your cart is empty.</p>
        <Link
          href="/products"
          className="mt-7 inline-block rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          Browse the shop
        </Link>
      </div>
    );
  }

  const delivery = deliveryFeeFor(subtotal);
  const total = subtotal + delivery;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
      <p className="mt-1 text-sm text-muted">Cash on delivery. We confirm by phone first.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_21rem]">
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-4 rounded-2xl border border-line bg-surface-raised p-5"
        >
          {errors.root?.message && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              {errors.root.message}
            </p>
          )}

          <TextField
            label="Full name"
            autoComplete="name"
            placeholder="Ayesha Khan"
            error={errors.fullName?.message}
            {...register("fullName")}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register("email")}
            />
            <TextField
              label="Phone"
              type="tel"
              autoComplete="tel"
              placeholder="03001234567"
              error={errors.phone?.message}
              {...register("phone")}
            />
          </div>

          <TextAreaField
            label="Delivery address"
            autoComplete="street-address"
            placeholder="House, street, area"
            error={errors.address?.message}
            {...register("address")}
          />

          <TextField
            label="City"
            autoComplete="address-level2"
            placeholder="Lahore"
            error={errors.city?.message}
            {...register("city")}
          />

          <TextAreaField
            label="Notes (optional)"
            placeholder="Landmark, preferred delivery time, anything else"
            error={errors.notes?.message}
            {...register("notes")}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-brand-600 px-4 py-3.5 text-sm font-medium text-white transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60 disabled:active:scale-100"
          >
            {isSubmitting ? "Placing order..." : `Place order · ${formatPrice(total)}`}
          </button>
        </form>

        <aside className="h-fit rounded-2xl border border-line bg-surface-raised p-5 lg:sticky lg:top-24">
          <h2 className="font-semibold">Your order</h2>

          <ul className="mt-4 space-y-3 text-sm">
            {entries.map(({ product, quantity, lineTotal }) => (
              <li key={product.id} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="line-clamp-2">{product.name}</span>
                  <span className="text-muted"> x{quantity}</span>
                </span>
                <span className="shrink-0 tabular-nums">{formatPrice(lineTotal)}</span>
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Delivery</dt>
              <dd className="tabular-nums">
                {delivery === 0 ? (
                  <span className="font-medium text-brand-600 dark:text-brand-400">Free</span>
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

          <Link
            href="/cart"
            className="mt-4 block text-center text-sm font-medium text-brand-600 transition hover:text-brand-700"
          >
            Edit cart
          </Link>
        </aside>
      </div>
    </div>
  );
}
