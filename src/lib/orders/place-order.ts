import "server-only";
import { after } from "next/server";
import type { ClientSession } from "mongodb";
import { checkoutSchema } from "@/lib/validation";
import { sendMail } from "@/lib/email/mailer";
import { newOrderOwnerEmail, orderConfirmationEmail } from "@/lib/email/templates";
import {
  decrementVariantStock,
  getProductsByIds,
  restoreVariantStock,
} from "@/lib/db/products";
import {
  createOrder,
  findOrderByIdempotencyKey,
} from "@/lib/db/orders";
import { getMongoClient, isConfigured } from "@/lib/db/mongo";
import { findVariant } from "@/lib/products/variants";
import { deliveryFeeFor } from "@/lib/shipping";
import type { CartLine, Order, OrderItem } from "@/types";

/**
 * Both the cookie-authenticated checkout action and bearer-token API use this
 * service. Prices and stock always come from the server-side catalogue.
 */

export type PlaceOrderOutcome =
  | { ok: true; order: Order }
  | {
      ok: false;
      message: string;
      reason: "invalid" | "empty" | "unavailable" | "stock" | "conflict" | "failed";
    };

const inFlight = new Map<string, Promise<PlaceOrderOutcome>>();

class OrderFault extends Error {
  constructor(readonly outcome: Extract<PlaceOrderOutcome, { ok: false }>) {
    super(outcome.message);
  }
}

/** Accepts and coalesces only well-formed `{ productId, color, quantity }` lines. */
export function parseCartLines(value: unknown): CartLine[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) return null;

  const combined = new Map<string, CartLine>();
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const { productId, color, quantity } = entry as Partial<CartLine>;
    if (
      typeof productId !== "string" ||
      productId.length === 0 ||
      productId.length > 128 ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 999 ||
      (color !== undefined && (typeof color !== "string" || color.length > 40))
    ) {
      return null;
    }

    const normalizedColor = color ?? "";
    const key = `${productId}::${normalizedColor}`;
    const previous = combined.get(key);
    const totalQuantity = (previous?.quantity ?? 0) + quantity;
    if (totalQuantity > 999) return null;
    combined.set(key, { productId, color: normalizedColor, quantity: totalQuantity });
  }
  return [...combined.values()];
}

export async function placeOrder(options: {
  details: unknown;
  cartLines: unknown;
  userId: string;
  idempotencyKey: string;
}): Promise<PlaceOrderOutcome> {
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(options.idempotencyKey)) {
    return {
      ok: false,
      reason: "invalid",
      message: "Refresh checkout and try placing your order again.",
    };
  }

  const key = `${options.userId}:${options.idempotencyKey}`;
  const pending = inFlight.get(key);
  if (pending) return pending;

  const operation = placeOrderOnce(options);
  inFlight.set(key, operation);
  try {
    return await operation;
  } finally {
    if (inFlight.get(key) === operation) inFlight.delete(key);
  }
}

