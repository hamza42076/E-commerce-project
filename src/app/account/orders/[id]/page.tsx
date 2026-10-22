import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { OrderItemImage } from "@/components/orders/OrderItemImage";
import { getOrderById } from "@/lib/db/orders";
import { getSession } from "@/lib/auth/session";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Order details" };

export default async function CustomerOrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/account/orders");

  const { id } = await params;
  const order = await getOrderById(id);
  if (!order || order.userId !== session.userId) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/account/orders" className="text-sm text-brand-600 hover:underline">
        ← My orders
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Order details</h1>
          <p className="mt-1 font-mono text-muted">{order.reference}</p>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <span className="text-sm capitalize text-muted">{order.paymentStatus} · COD</span>
        </div>
      </div>

      <p className="mt-2 text-sm text-muted">
        Placed {new Date(order.createdAt).toLocaleString("en-PK")}
      </p>

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
                <p className="font-medium tabular-nums">
                  {formatPrice(item.price * item.quantity)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <aside className="h-fit rounded-2xl border border-line bg-surface-raised p-5">
          <h2 className="font-semibold">Delivery address</h2>
          <p className="mt-3 text-sm">{order.customerName}</p>
          <p className="text-sm text-muted">
            {[order.address, order.area, order.city, order.province, order.postalCode]
              .filter(Boolean)
              .join(", ")}
          </p>
          <p className="mt-1 text-sm text-muted">{order.phone}</p>
          <p className="mt-1 break-all text-sm text-muted">{order.email}</p>
          <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd>{formatPrice(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Delivery</dt>
              <dd>{order.delivery === 0 ? "Free" : formatPrice(order.delivery)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 font-semibold">
              <dt>Total due on delivery</dt>
              <dd>{formatPrice(order.total)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
