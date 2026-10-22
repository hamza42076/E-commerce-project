import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { OrderItemImage } from "@/components/orders/OrderItemImage";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { getOrderById } from "@/lib/db/orders";
import { getSession } from "@/lib/auth/session";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Order confirmed" };

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/checkout");

  const { id } = await params;
  const order = await getOrderById(id);
  if (!order || order.userId !== session.userId) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <section className="rounded-2xl border border-line bg-surface-raised p-6 sm:p-8">
        <p className="text-sm font-medium text-brand-600">Cash on Delivery · Payment pending</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Thank you for your order</h1>
        <p className="mt-2 text-muted">
          Order <span className="font-mono font-medium text-ink">{order.reference}</span> was
          created successfully.
        </p>
        <p className="mt-1 text-sm text-muted">
          Placed {new Date(order.createdAt).toLocaleString("en-PK")}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <OrderStatusBadge status={order.status} />
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            Payment pending
          </span>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="rounded-2xl border border-line bg-surface-raised p-5">
          <h2 className="font-semibold">Items</h2>
          <ul className="mt-4 divide-y divide-line">
            {order.items.map((item, index) => (
              <li
                key={`${item.productId}::${item.color}::${index}`}
                className="flex gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line">
                  <OrderItemImage src={item.image} name={item.name} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.name}</p>
                  {item.color && <p className="text-sm text-muted">Colour: {item.color}</p>}
                  <p className="text-sm text-muted">
                    {formatPrice(item.price)} × {item.quantity}
                  </p>
                </div>
                <p className="shrink-0 font-medium tabular-nums">
                  {formatPrice(item.price * item.quantity)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <aside className="h-fit rounded-2xl border border-line bg-surface-raised p-5">
          <h2 className="font-semibold">Delivery and payment</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-muted">Deliver to</dt>
              <dd className="mt-0.5">{order.customerName}</dd>
            </div>
            <div>
              <dt className="text-muted">Address</dt>
              <dd className="mt-0.5">
                {[order.address, order.area, order.city, order.province, order.postalCode]
                  .filter(Boolean)
                  .join(", ")}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Phone</dt>
              <dd className="mt-0.5">{order.phone}</dd>
            </div>
            <div>
              <dt className="text-muted">Email</dt>
              <dd className="mt-0.5 break-all">{order.email}</dd>
            </div>
            <div>
              <dt className="text-muted">Payment method</dt>
              <dd className="mt-0.5">Cash on Delivery</dd>
            </div>
          </dl>

          <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Items subtotal</dt>
              <dd>{formatPrice(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Delivery</dt>
              <dd>{order.delivery === 0 ? "Free" : formatPrice(order.delivery)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold">
              <dt>Due on delivery</dt>
              <dd>{formatPrice(order.total)}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/account/orders/${order.id}`}
          className="rounded-xl border border-line px-5 py-3 text-sm font-medium transition hover:border-brand-400"
        >
          View order details
        </Link>
        <Link
          href="/products"
          className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
