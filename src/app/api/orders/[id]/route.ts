import { getOrderById } from "@/lib/db/orders";
import { changeOrderStatus } from "@/lib/orders/update-status";
import { getBearerUser } from "@/lib/api/guard";
import {
  fail,
  forbidden,
  notFound,
  ok,
  readJson,
  unauthorized,
} from "@/lib/api/response";
import type { OrderStatus } from "@/types";

type Context = { params: Promise<{ id: string }> };

const STATUSES: OrderStatus[] = ["pending", "shipped", "delivered", "cancelled"];

/**
 * GET /api/orders/[id]
 *
 * Signed in required. A customer may read only their own order; anything else
 * is reported as not found rather than forbidden, so the endpoint cannot be
 * used to probe which order ids exist.
 *
 * 200 -> { data: { order } }
 */
export async function GET(request: Request, { params }: Context): Promise<Response> {
  const payload = getBearerUser(request);
  if (!payload) return unauthorized();

  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) return notFound("No order with that id.");
  if (payload.role !== "admin" && order.userId !== payload.userId) {
    return notFound("No order with that id.");
  }

  return ok({ order });
}

/**
 * PATCH /api/orders/[id]
 *
 * Admin only. Body: { status: "pending" | "shipped" | "delivered" | "cancelled" }
 * 200 -> { data: { order } }
 */
export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  const payload = getBearerUser(request);
  if (!payload) return unauthorized();
  if (payload.role !== "admin") return forbidden();

  const body = await readJson(request);
  if (body === null || typeof body !== "object") return fail("Send a JSON body.", 400);

  const { status } = body as { status?: unknown };
  if (typeof status !== "string" || !STATUSES.includes(status as OrderStatus)) {
    return fail(`status must be one of: ${STATUSES.join(", ")}.`, 422);
  }

  const { id } = await params;
  const result = await changeOrderStatus(id, status as OrderStatus);
  if (!result.ok) return notFound("No order with that id.");

  // emailQueued is false when the status was already what was asked for.
  return ok({ order: result.order, customerEmailed: result.emailQueued });
}
