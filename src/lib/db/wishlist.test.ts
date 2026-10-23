import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addWishlistProduct,
  getWishlistProductIds,
  removeWishlistProduct,
} from "./wishlist";

beforeEach(() => {
  vi.stubEnv("MONGODB_URI", "");
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("wishlist storage", () => {
  it("saves products once per user and removes only the selected user's item", async () => {
    const firstUser = "wishlist-test-user-a";
    const secondUser = "wishlist-test-user-b";

    await addWishlistProduct(firstUser, "wishlist-product-a");
    await addWishlistProduct(firstUser, "wishlist-product-a");
    await addWishlistProduct(firstUser, "wishlist-product-b");
    await addWishlistProduct(secondUser, "wishlist-product-a");

    expect(await getWishlistProductIds(firstUser)).toEqual([
      "wishlist-product-a",
      "wishlist-product-b",
    ]);
    expect(await getWishlistProductIds(secondUser)).toEqual(["wishlist-product-a"]);

    await removeWishlistProduct(firstUser, "wishlist-product-a");

    expect(await getWishlistProductIds(firstUser)).toEqual(["wishlist-product-b"]);
    expect(await getWishlistProductIds(secondUser)).toEqual(["wishlist-product-a"]);
  });
});
