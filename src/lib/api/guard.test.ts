import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUserById, verifyToken } = vi.hoisted(() => ({
  findUserById: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock("@/lib/db/users", () => ({ findUserById }));
vi.mock("@/lib/auth/token", () => ({ verifyToken }));

import { getBearerUser, isAdminRequest } from "./guard";

const payload = {
  userId: "account-1",
  email: "old@example.com",
  name: "Old name",
  role: "admin" as const,
  exp: Math.floor(Date.now() / 1000) + 60,
};

function request(token = "signed-token"): Request {
  return new Request("https://smartshop.test/api", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe("current bearer authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyToken.mockReturnValue(payload);
  });

  it("uses the current account role instead of a stale admin token role", async () => {
    findUserById.mockResolvedValue({
      id: payload.userId,
      email: "customer@example.com",
      name: "Current name",
      role: "customer",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(isAdminRequest(request())).resolves.toBe(false);
    await expect(getBearerUser(request())).resolves.toMatchObject({
      role: "customer",
      email: "customer@example.com",
      name: "Current name",
    });
  });

  it("rejects a deleted or disabled account", async () => {
    findUserById.mockResolvedValue(null);

    await expect(getBearerUser(request())).resolves.toBeNull();
    await expect(isAdminRequest(request())).resolves.toBe(false);
  });

  it("allows an existing administrator", async () => {
    findUserById.mockResolvedValue({
      id: payload.userId,
      email: payload.email,
      name: payload.name,
      role: "admin",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(isAdminRequest(request())).resolves.toBe(true);
  });

  it("fails closed for missing, malformed, and invalid tokens", async () => {
    await expect(getBearerUser(new Request("https://smartshop.test/api"))).resolves.toBeNull();
    await expect(
      getBearerUser(
        new Request("https://smartshop.test/api", {
          headers: { Authorization: "Basic signed-token" },
        }),
      ),
    ).resolves.toBeNull();

    verifyToken.mockReturnValueOnce(null);
    await expect(getBearerUser(request("invalid"))).resolves.toBeNull();
    expect(findUserById).not.toHaveBeenCalled();
  });
});
