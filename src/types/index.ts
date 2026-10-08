/**
 * One product contract, used by the admin form, the zod schemas, the server
 * actions, the MongoDB documents, the storefront, the cart, checkout and
 * orders. Field names here are canonical — nothing renames them on the way
 * through.
 */

/**
 * A colour a product comes in, with its own photography and its own stock.
 *
 * This is the single source of truth for colour and for stock. There is no
 * separate `colors: string[]`.
 */
export type ProductVariant = {
  /** Shown to the customer, e.g. "Beige". Unique within a product. */
  color: string;
  /** Hex for the swatch, e.g. "#D8C3A5". Never the only way colour is conveyed. */
  colorCode: string;
  /** Main image for this colour. Empty string falls back to a generated tile. */
  image: string;
  /** Gallery for this colour, `image` first. May be just the one. */
  images: string[];
  /** Stock for this colour alone. */
  stock: number;
};

export type Product = {
  id: string;
  slug: string;
  /** Shop's own code, e.g. "SS-BAG-001". Unique across the catalogue. */
  sku: string;
  name: string;
  description: string;
  /** Price in PKR (whole rupees, no decimals). */
  price: number;
  /** Original price, shown struck-through when higher than `price`. */
  compareAtPrice?: number;
  category: string;
  material?: string;
  strapType?: string;
  /** Optional ribbon, e.g. "New", "Bestseller". */
  badge?: string | null;
  /**
   * Colours this product comes in. Empty for products created before variants
   * existed — those fall back to `image` and `stock` below. Read it through
   * `src/lib/products/variants.ts` rather than branching at each call site.
   */
  variants: ProductVariant[];
  /**
   * Fallback image for a product with no variants. With variants present the
   * selected variant's image wins.
   * @deprecated for new products — put the image on a variant.
   */
  image: string;
  /**
   * Fallback stock for a product with no variants. With variants present the
   * total is the sum of their stock.
   * @deprecated for new products — put the stock on a variant.
   */
  stock: number;
  rating: number;
  reviewCount: number;
  featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type Category = {
  slug: string;
  name: string;
};

export type ProductQuery = {
  search?: string;
  category?: string;
  sort?: "featured" | "price-asc" | "price-desc" | "rating";
};

/**
 * A line in the cart. Two different colours of the same product are two
 * different lines, so the colour is part of the line's identity.
 *
 * `color` is the empty string for a product with no variants.
 */
export type CartLine = {
  productId: string;
  color: string;
  quantity: number;
};

export type UserRole = "customer" | "admin";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

/** A user plus the fields never sent to the client. */
export type UserRecord = User & {
  passwordHash: string;
};

export type OrderStatus = "pending" | "shipped" | "delivered" | "cancelled";

/**
 * What was ordered, snapshotted. Name, price and colour are copied in at order
 * time so an order still reads correctly after the product is edited or
 * deleted.
 */
export type OrderItem = {
  productId: string;
  name: string;
  /** Unit price at the time of ordering, so later price edits do not rewrite history. */
  price: number;
  quantity: number;
  /** Colour ordered. Empty string when the product had no variants. */
  color: string;
  colorCode: string;
  /** Image of the colour ordered, as it was at the time. */
  image: string;
};

export type Order = {
  id: string;
  /** Short human-facing reference, e.g. "SS-1042". */
  reference: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  notes?: string;
  items: OrderItem[];
  subtotal: number;
  delivery: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  /** Set when the order was placed by a signed-in user. */
  userId?: string;
};
