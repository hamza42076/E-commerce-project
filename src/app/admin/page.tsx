import Link from "next/link";
import type { Metadata } from "next";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { getOrderStats, getOrders } from "@/lib/db/orders";
import { countProducts } from "@/lib/db/products";
import { countUsers } from "@/lib/db/users";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Overview",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Label in sentence case, value in proportional figures — tabular is for columns. */
function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-raised p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default async function AdminOverviewPage() {
  const [stats, orders, productCount, userCount] = await Promise.all([
    getOrderStats(),
    getOrders(),
    countProducts(),
    countUsers(),
  ]);

  const recent = orders.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Hero figure: the one number the dashboard leads with. */}
      <section className="rounded-2xl border border-line bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white sm:p-8">
        <p className="text-sm text-brand-100">Revenue, excluding cancelled orders</p>
        <p className="mt-2 text-5xl font-semibold">{formatPrice(stats.revenue)}</p>
        <p className="mt-2 text-sm text-brand-100">
          From {stats.totalOrders} {stats.totalOrders === 1 ? "order" : "orders"} ·{" "}
          {stats.itemsSold} items sold
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Orders to fulfil" value={String(stats.pending)} />
        <StatTile label="Delivered" value={String(stats.delivered)} />
        <StatTile label="Products listed" value={String(productCount)} />
        <StatTile label="Registered customers" value={String(userCount)} />
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Recent orders</h2>
          <Link
            href="/admin/orders"
            className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
          >
            See all orders
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong py-12 text-center text-sm text-muted">
            No orders yet.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface-raised">
            {recent.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    <span className="font-mono text-sm">{order.reference}</span>
                    <OrderStatusBadge status={order.status} />
                  </p>
                  <p className="mt-0.5 truncate text-sm text-muted">
                    {order.customerName} · {order.city} · {formatDate(order.createdAt)}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums">
                  {formatPrice(order.total)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
