import Link from "next/link";
import type { Metadata } from "next";
import { ProductImage } from "@/components/ProductImage";
import { ProductForm } from "@/components/admin/ProductForm";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";
import { getCategories, getProducts } from "@/lib/db/products";
import { formatPrice } from "@/lib/format";
import { totalStock } from "@/lib/products/variants";

export const metadata: Metadata = {
  title: "Products",
};

export default async function AdminProductsPage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_26rem]">
      <section>
        <p className="mb-4 text-sm text-muted">
          {products.length} {products.length === 1 ? "product" : "products"} listed
        </p>

        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface-raised">
          {products.map((product) => {
            const stock = totalStock(product);

            return (
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
                    {product.sku && <span className="font-mono">{product.sku}</span>}
                    {product.sku && " · "}
                    {stock > 0 ? `${stock} in stock` : "Out of stock"}
                    {product.badge && ` · ${product.badge}`}
                    {product.featured && " · Featured"}
                  </p>

                  {product.variants.length > 0 && (
                    <p className="mt-1.5 flex items-center gap-1.5">
                      {product.variants.slice(0, 6).map((variant) => (
                        <span
                          key={variant.color}
                          title={`${variant.color}: ${variant.stock} in stock`}
                          className="h-3 w-3 rounded-full border border-black/15 dark:border-white/20"
                          style={{ backgroundColor: variant.colorCode || "#d4d4d8" }}
                        />
                      ))}
                      <span className="ml-0.5 text-xs text-subtle">
                        {product.variants.length}{" "}
                        {product.variants.length === 1 ? "colour" : "colours"}
                      </span>
                    </p>
                  )}
                </div>

                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatPrice(product.price)}
                </span>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Link
                    href={`/admin/products/${product.slug}/edit`}
                    className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition hover:border-brand-400 hover:text-brand-600"
                  >
                    Edit
                  </Link>
                  <DeleteProductButton id={product.id} name={product.name} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="lg:sticky lg:top-24 lg:h-fit">
        <ProductForm categories={categories} />
      </aside>
    </div>
  );
}
