import { beforeEach, describe, expect, it, vi } from "vitest";

const { getBearerUser } = vi.hoisted(() => ({
  getBearerUser: vi.fn(),
}));

vi.mock("@/lib/api/guard", () => ({ getBearerUser }));

import { POST } from "./route";

describe("POST /api/products admin authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies a customer before reading or creating a product", async () => {
    getBearerUser.mockResolvedValue({ userId: "customer-1", role: "customer" });

    const response = await POST(
      new Request("https://smartshop.test/api/products", {
        method: "POST",
        body: "not-json",
      }),
    );

    expect(response.status).toBe(403);
  });
});
