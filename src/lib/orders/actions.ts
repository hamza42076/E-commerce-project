"use server";

import { checkoutSchema } from "@/lib/validation";
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

  return { ok: true, reference: order.reference, total: order.total };
}
