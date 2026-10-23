"use server";

import { getSession } from "@/lib/auth/session";
import { getProductById } from "@/lib/db/products";
import {
  addWishlistProduct,
  removeWishlistProduct,
} from "@/lib/db/wishlist";

function validateProductId(productId: unknown): asserts productId is string {
  if (
    typeof productId !== "string" ||
    productId.length < 1 ||
    productId.length > 128 ||
    productId.trim() !== productId
  ) {
    throw new Error("Invalid product.");
  }
}

export async function saveToWishlist(productId: string): Promise<void> {
  validateProductId(productId);
  const session = await getSession();
  if (!session) throw new Error("Sign in to save products to your wishlist.");
  if (!(await getProductById(productId))) throw new Error("This product is no longer available.");

  await addWishlistProduct(session.userId, productId);
}

export async function removeFromWishlist(productId: string): Promise<void> {
  validateProductId(productId);
  const session = await getSession();
  if (!session) throw new Error("Sign in to manage your wishlist.");

  await removeWishlistProduct(session.userId, productId);
}
