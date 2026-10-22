import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, changeOrderStatus } = vi.hoisted(() => ({
  getSession: vi.fn(),
  changeOrderStatus: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession }));
vi.mock("@/lib/orders/update-status", () => ({ changeOrderStatus }));

import { updateOrderStatusAction } from "./actions";

describe("admin order Server Action authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows a current admin to update an order", async () => {
    getSession.mockResolvedValue({ userId: "admin-1", role: "admin" });
    changeOrderStatus.mockResolvedValue({
      ok: true,
      emailQueued: true,
      order: { id: "order-1" },
    });

    await expect(updateOrderStatusAction("order-1", "confirmed")).resolves.toMatchObject({
      ok: true,
    });
    expect(changeOrderStatus).toHaveBeenCalledWith("order-1", "confirmed", "admin-1");
  });

  it.each([
    ["demoted administrator", { userId: "admin-1", role: "customer" }],
    ["deleted account", null],
  ])("denies a %s", async (_description, currentSession) => {
    getSession.mockResolvedValue(currentSession);

    await expect(updateOrderStatusAction("order-1", "confirmed")).resolves.toMatchObject({
      ok: false,
    });
    expect(changeOrderStatus).not.toHaveBeenCalled();
  });
});
