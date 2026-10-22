import "server-only";
import { after } from "next/server";
import type { ClientSession } from "mongodb";
import {
  getOrderById,
  markCodPaymentCollected,
  updateOrderStatus,
} from "@/lib/db/orders";
import { getMongoClient, isConfigured } from "@/lib/db/mongo";
import { getProductById, restoreVariantStock } from "@/lib/db/products";
import { sendMail } from "@/lib/email/mailer";
import { orderStatusEmail } from "@/lib/email/templates";
import { canTransitionOrderStatus } from "@/lib/orders/status";
import type { Order, OrderStatus, OrderStatusChange } from "@/types";

export type UpdateStatusOutcome =
  | { ok: true; order: Order; emailQueued: boolean }
  | {
      ok: false;
      message: string;
      reason: "not-found" | "invalid-transition" | "inventory";
    };

class StatusFault extends Error {
  constructor(readonly outcome: Extract<UpdateStatusOutcome, { ok: false }>) {
    super(outcome.message);
  }
}

export async function changeOrderStatus(
  id: string,
  status: OrderStatus,
  adminId: string,
): Promise<UpdateStatusOutcome> {
  try {
    const result = isConfigured()
      ? await changeStatusTransaction(id, status, adminId)
      : await changeStatusInMemory(id, status, adminId);

    if (result.ok && result.emailQueued) notifyCustomer(result.order);
    return result;
  } catch (error) {
    if (error instanceof StatusFault) return error.outcome;
    console.error("[order] Could not update order status:", error);
    return {
      ok: false,
      reason: "inventory",
      message: "Could not safely update this order. No changes were applied.",
    };
  }
}

async function changeStatusTransaction(
  id: string,
  status: OrderStatus,
  adminId: string,
): Promise<UpdateStatusOutcome> {
  const client = await getMongoClient();
  const session = client.startSession();
  let outcome: UpdateStatusOutcome | null = null;

  try {
    await session.withTransaction(async () => {
      outcome = await updateStatus(id, status, adminId, session);
      if (
        !outcome.ok ||
        !outcome.emailQueued ||
        status !== "cancelled" ||
        outcome.order.status !== "cancelled"
      ) {
        return;
      }

      await restoreCancellationInventory(outcome.order.items, session);
    });
  } finally {
    await session.endSession();
  }

  if (!outcome) throw new Error("Order status transaction completed without a result.");
  return outcome;
}

async function changeStatusInMemory(
  id: string,
  status: OrderStatus,
  adminId: string,
): Promise<UpdateStatusOutcome> {
  const result = await updateStatus(id, status, adminId);
  if (
    !result.ok ||
    !result.emailQueued ||
    status !== "cancelled" ||
    result.order.status !== "cancelled"
  ) {
    return result;
  }

  await restoreCancellationInventory(result.order.items);
  return result;
}

async function restoreCancellationInventory(
  items: Order["items"],
  session?: ClientSession,
): Promise<void> {
  for (const item of items) {
    const restored = await restoreVariantStock(
      item.productId,
      item.color,
      item.quantity,
      session,
    );
    if (restored) continue;

    const product = await getProductById(item.productId, session);
    if (!product || !product.variants.some((variant) => variant.color === item.color)) {
      console.warn(
        "[order] Skipped stock restoration because the ordered product or variant no longer exists:",
        item.productId,
      );
      continue;
    }

    throw new StatusFault({
      ok: false,
      reason: "inventory",
      message:
        "The order could not be cancelled because its reserved stock could not be restored.",
    });
  }
}

async function updateStatus(
  id: string,
  status: OrderStatus,
  adminId: string,
  session?: ClientSession,
): Promise<UpdateStatusOutcome> {
  const before = await getOrderById(id, session);
  if (!before) {
    return { ok: false, reason: "not-found", message: "That order no longer exists." };
  }
  if (before.status === status) return { ok: true, order: before, emailQueued: false };
  if (!canTransitionOrderStatus(before.status, status)) {
    return {
      ok: false,
      reason: "invalid-transition",
      message: `An order cannot move from ${before.status} to ${status}.`,
    };
  }

  const change: OrderStatusChange = {
    status,
    at: new Date().toISOString(),
    actorId: adminId,
    actorRole: "admin",
  };
  const updated = await updateOrderStatus(id, before.status, status, change, {
    restoreInventory: status === "cancelled",
    session,
  });
  if (!updated) {
    return {
      ok: false,
      reason: "invalid-transition",
      message: "This order changed in another request. Refresh and try again.",
    };
  }

  return {
    ok: true,
    order: {
      ...before,
      status,
      updatedAt: change.at,
      statusHistory: [...before.statusHistory, change],
      ...(status === "cancelled" ? { inventoryRestoredAt: change.at } : {}),
    },
    emailQueued: true,
  };
}

export type CollectPaymentOutcome =
  | { ok: true; alreadyPaid: boolean }
  | { ok: false; reason: "not-found" | "not-delivered" | "failed" };

export async function collectCodPayment(
  id: string,
  adminId: string,
): Promise<CollectPaymentOutcome> {
  try {
    const order = await getOrderById(id);
    if (!order) return { ok: false, reason: "not-found" };
    if (order.status !== "delivered") return { ok: false, reason: "not-delivered" };
    if (order.paymentStatus === "paid") return { ok: true, alreadyPaid: true };

    const changed = await markCodPaymentCollected(id, adminId);
    if (changed) return { ok: true, alreadyPaid: false };

    const latest = await getOrderById(id);
    if (!latest) return { ok: false, reason: "not-found" };
    if (latest.paymentStatus === "paid") return { ok: true, alreadyPaid: true };
    return { ok: false, reason: "not-delivered" };
  } catch (error) {
    console.error("[order] Could not record COD payment:", error);
    return { ok: false, reason: "failed" };
  }
}

function notifyCustomer(order: Order): void {
  after(async () => {
    const message = orderStatusEmail(order);
    await sendMail({
      to: order.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  });
}
