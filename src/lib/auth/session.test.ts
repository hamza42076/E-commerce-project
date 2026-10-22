import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookies, findUserById, verifyToken } = vi.hoisted(() => ({
  cookies: vi.fn(),
  findUserById: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies }));
vi.mock("@/lib/db/users", () => ({ findUserById }));
vi.mock("./token", () => ({
  payloadFor: vi.fn((user) => ({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: 9999999999,
  })),
  signToken: vi.fn(),
  verifyToken,
  TOKEN_MAX_AGE_SECONDS: 604800,
}));

import { getSession, isAdmin } from "./session";

const oldAdminPayload = {
  userId: "admin-1",
  email: "old@example.com",
  name: "Old name",
  role: "admin" as const,
  exp: 9999999999,
};

describe("current cookie session authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookies.mockResolvedValue({ get: () => ({ value: "signed-token" }) });
    verifyToken.mockReturnValue(oldAdminPayload);
  });

  it("refreshes the role and profile from the current account", async () => {
    findUserById.mockResolvedValue({
      id: "admin-1",
      email: "current@example.com",
      name: "Current name",
      role: "customer",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(getSession()).resolves.toEqual({
      ...oldAdminPayload,
      email: "current@example.com",
      name: "Current name",
      role: "customer",
    });
    await expect(isAdmin()).resolves.toBe(false);
  });

  it("invalidates sessions for accounts that are deleted or disabled", async () => {
    findUserById.mockResolvedValue(null);

    await expect(getSession()).resolves.toBeNull();
    await expect(isAdmin()).resolves.toBe(false);
  });

  it("rejects missing and invalid cookies without looking up an account", async () => {
    cookies.mockResolvedValue({ get: () => undefined });
    await expect(getSession()).resolves.toBeNull();

    cookies.mockResolvedValue({ get: () => ({ value: "invalid" }) });
    verifyToken.mockReturnValueOnce(null);
    await expect(getSession()).resolves.toBeNull();
    expect(findUserById).not.toHaveBeenCalled();
  });
});
