"use client";

import type { ProductVariant } from "@/types";

/**
 * Colour picker for the product page.
 *
 * Colour is never the only channel: every swatch carries its name underneath,
 * the selected one is named in text above, and selection is marked with a ring
 * and a tick rather than by hue alone. A swatch with no hex code falls back to a
 * neutral tile with its initial, so a colour the admin did not give a code to is
 * still distinguishable.
 */
export function ColorSwatches({
  variants,
  selected,
  onSelect,
}: {
  variants: ProductVariant[];
  selected: string;
  onSelect: (color: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-3">
      {variants.map((variant) => {
        const active = variant.color === selected;
        const soldOut = variant.stock < 1;

        return (
          <button
            key={variant.color}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(variant.color)}
            title={soldOut ? `${variant.color} — sold out` : variant.color}
            className="group flex w-16 flex-col items-center gap-1.5"
          >
            <span
              className={`relative flex h-11 w-11 items-center justify-center rounded-full border transition ${
                active
                  ? "border-brand-600 ring-2 ring-brand-500/40 scale-105"
                  : "border-line group-hover:border-brand-400"
              }`}
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-[10px] font-semibold text-white/80"
                style={{ backgroundColor: variant.colorCode || "#d4d4d8" }}
              >
                {variant.colorCode ? "" : variant.color.charAt(0).toUpperCase()}
              </span>

              {active && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-white">
                  <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" aria-hidden="true">
                    <path
                      d="M5 12.5l4.2 4.2L19 7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}

              {soldOut && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-full bg-surface/55"
                />
              )}
            </span>

            <span
              className={`text-center text-[11px] leading-tight ${
                active ? "font-medium text-ink" : "text-muted"
              }`}
            >
              {variant.color}
            </span>
          </button>
        );
      })}
    </div>
  );
}
