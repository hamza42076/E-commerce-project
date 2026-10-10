"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateOrderStatusAction } from "@/lib/admin/actions";
import { useUIStore } from "@/stores/ui";
import type { OrderStatus } from "@/types";

const OPTIONS: OrderStatus[] = ["pending", "shipped", "delivered", "cancelled"];

export function OrderStatusSelect({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const [pending, startTransition] = useTransition();
  // Shown immediately so the select does not snap back while the action runs.
  const [optimistic, setOptimistic] = useState(status);

  function handleChange(next: OrderStatus) {
    const previous = optimistic;
    setOptimistic(next);

    startTransition(async () => {
      const result = await updateOrderStatusAction(orderId, next);
      if (!result.ok) {
        setOptimistic(previous);
        showToast("Could not update", result.message);
        return;
      }
      showToast("Order updated", result.message);
      router.refresh();
    });
  }

  return (
    <select
      value={optimistic}
      disabled={pending}
      onChange={(event) => handleChange(event.target.value as OrderStatus)}
      aria-label="Order status"
      className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs capitalize outline-none transition focus:border-brand-500 disabled:opacity-60"
    >
      {OPTIONS.map((option) => (
        <option key={option} value={option} className="capitalize">
          {option}
        </option>
      ))}
    </select>
  );
}
