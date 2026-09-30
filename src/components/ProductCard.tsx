import Link from "next/link";
import { ProductImage } from "./ProductImage";
import { Rating } from "./Rating";
import { AddToCartButton } from "./AddToCartButton";
import { discountPercent, formatPrice } from "@/lib/format";
import type { Product } from "@/types";

export function ProductCard({ product }: { product: Product }) {
  const discount = discountPercent(product.price, product.compareAtPrice);
  const soldOut = product.stock < 1;
  const lowStock = !soldOut && product.stock <= 5;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface-raised transition duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-xl hover:shadow-brand-900/5 dark:hover:shadow-black/30">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-square overflow-hidden"
      >
        <ProductImage
          product={product}
          className="transition duration-500 group-hover:scale-[1.07]"
        />

        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {discount !== null && (
            <span className="rounded-full bg-accent-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
              {discount}% off
            </span>
          )}
          {lowStock && (
            <span className="rounded-full bg-brand-700 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
              Only {product.stock} left
            </span>
          )}
        </div>

        {soldOut && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-semibold uppercase tracking-wide text-white backdrop-blur-[1px]">
            Sold out
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">
          {product.category}
        </p>

        <Link
          href={`/products/${product.slug}`}
          className="line-clamp-2 font-medium leading-snug transition group-hover:text-brand-600"
        >
          {product.name}
        </Link>

        <Rating value={product.rating} reviewCount={product.reviewCount} />

        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <div>
            <p className="text-lg font-semibold">{formatPrice(product.price)}</p>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <p className="text-xs text-subtle line-through">
                {formatPrice(product.compareAtPrice)}
              </p>
            )}
          </div>
          <AddToCartButton product={product} className="shrink-0 px-3 py-2 text-xs" />
        </div>
      </div>
    </article>
  );
}
