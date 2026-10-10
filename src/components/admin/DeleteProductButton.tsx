"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteProductAction } from "@/lib/admin/actions";
import { useUIStore } from "@/stores/ui";

export function DeleteProductButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteProductAction(id);
      setConfirming(false);
      if (!result.ok) {
        showToast("Could not delete", result.message);
        return;
      }
      showToast("Deleted", `"${name}" removed from the shop.`);
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition hover:border-rose-300 hover:text-rose-600"
      >
        Delete
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
      >
        {pending ? "Deleting..." : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition hover:text-ink"
      >
        Cancel
      </button>
    </span>
  );
}
