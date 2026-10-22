import { getOrderById } from "@/lib/db/orders";
import { changeOrderStatus, collectCodPayment } from "@/lib/orders/update-status";
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

const STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

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
  const payload = await getBearerUser(request);
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
 * Admin only. Body: { status: OrderStatus } or { paymentStatus: "paid" }.
 * 200 -> { data: { order } }
 */
export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  const payload = await getBearerUser(request);
  if (!payload) return unauthorized();
  if (payload.role !== "admin") return forbidden();

  const body = await readJson(request);
  if (body === null || typeof body !== "object") return fail("Send a JSON body.", 400);

  const { id } = await params;
  const values = body as { status?: unknown; paymentStatus?: unknown };
  if (values.paymentStatus === "paid" && values.status === undefined) {
    const admin = await getBearerUser(request);
    if (!admin) return unauthorized();
    const result = await collectCodPayment(id, admin.userId);
    if (!result.ok) {
      return result.reason === "not-found"
        ? notFound("No order with that id.")
        : result.reason === "failed"
          ? fail("Could not record this payment.", 500)
          : fail("COD can only be marked collected after the order is delivered.", 409);
    }
    return ok({ paymentStatus: "paid", alreadyPaid: result.alreadyPaid });
  }
  if (
    typeof values.status !== "string" ||
    !STATUSES.includes(values.status as OrderStatus) ||
    values.paymentStatus !== undefined
  ) {
    return fail(`Send one status from: ${STATUSES.join(", ")}.`, 422);
  }

  const admin = await getBearerUser(request);
  if (!admin) return unauthorized();
  const result = await changeOrderStatus(id, values.status as OrderStatus, admin.userId);
  if (!result.ok) {
    return result.reason === "not-found"
      ? notFound("No order with that id.")
      : fail(result.message, 409);
  }

  // emailQueued is false when the status was already what was asked for.
  return ok({ order: result.order, customerEmailed: result.emailQueued });
}
