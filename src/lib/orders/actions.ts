"use server";

import { getSession } from "@/lib/auth/session";
import { placeOrder } from "./place-order";

export type PlaceOrderResult =
  | { ok: true; orderId: string; reference: string; total: number }
  | { ok: false; message: string };

/**
 * The checkout form's entry point. Authenticates from the cookie session, then
 * hands off to the shared placeOrder, which does the pricing, the stock checks
 * and the emails.
 */
export async function placeOrderAction(
  details: unknown,
  cartLines: unknown,
  idempotencyKey: string,
): Promise<PlaceOrderResult> {
  // Orders require an account. This is the check that counts — a server action
  // is its own HTTP endpoint, so hiding the button is not protection.
  const session = await getSession();
  if (!session) {
    return { ok: false, message: "Please sign in to place an order." };
  }

  const result = await placeOrder({
    details,
    cartLines,
    userId: session.userId,
    idempotencyKey,
  });
  if (!result.ok) return { ok: false, message: result.message };

  return {
    ok: true,
    orderId: result.order.id,
    reference: result.order.reference,
    total: result.order.total,
  };
}
