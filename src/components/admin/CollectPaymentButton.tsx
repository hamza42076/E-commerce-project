"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { collectCodPaymentAction } from "@/lib/admin/actions";
import { useUIStore } from "@/stores/ui";

export function CollectPaymentButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const showToast = useUIStore((state) => state.showToast);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Record that the COD amount has been collected?")) return;
        startTransition(async () => {
          const result = await collectCodPaymentAction(orderId);
          showToast(result.ok ? "Payment updated" : "Could not update payment", result.message);
          if (result.ok) router.refresh();
        });
      }}
      className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium transition hover:border-brand-400 disabled:opacity-60"
    >
      {pending ? "Saving..." : "Record COD collected"}
    </button>
  );
}
