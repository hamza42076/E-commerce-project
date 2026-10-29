import type { Metadata } from "next";
import Link from "next/link";
import { CollectPaymentButton } from "@/components/admin/CollectPaymentButton";
import { OrderStatusBadge } from "@/components/admin/OrderStatusBadge";
import { OrderStatusSelect } from "@/components/admin/OrderStatusSelect";
import { OrderItemImage } from "@/components/orders/OrderItemImage";
import { getOrdersPage } from "@/lib/db/orders";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUSES } from "@/lib/orders/status";
import type { OrderStatus, PaymentStatus } from "@/types";

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

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawPage = Number(first(params.page) ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const statusValue = first(params.status);
  const paymentValue = first(params.paymentStatus);
  const result = await getOrdersPage({
    page,
    pageSize: 20,
    search: first(params.q),
    status: ORDER_STATUSES.includes(statusValue as OrderStatus)
      ? (statusValue as OrderStatus)
      : undefined,
    paymentStatus: paymentValue === "pending" || paymentValue === "paid"
      ? paymentValue as PaymentStatus
      : undefined,
    from: first(params.from),
    to: first(params.to),
  });
  const orders = result.orders;
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  const filters = new URLSearchParams();
  for (const key of ["q", "status", "paymentStatus", "from", "to"]) {
    const value = first(params[key]);
    if (value) filters.set(key, value);
  }

  function pageHref(target: number): string {
    const query = new URLSearchParams(filters);
    query.set("page", String(target));
    return `/admin/orders?${query.toString()}`;
  }

  if (result.total === 0) {
    return (
      <div>
        <OrderFilters params={params} statuses={ORDER_STATUSES} />
        <p className="mt-4 rounded-2xl border border-dashed border-line-strong py-16 text-center text-sm text-muted">
          No matching orders.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <OrderFilters params={params} statuses={ORDER_STATUSES} />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p>
          Showing {(page - 1) * result.pageSize + 1}–
          {Math.min(page * result.pageSize, result.total)} of {result.total} orders
        </p>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="rounded-lg border border-line px-3 py-1.5">
              Previous
            </Link>
          )}
          {page < pageCount && (
            <Link href={pageHref(page + 1)} className="rounded-lg border border-line px-3 py-1.5">
              Next
            </Link>
          )}
        </div>
      </div>

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
                <p className="mt-1 text-xs text-muted">
                  {order.items.reduce((count, item) => count + item.quantity, 0)} items
                </p>
              </div>

              <div className="flex items-center gap-3">
                <OrderStatusSelect orderId={order.id} status={order.status} />
                {order.paymentStatus === "paid" ? (
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    COD collected
                  </span>
                ) : order.status === "delivered" ? (
                  <CollectPaymentButton orderId={order.id} />
                ) : (
                  <span className="text-xs text-muted">COD payment pending</span>
                )}
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
                    <dd>
                      <a className="font-mono hover:underline" href={`tel:${order.phone}`}>
                        {order.phone}
                      </a>
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-muted">Email</dt>
                    <dd className="truncate">{order.email}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-muted">Address</dt>
                    <dd>{[order.address, order.area, order.city, order.province, order.postalCode].filter(Boolean).join(", ")}</dd>
                  </div>
                  {order.notes && (
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 text-muted">Notes</dt>
                      <dd className="text-muted">{order.notes}</dd>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-muted">Payment</dt>
                    <dd className="capitalize">{order.paymentMethod.toUpperCase()} · {order.paymentStatus}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-subtle">
                  Items
                </h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {order.items.map((item, index) => (
                    <li
                      key={`${item.productId}::${item.color}::${index}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line">
                        <OrderItemImage src={item.image} name={item.name} />
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-1">{item.name}</span>
                        {/* The colour the customer actually picked, as it was
                            when they ordered. */}
                        {item.color && (
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs">
                            <span
                              className="h-2.5 w-2.5 rounded-full border border-black/15 dark:border-white/20"
                              style={{ backgroundColor: item.colorCode || "#d4d4d8" }}
                            />
                            <span className="font-medium">{item.color}</span>
                          </span>
                        )}
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
                  <div className="flex justify-between font-semibold">
                    <dt>COD due</dt>
                    <dd className="tabular-nums">{formatPrice(order.total)}</dd>
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

function OrderFilters({
  params,
  statuses,
}: {
  params: Record<string, string | string[] | undefined>;
  statuses: OrderStatus[];
}) {
  return (
    <form
      method="get"
      className="grid gap-3 rounded-2xl border border-line bg-surface-raised p-4 sm:grid-cols-2 lg:grid-cols-6"
    >
      <input
        name="q"
        defaultValue={first(params.q)}
        placeholder="Order, customer, phone"
        aria-label="Search orders"
        className="rounded-lg border border-line bg-surface px-3 py-2 text-sm lg:col-span-2"
      />
      <select
        name="status"
        defaultValue={first(params.status) ?? ""}
        aria-label="Filter by order status"
        className="rounded-lg border border-line bg-surface px-3 py-2 text-sm capitalize"
      >
        <option value="">All order statuses</option>
        {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
      </select>
      <select
        name="paymentStatus"
        defaultValue={first(params.paymentStatus) ?? ""}
        aria-label="Filter by payment status"
        className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
      >
        <option value="">All payment statuses</option>
        <option value="pending">Pending</option>
        <option value="paid">Paid</option>
      </select>
      <input
        name="from"
        type="date"
        defaultValue={first(params.from)}
        aria-label="Orders from date"
        className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <input
          name="to"
          type="date"
          defaultValue={first(params.to)}
          aria-label="Orders to date"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Filter
        </button>
      </div>
    </form>
  );
}
