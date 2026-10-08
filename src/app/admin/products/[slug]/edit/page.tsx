import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/ProductForm";
import { getCategories, getProductBySlug } from "@/lib/db/products";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  return { title: product ? `Edit ${product.name}` : "Edit product" };
}

/**
 * The admin layout already refuses anyone who is not an admin, and
 * `updateProductAction` checks again on its own — a server action is its own
 * endpoint and cannot lean on the page that rendered the form.
 */
export default async function EditProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [product, categories] = await Promise.all([
    getProductBySlug(slug),
    getCategories(),
  ]);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <nav className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Link href="/admin/products" className="transition hover:text-brand-600">
          Products
        </Link>
        <span className="text-subtle">/</span>
        <span className="truncate text-ink">{product.name}</span>
      </nav>

      <ProductForm categories={categories} product={product} />

      <p className="mt-4 text-center text-xs text-subtle">
        Saving keeps the same URL unless you change the name.
      </p>
    </div>
  );
}
