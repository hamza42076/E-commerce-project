"use server";

import { after } from "next/server";
import { checkoutSchema } from "@/lib/validation";
import { sendMail } from "@/lib/email/mailer";
import { newOrderOwnerEmail, orderConfirmationEmail } from "@/lib/email/templates";
import { getProductsByIds } from "@/lib/db/products";
import { createOrder } from "@/lib/db/orders";
import { deliveryFeeFor } from "@/lib/shipping";
import { getSession } from "@/lib/auth/session";
import type { CartLine, OrderItem } from "@/types";

export type PlaceOrderResult =
  | { ok: true; reference: string; total: number }
  | { ok: false; message: string };

function parseLines(value: unknown): CartLine[] | null {
  if (!Array.isArray(value)) return null;

  const lines: CartLine[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const { productId, quantity } = entry as Partial<CartLine>;
    if (typeof productId !== "string" || typeof quantity !== "number") return null;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return null;
    lines.push({ productId, quantity });
  }
  return lines;
}

/**
 * Prices are looked up server-side from the catalogue, never taken from the
 * browser — the client only says which products and how many.
 */
export async function placeOrderAction(
  details: unknown,
  cartLines: unknown,
): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(details);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, message: first?.message ?? "Check the form and try again." };
  }

  const lines = parseLines(cartLines);
  if (!lines || lines.length === 0) {
    return { ok: false, message: "Your cart is empty." };
  }

  const products = await getProductsByIds(lines.map((line) => line.productId));
  const byId = new Map(products.map((product) => [product.id, product]));

  const items: OrderItem[] = [];
  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product) {
      return { ok: false, message: "One of the products is no longer available." };
    }
    if (product.stock < line.quantity) {
      return {
        ok: false,
        message: `Only ${product.stock} left of "${product.name}". Adjust the quantity and try again.`,
      };
    }
    items.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: line.quantity,
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const delivery = deliveryFeeFor(subtotal);
  const session = await getSession();

  const order = await createOrder({
    customerName: parsed.data.fullName,
    email: parsed.data.email,
    phone: parsed.data.phone,
    address: parsed.data.address,
    city: parsed.data.city,
    notes: parsed.data.notes,
    items,
    subtotal,
    delivery,
    total: subtotal + delivery,
    userId: session?.userId,
  });

  // Sent after the response, so a slow or unreachable SMTP server never holds
  // up the confirmation screen. sendMail swallows its own failures: an order
  // that is placed stays placed even if neither email goes out, and one
  // failing does not stop the other.
  after(async () => {
    const confirmation = orderConfirmationEmail(order);
    const sends = [
      sendMail({
        to: order.email,
        subject: confirmation.subject,
        html: confirmation.html,
        text: confirmation.text,
      }),
    ];

    const owner = process.env.OWNER_EMAIL?.trim();
    if (owner) {
      const notice = newOrderOwnerEmail(order);
      sends.push(
        sendMail({
          to: owner,
          subject: notice.subject,
          html: notice.html,
          text: notice.text,
        }),
      );
    } else {
      console.warn("[email] OWNER_EMAIL is not set — no new-order notification sent.");
    }

    await Promise.all(sends);
  });

  return { ok: true, reference: order.reference, total: order.total };
}
