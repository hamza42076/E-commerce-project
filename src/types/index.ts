export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** Price in PKR (whole rupees, no decimals). */
  price: number;
  /** Original price, shown struck-through when higher than `price`. */
  compareAtPrice?: number;
  category: string;
  /** Image URL. Empty string renders a generated placeholder tile. */
  image: string;
  rating: number;
  reviewCount: number;
  stock: number;
  featured?: boolean;
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

export type CartLine = {
  productId: string;
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

export type OrderItem = {
  productId: string;
  name: string;
  /** Unit price at the time of ordering, so later price edits do not rewrite history. */
  price: number;
  quantity: number;
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
