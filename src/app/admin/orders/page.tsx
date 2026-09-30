import type { Metadata } from "next";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { getOrders } from "@/lib/db/orders";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Orders",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminOrdersPage() {
  const orders = await getOrders();

  if (orders.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line-strong py-16 text-center text-sm text-muted">
        No orders have come in yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {orders.length} {orders.length === 1 ? "order" : "orders"} in total
      </p>

      <ul className="space-y-4">
        {orders.map((order) => (
          <li
            key={order.id}
            className="overflow-hidden rounded-2xl border border-line bg-surface-raised"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-medium">{order.reference}</span>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="mt-1 text-sm text-muted">{formatDateTime(order.createdAt)}</p>
              </div>

              <div className="flex items-center gap-3">
                <OrderStatusSelect orderId={order.id} status={order.status} />
                <span className="text-lg font-semibold tabular-nums">
                  {formatPrice(order.total)}
                </span>
              </div>
            </div>

            <div className="grid gap-5 p-4 sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-subtle">
                  Customer
                </h3>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-muted">Name</dt>
                    <dd>{order.customerName}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-muted">Phone</dt>
                    <dd className="font-mono">{order.phone}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-muted">Email</dt>
                    <dd className="truncate">{order.email}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-muted">Address</dt>
                    <dd>
                      {order.address}, {order.city}
                    </dd>
                  </div>
                  {order.notes && (
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 text-muted">Notes</dt>
                      <dd className="text-muted">{order.notes}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-subtle">
                  Items
                </h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {order.items.map((item) => (
                    <li key={item.productId} className="flex justify-between gap-3">
                      <span className="min-w-0">
                        <span className="line-clamp-1">{item.name}</span>
                        <span className="text-muted">
                          {formatPrice(item.price)} x {item.quantity}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>

                <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">Subtotal</dt>
                    <dd className="tabular-nums">{formatPrice(order.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Delivery</dt>
                    <dd className="tabular-nums">
                      {order.delivery === 0 ? "Free" : formatPrice(order.delivery)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
