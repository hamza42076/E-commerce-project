"use client";

import { useState } from "react";
import { ProductImage } from "@/components/ProductImage";
import { Rating } from "@/components/Rating";
import { QuantityStepper } from "@/components/QuantityStepper";
import { AddToCartButton } from "@/components/AddToCartButton";
import { WishlistButton } from "@/components/WishlistButton";
import { ColorSwatches } from "./ColorSwatches";
import { discountPercent, formatPrice } from "@/lib/format";
import { defaultVariant, galleryFor, hasVariants } from "@/lib/products/variants";
import { STORE_POLICIES } from "@/lib/store-policy";
import { hasVideo, videoPoster } from "@/lib/products/video";
import type { Product } from "@/types";

/**
 * The interactive half of the product page.
 *
 * The gallery, the stock line, the quantity cap and the cart line all follow the
 * selected colour, so they share one piece of state and therefore one component.
 * Everything it reads comes from the variant the customer picked — nothing here
 * decides a price or a stock number on its own.
 */
export function ProductDetail({ product }: { product: Product }) {
  const [color, setColor] = useState(() => defaultVariant(product).color);
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  /**
   * Whether the main square is showing the video instead of a photo.
   *
   * Kept apart from `imageIndex` rather than folded in as one more gallery
   * slot: the video belongs to the product and the photos belong to the
   * colour, so a single index would have to mean two different things
   * depending on where it pointed.
   */
  const [playing, setPlaying] = useState(false);

  const variant =
    product.variants.find((entry) => entry.color === color) ?? defaultVariant(product);
  const gallery = galleryFor(variant);
  const discount = discountPercent(product.price, product.compareAtPrice);
  const saving =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? product.compareAtPrice - product.price
      : null;
  const soldOut = variant.stock < 1;
  const multiColour = product.variants.length > 1;

  const video = hasVideo(product.video) ? product.video : null;
  // Falls back to the colour's own photo when the video is hosted somewhere
  // Cloudinary cannot render a frame from.
  const poster = video ? (videoPoster(video) ?? variant.image) : null;

  function chooseColor(next: string) {
    setColor(next);
    // The new colour has its own pictures, so start at its first one rather than
    // holding an index that pointed into the old colour's gallery.
    setImageIndex(0);
    // Switching colour is a request to look at that colour, so the video steps
    // out of the way.
    setPlaying(false);
    // And its own stock, which may be lower than what was already selected.
    const nextStock =
      product.variants.find((entry) => entry.color === next)?.stock ?? 0;
    setQuantity((current) => Math.max(1, Math.min(current, nextStock || 1)));
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      {/* Gallery */}
      <div>
        <div className="relative aspect-square overflow-hidden rounded-3xl border border-line">
          {playing && video ? (
            <video
              // Keyed by URL so swapping products in a client transition gives
              // a fresh element rather than a player still holding the old file.
              key={video}
              src={video}
              poster={poster ?? undefined}
              controls
              // Safe to start on its own *because* this element only exists
              // after a click on "Watch video" — nothing plays on page load.
              // The click is also the user gesture browsers require before
              // they will allow sound.
              autoPlay
              // Keeps iOS playing it in place rather than seizing the screen.
              playsInline
              preload="metadata"
              className="h-full w-full bg-black object-contain"
            >
              Your browser cannot play this video.
            </video>
          ) : (
            <ProductImage
              product={product}
              src={gallery[imageIndex] ?? variant.image}
              alt={variant.color ? `${product.name} in ${variant.color}` : product.name}
              iconClass="h-2/5 w-2/5"
            />
          )}

          {/*
            A second way in, for the majority who never look at a thumbnail
            strip. Hidden while the video is open so it cannot cover the
            player's own controls.
          */}
          {video && !playing && (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="group absolute inset-0 flex items-center justify-center focus-visible:outline-none"
              aria-label="Play the product video"
            >
              <span className="flex items-center gap-2 rounded-full bg-black/55 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition group-hover:bg-black/70 group-focus-visible:ring-4 group-focus-visible:ring-white/40">
                <PlayIcon className="h-4 w-4" />
                Watch video
              </span>
            </button>
          )}

          <div className="absolute left-4 top-4 flex flex-col items-start gap-2">
            {discount !== null && (
              <span className="rounded-full bg-accent-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm">
                {discount}% off
              </span>
            )}
            {product.badge && (
              <span className="rounded-full bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
                {product.badge}
              </span>
            )}
          </div>
        </div>

        {/*
          A single photo needs no strip, but a single photo plus a video does —
          otherwise there is no way back to the picture once the video opens.
        */}
        {(gallery.length > 1 || video) && (
          <ul className="mt-3 flex flex-wrap gap-2.5">
            {gallery.map((src, index) => {
              const current = index === imageIndex && !playing;
              return (
                <li key={`${src}-${index}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setImageIndex(index);
                      setPlaying(false);
                    }}
                    aria-label={`Image ${index + 1} of ${gallery.length}`}
                    aria-current={current}
                    className={`h-16 w-16 overflow-hidden rounded-xl border transition ${
                      current
                        ? "border-brand-600 ring-2 ring-brand-500/30"
                        : "border-line hover:border-brand-400"
                    }`}
                  >
                    <ProductImage
                      product={product}
                      src={src}
                      alt=""
                      iconClass="h-2/5 w-2/5"
                    />
                  </button>
                </li>
              );
            })}

            {video && (
              <li>
                <button
                  type="button"
                  onClick={() => setPlaying(true)}
                  aria-label="Play the product video"
                  aria-current={playing}
                  className={`relative h-16 w-16 overflow-hidden rounded-xl border transition ${
                    playing
                      ? "border-brand-600 ring-2 ring-brand-500/30"
                      : "border-line hover:border-brand-400"
                  }`}
                >
                  {poster ? (
                    // The still frame, not the video file: a <video> here would
                    // make the browser fetch part of the clip to draw a 64px box.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={poster} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="block h-full w-full bg-surface-sunken" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                    <PlayIcon className="h-5 w-5 text-white drop-shadow" />
                  </span>
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Purchase column */}
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-subtle">
            {product.category.replace(/-/g, " ")}
            {product.sku && <span className="ml-2 font-mono normal-case">{product.sku}</span>}
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

          {/* Colours */}
          {hasVariants(product) && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-sm">
                <span className="text-muted">Colour: </span>
                <span className="font-medium">{variant.color}</span>
              </p>

              {multiColour ? (
                <div className="mt-3">
                  <ColorSwatches
                    variants={product.variants}
                    selected={color}
                    onSelect={chooseColor}
                  />
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted">
                  This one comes in {variant.color} only.
                </p>
              )}
            </div>
          )}

          {/* Stock, for the selected colour */}
          <p className="mt-4 flex items-center gap-2 text-sm">
            <span
              className={`h-2 w-2 rounded-full ${
                soldOut ? "bg-rose-500" : variant.stock <= 5 ? "bg-accent-500" : "bg-emerald-500"
              }`}
            />
            {soldOut ? (
              <span className="text-rose-600 dark:text-rose-400">
                {variant.color ? `${variant.color} is out of stock` : "Out of stock"}
              </span>
            ) : variant.stock <= 5 ? (
              <span className="text-accent-600 dark:text-accent-400">
                Only {variant.stock} left{variant.color && ` in ${variant.color}`}
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">
                {variant.stock} available{variant.color && ` in ${variant.color}`}
              </span>
            )}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {!soldOut && (
              <QuantityStepper
                value={quantity}
                max={variant.stock}
                onChange={(next) => setQuantity(Math.max(1, Math.min(next, variant.stock)))}
              />
            )}
            <AddToCartButton
              product={product}
              color={variant.color}
              quantity={quantity}
              revealCart
              className="flex-1 py-3"
            />
            <WishlistButton
              productId={product.id}
              productName={product.name}
              label="Save"
              className="rounded-lg px-4 py-3"
            />
          </div>
        </div>

        <p className="leading-relaxed text-muted">{product.description}</p>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
          {[
            ...(product.material ? [{ label: "Material", value: product.material }] : []),
            ...(product.strapType ? [{ label: "Strap", value: product.strapType }] : []),
            { label: "Delivery", value: STORE_POLICIES.shipping.deliveryWindow },
            { label: "Returns", value: STORE_POLICIES.returns.wording },
            { label: "Payment", value: "Cash on delivery" },
          ].map((detail) => (
            <div key={detail.label} className="bg-surface p-4">
              <dt className="text-xs text-muted">{detail.label}</dt>
              <dd className="mt-0.5 text-sm font-medium">{detail.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** Solid triangle, nudged right so it reads as centred inside a circle. */
function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11.14-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}
