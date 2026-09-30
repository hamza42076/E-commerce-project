import type { OrderStatus } from "@/types";

/**
 * Status colours are a reserved palette, deliberately outside the brand pair —
 * they carry meaning, not decoration. Each badge always ships its label, so the
 * state is never communicated by colour alone.
 */
const STYLES: Record<OrderStatus, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  },
  shipped: {
    label: "Shipped",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  },
  delivered: {
    label: "Delivered",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const style = STYLES[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${style.className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {style.label}
    </span>
  );
}
