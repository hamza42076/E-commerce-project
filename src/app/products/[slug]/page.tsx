import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductCard } from "@/components/ProductCard";
import { ProductDetail } from "@/components/product/ProductDetail";
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

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const related = await getRelatedProducts(product);

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
          {product.category.replace(/-/g, " ")}
        </Link>
      </nav>

      {/* Colour selection, gallery, stock and add-to-cart all move together, so
          they live in one client component. */}
      <ProductDetail product={product} />

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
