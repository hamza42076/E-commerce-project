import type { Product, ProductVariant } from "@/types";

/**
 * The one place that answers "does this product have colours, or is it an older
 * one with a single image and a single stock number?".
 *
 * Every consumer — product card, detail page, cart, checkout, order placing —
 * goes through these, so the backward-compatibility branch is written once
 * instead of at twenty call sites.
 *
 * No "server-only" here: the colour selector on the product page is a client
 * component and uses the same functions the server does.
 */

/** True when the admin has defined colours for this product. */
export function hasVariants(product: Product): boolean {
  return product.variants.length > 0;
}

/**
 * Colours to work with. A product without variants yields one synthetic entry
 * carrying its image and stock, with an empty `color` — that empty string is
 * what "this product has no colour choice" looks like throughout the app. No
 * colour name is invented for it.
 */
export function variantList(product: Product): ProductVariant[] {
  if (product.variants.length > 0) return product.variants;

  return [
    {
      color: "",
      colorCode: "",
      image: product.image,
      images: product.image ? [product.image] : [],
      stock: product.stock,
    },
  ];
}

/** The variant for a colour, or null. An empty colour matches a variantless product. */
export function findVariant(product: Product, color: string): ProductVariant | null {
  return variantList(product).find((variant) => variant.color === color) ?? null;
}

/** What to show first: the cheapest-effort choice that is actually buyable. */
export function defaultVariant(product: Product): ProductVariant {
  const list = variantList(product);
  return list.find((variant) => variant.stock > 0) ?? list[0];
}

/** Stock across every colour. The number to use for "is this buyable at all". */
export function totalStock(product: Product): number {
  if (product.variants.length > 0) {
    return product.variants.reduce((sum, variant) => sum + variant.stock, 0);
  }
  return product.stock;
}

export function isSoldOut(product: Product): boolean {
  return totalStock(product) < 1;
}

/** Image for listings and cards. */
export function primaryImage(product: Product): string {
  return defaultVariant(product).image;
}

/** A variant's gallery, with its main image guaranteed first and no blanks. */
export function galleryFor(variant: ProductVariant): string[] {
  const images = [variant.image, ...variant.images].filter(Boolean);
  return [...new Set(images)];
}

/** Swatches for a card or a selector. Empty when there is no colour choice. */
export function colorOptions(product: Product): ProductVariant[] {
  return product.variants.length > 1 ? product.variants : product.variants.slice(0, 1);
}

/** Identity of a cart line. Two colours of one product are two lines. */
export function cartLineKey(productId: string, color: string): string {
  return `${productId}::${color}`;
}
