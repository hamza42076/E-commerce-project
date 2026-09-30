import Link from "next/link";
import type { Metadata } from "next";
import { ProductImage } from "@/components/ProductImage";
import { ProductForm } from "@/components/admin/ProductForm";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";
import { getCategories, getProducts } from "@/lib/db/products";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = {
  title: "Products",
};

export default async function AdminProductsPage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <section>
        <p className="mb-4 text-sm text-muted">
          {products.length} {products.length === 1 ? "product" : "products"} listed
        </p>

        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface-raised">
          {products.map((product) => (
            <li key={product.id} className="flex items-center gap-4 p-4">
              <Link
                href={`/products/${product.slug}`}
                className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line"
              >
                <ProductImage product={product} iconClass="h-2/5 w-2/5" />
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/products/${product.slug}`}
                  className="line-clamp-1 font-medium transition hover:text-brand-600"
                >
                  {product.name}
                </Link>
                <p className="mt-0.5 text-xs text-muted">
                  <span className="capitalize">{product.category}</span>
                  {" · "}
                  {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                  {product.featured && " · Featured"}
                </p>
              </div>

              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatPrice(product.price)}
              </span>

              <DeleteProductButton id={product.id} name={product.name} />
            </li>
          ))}
        </ul>
      </section>

      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <ProductForm categories={categories} />
      </aside>
    </div>
  );
}
