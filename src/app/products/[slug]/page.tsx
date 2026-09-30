import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductImage } from "@/components/ProductImage";
import { ProductCard } from "@/components/ProductCard";
import { Rating } from "@/components/Rating";
import { PurchasePanel } from "@/components/PurchasePanel";
import { discountPercent, formatPrice } from "@/lib/format";
import { getAllProducts, getProductBySlug, getRelatedProducts } from "@/lib/db/products";

// The root layout reads the session cookie, so every route renders per request.
// That keeps prices, stock and the signed-in header always current.

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  try {
    const products = await getAllProducts();
    return products.map((product) => ({ slug: product.slug }));
  } catch (error) {
    // No database at build time — fall back to rendering each page on demand.
    console.warn("[build] Could not prerender product pages:", error);
    return [];
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };
  return { title: product.name, description: product.description };
}

const DETAILS = [
  { label: "Delivery", value: "2-4 working days" },
  { label: "Returns", value: "7 days, unopened" },
  { label: "Payment", value: "Cash on delivery" },
  { label: "Warranty", value: "Seller warranty" },
];

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const related = await getRelatedProducts(product);
  const discount = discountPercent(product.price, product.compareAtPrice);
  const soldOut = product.stock < 1;
  const saving =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? product.compareAtPrice - product.price
      : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Link href="/products" className="transition hover:text-brand-600">
          Shop
        </Link>
        <span className="text-subtle">/</span>
        <Link
          href={`/products?category=${product.category}`}
          className="capitalize transition hover:text-brand-600"
        >
          {product.category}
        </Link>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-3xl border border-line">
          <ProductImage product={product} iconClass="h-2/5 w-2/5" />
          {discount !== null && (
            <span className="absolute left-4 top-4 rounded-full bg-accent-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm">
              {discount}% off
            </span>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-subtle">
              {product.category}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {product.name}
            </h1>
            <Rating value={product.rating} reviewCount={product.reviewCount} className="mt-3" />
          </div>

          <div className="rounded-2xl border border-line bg-surface-sunken p-5">
            <div className="flex flex-wrap items-baseline gap-3">
              <p className="text-3xl font-semibold">{formatPrice(product.price)}</p>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <p className="text-lg text-subtle line-through">
                  {formatPrice(product.compareAtPrice)}
                </p>
              )}
            </div>
            {saving !== null && (
              <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                You save {formatPrice(saving)}
              </p>
            )}

            <p className="mt-3 flex items-center gap-2 text-sm">
              <span
                className={`h-2 w-2 rounded-full ${
                  soldOut
                    ? "bg-rose-500"
                    : product.stock <= 5
                      ? "bg-accent-500"
                      : "bg-emerald-500"
                }`}
              />
              {soldOut ? (
                <span className="text-rose-600 dark:text-rose-400">Out of stock</span>
              ) : product.stock <= 5 ? (
                <span className="text-accent-600 dark:text-accent-400">
                  Only {product.stock} left in stock
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400">In stock</span>
              )}
            </p>

            <div className="mt-5">
              <PurchasePanel product={product} />
            </div>
          </div>

          <p className="leading-relaxed text-muted">{product.description}</p>

          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
            {DETAILS.map((detail) => (
              <div key={detail.label} className="bg-surface p-4">
                <dt className="text-xs text-muted">{detail.label}</dt>
                <dd className="mt-0.5 text-sm font-medium">{detail.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20 border-t border-line pt-12">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">You might also like</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
