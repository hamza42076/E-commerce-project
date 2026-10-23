import Link from "next/link";
import type { Metadata } from "next";
import { ProductCard } from "@/components/ProductCard";
import { getSession } from "@/lib/auth/session";
import { getProductsByIds } from "@/lib/db/products";
import { getWishlistProductIds } from "@/lib/db/wishlist";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "My wishlist" };

export default async function WishlistPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account/wishlist");

  const productIds = await getWishlistProductIds(session.userId);
  const products = await getProductsByIds(productIds);
  const productsById = new Map(products.map((product) => [product.id, product]));
  const wishlist = productIds.flatMap((id) => {
    const product = productsById.get(id);
    return product ? [product] : [];
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">My wishlist</h1>
      <p className="mt-1 text-sm text-muted">Products you have saved for later.</p>

      {wishlist.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line-strong py-16 text-center">
          <p className="font-medium">Your wishlist is empty</p>
          <p className="mt-1 text-sm text-muted">Save products you like and find them here.</p>
          <Link
            href="/products"
            className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            Browse the shop
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {wishlist.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
