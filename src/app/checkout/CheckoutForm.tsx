"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TextField, TextAreaField } from "@/components/form/TextField";
import { EmailField } from "@/components/form/EmailField";
import { ProductImage } from "@/components/ProductImage";
import { useCartStore, useCartEntries, useCartSubtotal } from "@/stores/cart";
import { useUIStore } from "@/stores/ui";
import { formatPrice } from "@/lib/format";
import { deliveryFeeFor } from "@/lib/shipping";
import { checkoutSchema, type CheckoutValues } from "@/lib/validation";
import { placeOrderAction } from "@/lib/orders/actions";

export type CheckoutDefaults = { fullName: string; email: string };

/**
 * Says where the confirmation is actually going, and points out when that is
 * not the address on the account.
 *
 * A mistyped address is accepted by the receiving mail server and only bounces
 * minutes later, to the shop rather than to the customer — so from the
 * customer's side the email simply never arrives, with nothing to explain it.
 * Naming the address while they can still fix it is the only point at which
 * that is cheap.
 *
 * Kept in its own component because subscribing to a field value makes React
 * Compiler skip memoising whatever does it; better one line than the form.
 */
function EmailNotice({
  control,
  accountEmail,
}: {
  control: Control<CheckoutValues>;
  accountEmail: string;
}) {
  const typed = (useWatch({ control, name: "email" }) ?? "").trim();

  if (!typed || typed.toLowerCase() === accountEmail.toLowerCase()) {
    return <p className="mt-1.5 text-xs text-muted">The confirmation goes here.</p>;
  }

  return (
    <p className="mt-1.5 text-xs text-accent-600 dark:text-accent-400">
      Confirmation goes to <span className="font-medium">{typed}</span>, not your
      account address ({accountEmail}). Check the spelling.
    </p>
  );
}

export function CheckoutForm({ defaults }: { defaults: CheckoutDefaults }) {
  const router = useRouter();
  const ready = useCartStore((s) => s.hydrated);
  const lines = useCartStore((s) => s.lines);
  const clear = useCartStore((s) => s.clear);
  const getOrCreateCheckoutKey = useCartStore((s) => s.getOrCreateCheckoutKey);
  const entries = useCartEntries();
  const subtotal = useCartSubtotal();
  const showToast = useUIStore((s) => s.showToast);

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    mode: "onBlur",
    // Name and email come from the signed-in account; the rest is per-order.
    defaultValues: {
      fullName: defaults.fullName,
      email: defaults.email,
      phone: "",
      address: "",
      city: "",
      area: "",
      province: "",
      postalCode: "",
      notes: "",
    },
  });

  async function onSubmit(values: CheckoutValues) {
    try {
      const result = await placeOrderAction(values, lines, getOrCreateCheckoutKey());
      if (!result.ok) {
        setError("root", { message: result.message });
        return;
      }

      clear();
      showToast("Order placed", `Reference ${result.reference}`);
      router.push(`/checkout/confirmation/${result.orderId}`);
    } catch {
      setError("root", {
        message: "We could not confirm your order. Your cart is still saved; please try again.",
      });
    }
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
            <div>
              <EmailField
                label="Email"
                autoComplete="email"
                placeholder="you@example.com"
                error={errors.email?.message}
                onCorrect={(email) => setValue("email", email, { shouldValidate: true })}
                {...register("email")}
              />
              {!errors.email && (
                <EmailNotice control={control} accountEmail={defaults.email} />
              )}
            </div>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Area / locality (optional)"
              placeholder="Gulberg III"
              error={errors.area?.message}
              {...register("area")}
            />
            <TextField
              label="City"
              autoComplete="address-level2"
              placeholder="Lahore"
              error={errors.city?.message}
              {...register("city")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Province (optional)"
              placeholder="Punjab"
              error={errors.province?.message}
              {...register("province")}
            />
            <TextField
              label="Postal code (optional)"
              autoComplete="postal-code"
              placeholder="54000"
              error={errors.postalCode?.message}
              {...register("postalCode")}
            />
          </div>

          <TextAreaField
            label="Notes (optional)"
            placeholder="Landmark, preferred delivery time, anything else"
            error={errors.notes?.message}
            {...register("notes")}
          />

          <div className="rounded-xl border border-line bg-surface-sunken p-4">
            <p className="text-sm font-medium">Cash on Delivery</p>
            <p className="mt-1 text-xs text-muted">
              Pay the order total in cash when your parcel is delivered. Payment will remain pending until collected.
            </p>
          </div>

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
            {entries.map(({ product, variant, color, quantity, lineTotal }) => (
              <li key={`${product.id}::${color}`} className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="flex items-center gap-3">
                    <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line">
                      <ProductImage
                        product={product}
                        src={variant.image}
                        alt={color ? `${product.name} in ${color}` : product.name}
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-2">{product.name}</span>
                      <span className="block text-xs text-muted">
                        {formatPrice(product.price)} each
                      </span>
                    </span>
                  </span>
                  {color && (
                    <span className="ml-1 inline-flex items-center gap-1 text-muted">
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-black/15 dark:border-white/20"
                        style={{ backgroundColor: variant.colorCode || "#d4d4d8" }}
                      />
                      {color}
                    </span>
                  )}
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
