import { MongoClient, type Collection, type Db } from "mongodb";
import type { OrderItem, OrderStatus, ProductVariant, UserRole } from "@/types";

/**
 * A single MongoClient is reused for the whole process. In development Next.js
 * reloads modules on every edit, so the promise is parked on `globalThis` to
 * stop each reload from opening another connection pool.
 */

const DEFAULT_DB_NAME = "smartshop";

declare global {
  var __mongoClientPromise: Promise<MongoClient> | undefined;
}

export function isConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env.local and add your connection string.",
    );
  }

  globalThis.__mongoClientPromise ??= new MongoClient(uri).connect();
  return globalThis.__mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB || DEFAULT_DB_NAME);
}

/**
 * Shape of a document in the `products` collection. `_id` is the product id.
 *
 * Mirrors `Product` from `@/types` exactly, minus the renamed id. Fields added
 * when variants arrived are optional here because documents written before then
 * do not have them; `toProduct` fills the gaps. Nothing else in the app sees a
 * product without them.
 */
export type ProductDoc = {
  _id: string;
  slug: string;
  sku?: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  category: string;
  material?: string;
  strapType?: string;
  badge?: string | null;
  variants?: ProductVariant[];
  /** Pre-variant image. Kept so older products keep rendering. */
  image: string;
  /** Pre-variant stock. Kept so older products keep selling. */
  stock: number;
  rating: number;
  reviewCount: number;
  featured?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CategoryDoc = {
  _id: string;
  name: string;
  position: number;
};

export async function productsCollection(): Promise<Collection<ProductDoc>> {
  const db = await getDb();
  return db.collection<ProductDoc>("products");
}

/** `_id` is the user id. `passwordHash` never leaves the server. */
export type UserDoc = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  createdAt: string;
};

/**
 * An item as stored. Colour fields are optional because orders written before
 * variants existed do not have them; `fromDoc` in `orders.ts` fills them in so
 * the rest of the app only ever sees a complete `OrderItem`.
 */
export type StoredOrderItem = Omit<OrderItem, "color" | "colorCode" | "image"> & {
  color?: string;
  colorCode?: string;
  image?: string;
};

/** `_id` is the order id. */
export type OrderDoc = {
  _id: string;
  reference: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  notes?: string;
  items: StoredOrderItem[];
  subtotal: number;
  delivery: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  userId?: string;
};

export async function usersCollection(): Promise<Collection<UserDoc>> {
  const db = await getDb();
  return db.collection<UserDoc>("users");
}

export async function ordersCollection(): Promise<Collection<OrderDoc>> {
  const db = await getDb();
  return db.collection<OrderDoc>("orders");
}

export async function categoriesCollection(): Promise<Collection<CategoryDoc>> {
  const db = await getDb();
  return db.collection<CategoryDoc>("categories");
}
