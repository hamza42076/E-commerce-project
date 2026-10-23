import "server-only";
import { wishlistsCollection, type WishlistDoc } from "./mongo";
import { shouldUseSeedData } from "./fallback";

let memoryWishlist: WishlistDoc[] = [];

function wishlistId(userId: string, productId: string): string {
  return JSON.stringify([userId, productId]);
}

export async function getWishlistProductIds(userId: string): Promise<string[]> {
  if (shouldUseSeedData()) {
    return memoryWishlist
      .filter((entry) => entry.userId === userId)
      .map((entry) => entry.productId);
  }

  const collection = await wishlistsCollection();
  const entries = await collection.find({ userId }).toArray();
  return entries.map((entry) => entry.productId);
}

export async function addWishlistProduct(userId: string, productId: string): Promise<void> {
  const _id = wishlistId(userId, productId);
  if (shouldUseSeedData()) {
    if (!memoryWishlist.some((entry) => entry._id === _id)) {
      memoryWishlist.push({ _id, userId, productId, createdAt: new Date().toISOString() });
    }
    return;
  }

  const collection = await wishlistsCollection();
  await collection.updateOne(
    { _id },
    {
      $setOnInsert: {
        userId,
        productId,
        createdAt: new Date().toISOString(),
      },
    },
    { upsert: true },
  );
}

export async function removeWishlistProduct(userId: string, productId: string): Promise<void> {
  const _id = wishlistId(userId, productId);
  if (shouldUseSeedData()) {
    memoryWishlist = memoryWishlist.filter((entry) => entry._id !== _id);
    return;
  }

  const collection = await wishlistsCollection();
  await collection.deleteOne({ _id, userId });
}
