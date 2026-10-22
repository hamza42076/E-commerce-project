import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { getOrdersByUser } from "@/lib/db/orders";
import { getSession } from "@/lib/auth/session";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "My orders" };

export default async function CustomerOrdersPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account/orders");

  const orders = await getOrdersByUser(session.userId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">My orders</h1>
      {orders.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line-strong py-16 text-center">
          <p className="font-medium">No orders yet</p>
          <Link href="/products" className="mt-3 inline-block text-sm text-brand-600">
            Browse the shop
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {orders.map((order) => (
            <li
              key={order.id}
              className="rounded-2xl border border-line bg-surface-raised p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="font-mono font-medium text-brand-700 hover:underline dark:text-brand-300"
                  >
                    {order.reference}
                  </Link>
                  <p className="mt-1 text-sm text-muted">
                    {new Date(order.createdAt).toLocaleDateString("en-PK")} ·{" "}
                    {order.items.reduce((total, item) => total + item.quantity, 0)} items
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <OrderStatusBadge status={order.status} />
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    Payment {order.paymentStatus}
                  </span>
                  <span className="font-semibold tabular-nums">{formatPrice(order.total)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
