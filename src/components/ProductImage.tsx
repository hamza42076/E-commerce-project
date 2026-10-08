import { primaryImage } from "@/lib/products/variants";
import type { Product } from "@/types";

/**
 * Shows the product photo when `product.image` is set, otherwise draws a
 * category illustration on a tinted panel so a catalogue without photography
 * still looks deliberate. Drop a URL into `image` and it takes over.
 */

type Art = {
  /** Tailwind gradient stops for the panel. */
  panel: string;
  icon: React.ReactNode;
};

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

// Built from the two brand colours only, varied by shade and direction. Keys
// are category slugs; anything without an entry falls back below, so adding a
// category does not break the tiles.
const ART: Record<string, Art> = {
  "ladies-bags": {
    panel: "from-accent-400/20 via-accent-300/10 to-brand-500/20 text-accent-700 dark:text-accent-300",
    icon: (
      <g {...strokeProps}>
        <path d="M4.5 8.5h15l-1.2 10.2a1.8 1.8 0 01-1.8 1.6H7.5a1.8 1.8 0 01-1.8-1.6z" />
        <path d="M8.5 8.5V6.8a3.5 3.5 0 017 0v1.7" />
      </g>
    ),
  },
  electronics: {
    panel: "from-brand-500/20 via-brand-400/10 to-brand-700/25 text-brand-700 dark:text-brand-300",
    icon: (
      <g {...strokeProps}>
        <path d="M5 15v-3a7 7 0 0114 0v3" />
        <rect x="3" y="14.5" width="4" height="6" rx="1.6" />
        <rect x="17" y="14.5" width="4" height="6" rx="1.6" />
      </g>
    ),
  },
  fashion: {
    panel: "from-accent-500/20 via-accent-400/10 to-accent-600/25 text-accent-700 dark:text-accent-300",
    icon: (
      <g {...strokeProps}>
        <path d="M9 3.5l3 2 3-2 5 2.5-1.8 4L16 9.4V20.5H8V9.4l-2.2.6L4 6z" />
      </g>
    ),
  },
  home: {
    panel: "from-brand-600/20 via-brand-500/10 to-accent-400/20 text-brand-700 dark:text-brand-300",
    icon: (
      <g {...strokeProps}>
        <path d="M3.5 10.5L12 3.5l8.5 7" />
        <path d="M5.5 9.6V20.5h13V9.6" />
        <path d="M9.8 20.5v-5.6h4.4v5.6" />
      </g>
    ),
  },
  beauty: {
    panel: "from-accent-600/20 via-accent-400/10 to-brand-400/20 text-accent-700 dark:text-accent-300",
    icon: (
      <g {...strokeProps}>
        <path d="M10 3.5h4v2.6l2.2 2.6a4 4 0 011 2.6v7.2a2 2 0 01-2 2H8.8a2 2 0 01-2-2v-7.2a4 4 0 011-2.6L10 6.1z" />
        <path d="M7.4 12.6h9.2" />
      </g>
    ),
  },
};

const FALLBACK: Art = {
  panel: "from-brand-500/15 via-brand-400/10 to-brand-600/20 text-brand-700 dark:text-brand-300",
  icon: (
    <g {...strokeProps}>
      <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
      <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" />
    </g>
  ),
};

export function ProductImage({
  product,
  src,
  alt,
  className = "",
  iconClass = "h-1/3 w-1/3",
}: {
  product: Product;
  /**
   * Which image to draw. Defaults to the product's primary variant image, but
   * the detail page passes the selected colour's image so the picture changes
   * with the swatch.
   */
  src?: string;
  alt?: string;
  className?: string;
  iconClass?: string;
}) {
  const resolved = src ?? primaryImage(product);
  const label = alt ?? product.name;

  if (resolved) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolved}
        alt={label}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  const art = ART[product.category] ?? FALLBACK;

  return (
    <div
      role="img"
      aria-label={label}
      className={`relative flex h-full w-full items-center justify-center bg-gradient-to-br ${art.panel} ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.45),transparent_60%)] dark:bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_60%)]" />
      <svg viewBox="0 0 24 24" className={`relative ${iconClass}`} aria-hidden="true">
        {art.icon}
      </svg>
    </div>
  );
}
