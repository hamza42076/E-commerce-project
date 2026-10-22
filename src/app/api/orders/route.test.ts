import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBearerUser, placeOrder } = vi.hoisted(() => ({
  getBearerUser: vi.fn(() => ({ userId: "api-customer", role: "customer" as const })),
  placeOrder: vi.fn(),
}));

vi.mock("@/lib/api/guard", () => ({ getBearerUser }));
vi.mock("@/lib/orders/place-order", () => ({ placeOrder }));

import { POST } from "./route";

describe("POST /api/orders idempotency contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([undefined, "   "])("rejects a missing or blank key (%s)", async (key) => {
    const headers = new Headers({ "Content-Type": "application/json" });
    if (key !== undefined) headers.set("Idempotency-Key", key);

    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers,
        body: JSON.stringify({ details: {}, items: [] }),
      }),
    );

    expect(response.status).toBe(400);
    expect(placeOrder).not.toHaveBeenCalled();
  });
});
