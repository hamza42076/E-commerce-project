import "server-only";
import { after } from "next/server";
import { getOrderById, updateOrderStatus } from "@/lib/db/orders";
import { sendMail } from "@/lib/email/mailer";
import { orderStatusEmail } from "@/lib/email/templates";
import type { Order, OrderStatus } from "@/types";

/**
 * Changing an order's status, and telling the customer about it.
 *
 * Both the admin panel's Server Action and PATCH /api/orders/[id] call this, so
 * the rules about when an email goes out live in one place.
 *
 * Authorisation is the caller's job — this assumes the admin check has already
 * happened.
 */

export type UpdateStatusOutcome =
  | { ok: true; order: Order; emailQueued: boolean }
  | { ok: false; message: string; reason: "not-found" };

export async function changeOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<UpdateStatusOutcome> {
  const before = await getOrderById(id);
  if (!before) {
    return { ok: false, reason: "not-found", message: "That order no longer exists." };
  }

  // Re-selecting the status it already has is not a change. Writing anyway
  // would be harmless, but emailing the customer again would not be.
  if (before.status === status) {
    return { ok: true, order: before, emailQueued: false };
  }

  const updated = await updateOrderStatus(id, status);
  if (!updated) {
    return { ok: false, reason: "not-found", message: "That order no longer exists." };
  }

  const order: Order = { ...before, status };
  notifyCustomer(order);

  return { ok: true, order, emailQueued: true };
}

/**
 * Queued to run after the response. The status change is already saved, so a
 * failed email never leaves the order in a half-updated state — sendMail
 * swallows its own errors and logs them.
 */
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
