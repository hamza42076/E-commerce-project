import { getOrders, getOrdersByUser } from "@/lib/db/orders";
import { placeOrder } from "@/lib/orders/place-order";
import { getBearerUser } from "@/lib/api/guard";
import { created, fail, ok, readJson, unauthorized } from "@/lib/api/response";

/**
 * GET /api/orders
 *
 * Signed in required. An admin gets every order; a customer gets only their
 * own — the account comes from the token, never from a query parameter, so one
 * customer cannot ask for another's orders.
 *
 * 200 -> { data: { orders, count, scope } }
 */
export async function GET(request: Request): Promise<Response> {
  const payload = await getBearerUser(request);
  if (!payload) return unauthorized();

  const admin = payload.role === "admin";
  const orders = admin ? await getOrders() : await getOrdersByUser(payload.userId);

  return ok({ orders, count: orders.length, scope: admin ? "all" : "own" });
}

/**
 * POST /api/orders
 *
 * Signed in required. Send an Idempotency-Key header and body:
 * { details: {...}, items: [{ productId, color, quantity }] }
 * `details` takes the same fields as the checkout form.
 *
 * 201 -> { data: { order } }
 * 422 -> validation, empty cart, unavailable product, or not enough stock
 *
 * Prices and stock are read from the catalogue; the body only says which
 * products and how many.
 */
export async function POST(request: Request): Promise<Response> {
  const payload = await getBearerUser(request);
  if (!payload) return unauthorized();
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey) return fail("Send an Idempotency-Key header.", 400);

  const body = await readJson(request);
  if (body === null || typeof body !== "object") return fail("Send a JSON body.", 400);

  const { details, items } = body as { details?: unknown; items?: unknown };

  const result = await placeOrder({
    details,
    cartLines: items,
    userId: payload.userId,
    idempotencyKey,
  });

  if (!result.ok) {
    const status =
      result.reason === "stock" || result.reason === "conflict"
        ? 409
        : result.reason === "unavailable"
          ? 404
          : result.reason === "failed"
            ? 500
            : 422;
    return fail(result.message, status);
  }

  return created({ order: result.order });
}
