import Link from "next/link";
import { ProductImage } from "./ProductImage";
import { Rating } from "./Rating";
import { AddToCartButton } from "./AddToCartButton";
import { discountPercent, formatPrice } from "@/lib/format";
import { defaultVariant, isSoldOut, totalStock } from "@/lib/products/variants";
import type { Product } from "@/types";

/** Display-only dots. Choosing a colour happens on the product page. */
function SwatchRow({ product }: { product: Product }) {
  const shown = product.variants.slice(0, 5);
  const extra = product.variants.length - shown.length;

  return (
    <p className="flex items-center gap-1.5" aria-label={`${product.variants.length} colours`}>
      {shown.map((variant) => (
        <span
          key={variant.color}
          title={variant.color}
          className="h-3.5 w-3.5 rounded-full border border-black/15 dark:border-white/20"
          style={{ backgroundColor: variant.colorCode || "#d4d4d8" }}
        />
      ))}
      <span className="ml-0.5 text-xs text-muted">
        {extra > 0 ? `+${extra} more` : `${product.variants.length} colours`}
      </span>
    </p>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const discount = discountPercent(product.price, product.compareAtPrice);
  const soldOut = isSoldOut(product);
  const remaining = totalStock(product);
  const lowStock = !soldOut && remaining <= 5;
  const multiColour = product.variants.length > 1;

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
          {product.badge && (
            <span className="rounded-full bg-brand-700 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
              {product.badge}
            </span>
          )}
          {lowStock && (
            <span className="rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-semibold text-surface shadow-sm">
              Only {remaining} left
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
        <Link
          href={`/products/${product.slug}`}
          className="line-clamp-2 font-medium leading-snug transition group-hover:text-brand-600"
        >
          {product.name}
        </Link>

        {multiColour && <SwatchRow product={product} />}

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

          {/* With more than one colour there is nothing sensible to add from a
              card, so the card sends you to pick one instead of guessing. */}
          {multiColour && !soldOut ? (
            <Link
              href={`/products/${product.slug}`}
              className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-medium transition hover:border-brand-400 hover:text-brand-600"
            >
              Choose colour
            </Link>
          ) : (
            <AddToCartButton
              product={product}
              color={defaultVariant(product).color}
              className="shrink-0 px-3 py-2 text-xs"
            />
          )}
        </div>
      </div>
    </article>
  );
}
