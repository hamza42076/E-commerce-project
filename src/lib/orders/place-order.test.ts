import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedProducts } from "@/lib/db/seed-products";
import { getOrderById, getOrdersByUser } from "@/lib/db/orders";
import { collectCodPayment, changeOrderStatus } from "@/lib/orders/update-status";
import { parseCartLines, placeOrder } from "@/lib/orders/place-order";

vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/email/mailer", () => ({ sendMail: vi.fn().mockResolvedValue(undefined) }));

const USER_ID = "cod-order-test-user";
const VALID_DETAILS = {
  fullName: "Test Customer",
  email: "test@example.com",
  phone: "03001234567",
  address: "House 12, Street 5, Gulshan-e-Iqbal",
  city: "Karachi",
  area: "Gulshan-e-Iqbal",
  province: "Sindh",
  postalCode: "75300",
};

let originalProducts: typeof seedProducts;

function beigeStock(): number {
  return seedProducts.find((product) => product.id === "p-001")!.variants.find(
    (variant) => variant.color === "Beige",
  )!.stock;
}

function setBeigeStock(stock: number): void {
  const product = seedProducts.find((entry) => entry.id === "p-001")!;
  product.variants.find((variant) => variant.color === "Beige")!.stock = stock;
  product.stock = product.variants.reduce((total, variant) => total + variant.stock, 0);
}

function place(
  key: string,
  options: { details?: unknown; cartLines?: unknown; userId?: string } = {},
) {
  return placeOrder({
    details: options.details ?? VALID_DETAILS,
    cartLines: options.cartLines ?? [{ productId: "p-001", color: "Beige", quantity: 1 }],
    userId: options.userId ?? USER_ID,
    idempotencyKey: key,
  });
}

beforeEach(() => {
  vi.stubEnv("MONGODB_URI", "");
  vi.stubEnv("NODE_ENV", "test");
  originalProducts = structuredClone(seedProducts);
});