async function placeOrderOnce(options: {
  details: unknown;
  cartLines: unknown;
  userId: string;
  idempotencyKey: string;
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
  if (!lines) {
    return { ok: false, reason: "empty", message: "Your cart is empty or invalid." };
  }

  try {
    const previous = await findOrderByIdempotencyKey(options.userId, options.idempotencyKey);
    if (previous) return { ok: true, order: previous };

    if (isConfigured()) {
      return await placeWithTransaction(options, parsed.data, lines);
    }
    return await placeInMemory(options, parsed.data, lines);
  } catch (error) {
    if (error instanceof OrderFault) return error.outcome;
    console.error("[order] Could not place the order:", error);
    return {
      ok: false,
      reason: "failed",
      message: "Could not place your order right now. Your cart has been kept; please try again.",
    };
  }
}

async function placeWithTransaction(
  options: { userId: string; idempotencyKey: string },
  details: ReturnType<typeof checkoutSchema.parse>,
  lines: CartLine[],
): Promise<PlaceOrderOutcome> {
  const client = await getMongoClient();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const session = client.startSession();

    try {
      const outcome = await session.withTransaction(async () => {
        const previous = await findOrderByIdempotencyKey(
          options.userId,
          options.idempotencyKey,
          session,
        );
        if (previous) {
          return { order: previous, created: false };
        }

        const items = await validatedItems(lines, session);
        await reserveInventory(items, session);
        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const delivery = deliveryFeeFor(subtotal);

        const order = await createOrder(
          {
            customerName: details.fullName,
            email: details.email,
            phone: details.phone,
            address: details.address,
            city: details.city,
            area: details.area || undefined,
            province: details.province || undefined,
            postalCode: details.postalCode || undefined,
            notes: details.notes,
            items,
            subtotal,
            delivery,
            total: subtotal + delivery,
            userId: options.userId,
            idempotencyKey: options.idempotencyKey,
            actorId: options.userId,
          },
          session,
        );
        return { order, created: true };
      });

      if (!outcome) throw new Error("Order transaction completed without an outcome.");
      if (outcome.created) sendOrderEmails(outcome.order);
      return { ok: true, order: outcome.order };
    } catch (error) {
      if (isDuplicateKey(error)) {
        const existing = await findOrderByIdempotencyKey(
          options.userId,
          options.idempotencyKey,
        );
        if (existing) return { ok: true, order: existing };
        // A random order-reference collision is retried with a new reference.
        if (attempt < 2) continue;
      }
      if (error instanceof OrderFault) return error.outcome;
      throw error;
    } finally {
      await session.endSession();
    }
  }

  return {
    ok: false,
    reason: "conflict",
    message: "We could not confirm this order. Please retry; your cart is unchanged.",
  };
}

async function placeInMemory(
  options: { userId: string; idempotencyKey: string },
  details: ReturnType<typeof checkoutSchema.parse>,
  lines: CartLine[],
): Promise<PlaceOrderOutcome> {
  const items = await validatedItems(lines);
  const reserved: OrderItem[] = [];
  try {
    await reserveInventory(items, undefined, (item) => reserved.push(item));
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const delivery = deliveryFeeFor(subtotal);
    const order = await createOrder({
      customerName: details.fullName,
      email: details.email,
      phone: details.phone,
      address: details.address,
      city: details.city,
      area: details.area || undefined,
      province: details.province || undefined,
      postalCode: details.postalCode || undefined,
      notes: details.notes,
      items,
      subtotal,
      delivery,
      total: subtotal + delivery,
      userId: options.userId,
      idempotencyKey: options.idempotencyKey,
      actorId: options.userId,
    });
    sendOrderEmails(order);
    return { ok: true, order };
  } catch (error) {
    for (const item of reserved) {
      const restored = await restoreVariantStock(item.productId, item.color, item.quantity);
      if (!restored) console.error("[order] Could not restore reserved stock:", item.productId);
    }
    if (error instanceof OrderFault) return error.outcome;
    throw error;
  }
}

async function validatedItems(
  lines: CartLine[],
  session?: ClientSession,
): Promise<OrderItem[]> {
  const products = await getProductsByIds(lines.map((line) => line.productId), session);
  const byId = new Map(products.map((product) => [product.id, product]));
  const items: OrderItem[] = [];

  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product) {
      throw new OrderFault({
        ok: false,
        reason: "unavailable",
        message: "One of the products is no longer available.",
      });
    }

    const variant = findVariant(product, line.color);
    if (!variant) {
      throw new OrderFault({
        ok: false,
        reason: "unavailable",
        message: line.color
          ? `"${product.name}" no longer comes in ${line.color}.`
          : "One of the products is no longer available.",
      });
    }
    if (variant.stock < line.quantity) {
      throw new OrderFault({
        ok: false,
        reason: "stock",
        message: variant.color
          ? `Only ${variant.stock} left of "${product.name}" in ${variant.color}.`
          : `Only ${variant.stock} left of "${product.name}".`,
      });
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
  return items;
}

async function reserveInventory(
  items: OrderItem[],
  session?: ClientSession,
  onReserved?: (item: OrderItem) => void,
): Promise<void> {
  for (const item of items) {
    const taken = await decrementVariantStock(
      item.productId,
      item.color,
      item.quantity,
      session,
    );
    if (!taken) {
      throw new OrderFault({
        ok: false,
        reason: "stock",
        message: item.color
          ? `"${item.name}" in ${item.color} just sold out. Adjust the quantity and try again.`
          : `"${item.name}" just sold out.`,
      });
    }
    onReserved?.(item);
  }
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

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
