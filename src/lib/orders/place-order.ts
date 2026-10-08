import "server-only";
import { after } from "next/server";
import { checkoutSchema } from "@/lib/validation";
import { sendMail } from "@/lib/email/mailer";
import { newOrderOwnerEmail, orderConfirmationEmail } from "@/lib/email/templates";
import {
  decrementVariantStock,
  getProductsByIds,
  restoreVariantStock,
} from "@/lib/db/products";
import { createOrder } from "@/lib/db/orders";
import { findVariant } from "@/lib/products/variants";
import { deliveryFeeFor } from "@/lib/shipping";
import type { CartLine, Order, OrderItem } from "@/types";

/**
 * Placing an order, with the authenticated user handed in.
 *
 * Both entry points call this: the checkout Server Action (cookie session) and
 * POST /api/orders (bearer token). Pricing, variant and stock checks and the
 * confirmation emails live here once — if they were copied into each one, the
 * two would eventually disagree about what an order costs.
 *
 * Authentication is the caller's job; this assumes it has already happened.
 */

export type PlaceOrderOutcome =
  | { ok: true; order: Order }
  | { ok: false; message: string; reason: "invalid" | "empty" | "unavailable" | "stock" };

/** Accepts only well-formed `{ productId, color, quantity }` entries. */
export function parseCartLines(value: unknown): CartLine[] | null {
  if (!Array.isArray(value)) return null;

  const lines: CartLine[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const { productId, color, quantity } = entry as Partial<CartLine>;
    if (typeof productId !== "string" || typeof quantity !== "number") return null;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return null;
    // Absent colour means a product without variants; anything else must be a
    // string so it can be matched against a real variant below.
    if (color !== undefined && typeof color !== "string") return null;
    lines.push({ productId, color: color ?? "", quantity });
  }
  return lines;
}

export async function placeOrder(options: {
  details: unknown;
  cartLines: unknown;
  userId: string;
}): Promise<PlaceOrderOutcome> {
  const parsed = checkoutSchema.safeParse(options.details);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "invalid",
      message: parsed.error.issues[0]?.message ?? "Check the details and try again.",
    };
  }

  const lines = parseCartLines(options.cartLines);
  if (!lines || lines.length === 0) {
    return { ok: false, reason: "empty", message: "Your cart is empty." };
  }

  // Prices, colours and stock all come from the catalogue. The request only says
  // which product, which colour and how many.
  const products = await getProductsByIds(lines.map((line) => line.productId));
  const byId = new Map(products.map((product) => [product.id, product]));

  const items: OrderItem[] = [];
  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product) {
      return {
        ok: false,
        reason: "unavailable",
        message: "One of the products is no longer available.",
      };
    }

    const variant = findVariant(product, line.color);
    if (!variant) {
      return {
        ok: false,
        reason: "unavailable",
        message: line.color
          ? `"${product.name}" no longer comes in ${line.color}.`
          : "One of the products is no longer available.",
      };
    }

    // Against this colour's stock, never the product total.
    if (variant.stock < line.quantity) {
      return {
        ok: false,
        reason: "stock",
        message: variant.color
          ? `Only ${variant.stock} left of "${product.name}" in ${variant.color}.`
          : `Only ${variant.stock} left of "${product.name}".`,
      };
    }

    items.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: line.quantity,
      color: variant.color,
      colorCode: variant.colorCode,
      image: variant.image,
    });
  }

  // Take the stock before writing the order. Each decrement is a single
  // conditional update, so two orders arriving together cannot both pass. If a
  // later line loses that race, the earlier ones are put back.
  const reserved: OrderItem[] = [];
  for (const item of items) {
    const taken = await decrementVariantStock(item.productId, item.color, item.quantity);
    if (taken) {
      reserved.push(item);
      continue;
    }

    await releaseAll(reserved);
    return {
      ok: false,
      reason: "stock",
      message: item.color
        ? `"${item.name}" in ${item.color} just sold out. Adjust the quantity and try again.`
        : `"${item.name}" just sold out.`,
    };
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const delivery = deliveryFeeFor(subtotal);

  let order: Order;
  try {
    order = await createOrder({
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
      userId: options.userId,
    });
  } catch (error) {
    // The stock is already gone; without putting it back it would be stranded.
    await releaseAll(reserved);
    console.error("[order] Could not write the order, stock released:", error);
    return {
      ok: false,
      reason: "unavailable",
      message: "Could not place the order just now. Please try again.",
    };
  }

  sendOrderEmails(order);

  return { ok: true, order };
}

async function releaseAll(items: OrderItem[]): Promise<void> {
  for (const item of items) {
    await restoreVariantStock(item.productId, item.color, item.quantity);
  }
}

/**
 * Queued to run after the response, so a slow or unreachable SMTP server never
 * holds up the confirmation. sendMail swallows its own failures: an order that
 * is placed stays placed even if neither email goes out, and one failing does
 * not stop the other.
 */
function sendOrderEmails(order: Order): void {
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
}