afterEach(() => {
  seedProducts.splice(0, seedProducts.length, ...structuredClone(originalProducts));
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("COD order creation", () => {
  it("creates a pending COD order using server prices and shipping rules", async () => {
    const result = await place("cod-order-test-key-0001");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.paymentMethod).toBe("cod");
    expect(result.order.paymentStatus).toBe("pending");
    expect(result.order.status).toBe("pending");
    expect(result.order.subtotal).toBe(4000);
    expect(result.order.delivery).toBe(250);
    expect(result.order.total).toBe(4250);
    expect(result.order.area).toBe("Gulshan-e-Iqbal");
    expect(beigeStock()).toBe(4);
  });

  it("ignores client price fields and uses the current catalogue price", async () => {
    const result = await place("cod-order-client-price-0001", {
      cartLines: [
        { productId: "p-001", color: "Beige", quantity: 1, price: 1, total: 1 },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.items[0]?.price).toBe(4000);
    expect(result.order.total).toBe(4250);
  });

  it("combines duplicate cart lines and rejects excessive or malformed lines", () => {
    expect(
      parseCartLines([
        { productId: "p-001", color: "Beige", quantity: 2 },
        { productId: "p-001", color: "Beige", quantity: 3 },
      ]),
    ).toEqual([{ productId: "p-001", color: "Beige", quantity: 5 }]);
    expect(
      parseCartLines([
        { productId: "p-001", color: "Beige", quantity: 999 },
        { productId: "p-001", color: "Beige", quantity: 1 },
      ]),
    ).toBeNull();
    expect(parseCartLines([{ productId: "p-001", color: "Beige", quantity: 1.5 }])).toBeNull();
  });

  it("returns the existing order on retry without decrementing stock twice", async () => {
    const first = await place("cod-order-test-key-0002");
    const stockAfterFirst = beigeStock();
    const retry = await place("cod-order-test-key-0002", {
      details: { ...VALID_DETAILS, fullName: "Retry Changed Name" },
    });

    expect(first.ok && retry.ok && retry.order.id).toBe(first.ok ? first.order.id : "");
    expect(beigeStock()).toBe(stockAfterFirst);
  });

  it("allows different customers to use the same idempotency key", async () => {
    const sharedKey = "shared-customer-key-0001";
    const first = await place(sharedKey, { userId: "cod-customer-one" });
    const second = await place(sharedKey, { userId: "cod-customer-two" });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.order.id).not.toBe(first.order.id);
    expect((await getOrdersByUser("cod-customer-one")).map((order) => order.id)).toContain(
      first.order.id,
    );
    expect((await getOrdersByUser("cod-customer-two")).map((order) => order.id)).toContain(
      second.order.id,
    );
    expect(beigeStock()).toBe(3);
  });

  it("coalesces concurrent retries by the same customer and key", async () => {
    const beforeCount = (await getOrdersByUser(USER_ID)).length;
    const key = "cod-concurrent-key-0001";
    const [first, retry] = await Promise.all([place(key), place(key)]);

    expect(first.ok).toBe(true);
    expect(retry.ok).toBe(true);
    if (!first.ok || !retry.ok) return;
    expect(retry.order.id).toBe(first.order.id);
    expect((await getOrdersByUser(USER_ID)).length).toBe(beforeCount + 1);
    expect(beigeStock()).toBe(4);
  });

  it("rejects a missing idempotency key without creating an order", async () => {
    const beforeCount = (await getOrdersByUser(USER_ID)).length;
    const result = await place("");

    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    expect((await getOrdersByUser(USER_ID)).length).toBe(beforeCount);
    expect(beigeStock()).toBe(5);
  });

  it("rejects an empty cart and invalid customer information", async () => {
    const empty = await place("cod-order-test-key-0003", { cartLines: [] });
    const invalid = await place("cod-order-test-key-0004", {
      details: { ...VALID_DETAILS, phone: "12345" },
    });

    expect(empty.ok).toBe(false);
    expect(!empty.ok && empty.reason).toBe("empty");
    expect(invalid.ok).toBe(false);
    expect(!invalid.ok && invalid.reason).toBe("invalid");
    expect(beigeStock()).toBe(5);
  });

  it("rejects missing products, invalid variants, and quantities above stock", async () => {
    const missing = await place("cod-order-test-key-0005", {
      cartLines: [{ productId: "not-a-product", color: "", quantity: 1 }],
    });
    const invalidVariant = await place("cod-order-test-key-0006", {
      cartLines: [{ productId: "p-001", color: "Blue", quantity: 1 }],
    });
    const noStock = await place("cod-order-test-key-0007", {
      cartLines: [{ productId: "p-001", color: "Beige", quantity: 6 }],
    });

    expect(!missing.ok && missing.reason).toBe("unavailable");
    expect(!invalidVariant.ok && invalidVariant.reason).toBe("unavailable");
    expect(!noStock.ok && noStock.reason).toBe("stock");
    expect(beigeStock()).toBe(5);
  });

  it("prevents concurrent orders from overselling a variant", async () => {
    setBeigeStock(1);

    const results = await Promise.all([
      place("cod-order-test-key-0008"),
      place("cod-order-test-key-0009"),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(beigeStock()).toBe(0);
  });

  it("restores cancelled stock once and rejects invalid transitions", async () => {
    const created = await place("cod-order-test-key-0010");
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const invalid = await changeOrderStatus(created.order.id, "delivered", "admin-test");
    expect(invalid.ok).toBe(false);
    expect(beigeStock()).toBe(4);

    const cancelled = await changeOrderStatus(created.order.id, "cancelled", "admin-test");
    expect(cancelled.ok).toBe(true);
    expect(beigeStock()).toBe(5);

    await changeOrderStatus(created.order.id, "cancelled", "admin-test");
    expect(beigeStock()).toBe(5);
    expect((await getOrderById(created.order.id))?.inventoryRestoredAt).toBeTruthy();
  });

  it("cancels historical orders if their product or variant was removed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const created = await place("cod-order-deleted-item-0001");
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const productSnapshot = structuredClone(seedProducts.find((product) => product.id === "p-001")!);
    seedProducts.splice(
      seedProducts.findIndex((product) => product.id === "p-001"),
      1,
    );
    const cancelled = await changeOrderStatus(created.order.id, "cancelled", "admin-test");
    expect(cancelled.ok).toBe(true);
    expect((await getOrderById(created.order.id))?.status).toBe("cancelled");

    seedProducts.unshift(productSnapshot);
    const next = await place("cod-order-deleted-variant-0001");
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    const product = seedProducts.find((entry) => entry.id === "p-001")!;
    product.variants = product.variants.filter((variant) => variant.color !== "Beige");
    product.stock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);

    const cancelledAfterVariantRemoval = await changeOrderStatus(
      next.order.id,
      "cancelled",
      "admin-test",
    );
    expect(cancelledAfterVariantRemoval.ok).toBe(true);
    expect((await getOrderById(next.order.id))?.status).toBe("cancelled");
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("does not mark COD as paid when delivered; an admin records collection separately", async () => {
    const created = await place("cod-order-test-key-0011");
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    for (const status of ["confirmed", "processing", "shipped", "delivered"] as const) {
      await changeOrderStatus(created.order.id, status, "admin-test");
    }
    expect((await getOrderById(created.order.id))?.paymentStatus).toBe("pending");
    expect(await collectCodPayment(created.order.id, "admin-test")).toEqual({
      ok: true,
      alreadyPaid: false,
    });
    expect((await getOrderById(created.order.id))?.paymentStatus).toBe("paid");
    expect((await getOrderById(created.order.id))?.paidBy).toBe("admin-test");
  });

  it("coalesces concurrent COD collection attempts without double recording", async () => {
    const created = await place("cod-order-concurrent-payment-0001");
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    for (const status of ["confirmed", "processing", "shipped", "delivered"] as const) {
      await changeOrderStatus(created.order.id, status, "admin-test");
    }

    const results = await Promise.all([
      collectCodPayment(created.order.id, "admin-one"),
      collectCodPayment(created.order.id, "admin-two"),
    ]);

    expect(results).toContainEqual({ ok: true, alreadyPaid: false });
    expect(results).toContainEqual({ ok: true, alreadyPaid: true });
    expect((await getOrderById(created.order.id))?.paymentStatus).toBe("paid");
  });

  it("keeps the purchase-time price snapshot after the catalogue changes", async () => {
    const created = await place("cod-order-test-key-0012");
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    seedProducts.find((product) => product.id === "p-001")!.price = 9999;
    const stored = await getOrderById(created.order.id);

    expect(stored?.items[0]?.price).toBe(4000);
    expect(stored?.total).toBe(4250);
  });
});
