import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBearerUser, getOrderById } = vi.hoisted(() => ({
  getBearerUser: vi.fn(),
  getOrderById: vi.fn(),
}));

vi.mock("@/lib/api/guard", () => ({ getBearerUser }));
vi.mock("@/lib/db/orders", () => ({ getOrderById }));
vi.mock("@/lib/orders/update-status", () => ({
  changeOrderStatus: vi.fn(),
  collectCodPayment: vi.fn(),
}));

import { GET } from "./route";

const order = {
  id: "order-1",
  userId: "customer-owner",
  status: "pending",
};

describe("GET /api/orders/[id] ownership authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrderById.mockResolvedValue(order);
  });

  it("hides another customer's order", async () => {
    getBearerUser.mockResolvedValue({ userId: "customer-other", role: "customer" });

    const response = await GET(new Request("https://smartshop.test/api/orders/order-1"), {
      params: Promise.resolve({ id: "order-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("rejects unauthenticated reads", async () => {
    getBearerUser.mockResolvedValue(null);

    const response = await GET(new Request("https://smartshop.test/api/orders/order-1"), {
      params: Promise.resolve({ id: "order-1" }),
    });

    expect(response.status).toBe(401);
    expect(getOrderById).not.toHaveBeenCalled();
  });
});
