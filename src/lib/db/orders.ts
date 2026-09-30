import "server-only";
import { randomUUID } from "node:crypto";
import type { Order, OrderItem, OrderStatus } from "@/types";
import { ordersCollection, type OrderDoc } from "./mongo";
import { shouldUseSeedData } from "./fallback";

/**
 * Order storage. Without MongoDB these live in a module-level array seeded with
 * a few sample orders, so the admin dashboard has something to show before the
 * database is wired up. Orders placed in that mode are lost on restart.
 */

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

const SAMPLE_ORDERS: Order[] = [
  {
    id: "sample-1",
    reference: "SS-1001",
    customerName: "Ayesha Khan",
    email: "ayesha@example.com",
    phone: "03001234567",
    address: "House 42, Street 7, Gulberg III",
    city: "Lahore",
    items: [
      { productId: "p-001", name: "Wireless Noise-Cancelling Headphones", price: 24999, quantity: 1 },
      { productId: "p-003", name: "65W USB-C Fast Charger", price: 4299, quantity: 1 },
    ],
    subtotal: 29298,
    delivery: 0,
    total: 29298,
    status: "delivered",
    createdAt: daysAgo(9),
  },
  {
    id: "sample-2",
    reference: "SS-1002",
    customerName: "Bilal Ahmed",
    email: "bilal@example.com",
    phone: "03211234567",
    address: "Flat 5B, Sea Breeze Apartments, Clifton Block 2",
    city: "Karachi",
    items: [{ productId: "p-005", name: "Oversized Cotton Hoodie", price: 4999, quantity: 2 }],
    subtotal: 9998,
    delivery: 0,
    total: 9998,
    status: "shipped",
    createdAt: daysAgo(4),
  },
  {
    id: "sample-3",
    reference: "SS-1003",
    customerName: "Fatima Noor",
    email: "fatima@example.com",
    phone: "03331234567",
    address: "House 12, Street 44, F-11/3",
    city: "Islamabad",
    items: [
      { productId: "p-012", name: "Vitamin C Brightening Serum", price: 3299, quantity: 1 },
      { productId: "p-013", name: "Hydrating Face Moisturiser", price: 2599, quantity: 1 },
    ],
    subtotal: 5898,
    delivery: 0,
    total: 5898,
    status: "pending",
    createdAt: daysAgo(1),
  },
  {
    id: "sample-4",
    reference: "SS-1004",
    customerName: "Usman Tariq",
    email: "usman@example.com",
    phone: "03451234567",
    address: "Shop 8, Saddar Bazaar",
    city: "Rawalpindi",
    items: [{ productId: "p-011", name: "Aromatherapy Oil Diffuser", price: 3799, quantity: 1 }],
    subtotal: 3799,
    delivery: 250,
    total: 4049,
    status: "pending",
    createdAt: daysAgo(0),
  },
  {
    id: "sample-5",
    reference: "SS-1005",
    customerName: "Hira Saleem",
    email: "hira@example.com",
    phone: "03091234567",
    address: "House 90, Phase 5, DHA",
    city: "Lahore",
    items: [{ productId: "p-010", name: "Washed Linen Bedding Set", price: 15999, quantity: 1 }],
    subtotal: 15999,
    delivery: 0,
    total: 15999,
    status: "cancelled",
    createdAt: daysAgo(14),
  },
];

let memoryOrders: Order[] | null = null;

function memoryStore(): Order[] {
  memoryOrders ??= [...SAMPLE_ORDERS];
  return memoryOrders;
}

function fromDoc(doc: OrderDoc): Order {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

function byNewest(a: Order, b: Order): number {
  return b.createdAt.localeCompare(a.createdAt);
}

/** Next reference number, continuing from the highest one already stored. */
async function nextReference(): Promise<string> {
  const orders = await getOrders();
  const highest = orders.reduce((max, order) => {
    const value = Number.parseInt(order.reference.replace(/\D/g, ""), 10);
    return Number.isFinite(value) && value > max ? value : max;
  }, 1000);
  return `SS-${highest + 1}`;
}

export type CreateOrderInput = {
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
  userId?: string;
};

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const order: Order = {
    id: randomUUID(),
    reference: await nextReference(),
    ...input,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  if (shouldUseSeedData()) {
    memoryStore().unshift(order);
    return order;
  }

  const collection = await ordersCollection();
  const { id, ...rest } = order;
  await collection.insertOne({ _id: id, ...rest });
  return order;
}

export async function getOrders(options: { status?: OrderStatus } = {}): Promise<Order[]> {
  if (shouldUseSeedData()) {
    const all = [...memoryStore()].sort(byNewest);
    return options.status ? all.filter((order) => order.status === options.status) : all;
  }

  const collection = await ordersCollection();
  const filter = options.status ? { status: options.status } : {};
  const docs = await collection.find(filter).sort({ createdAt: -1 }).toArray();
  return docs.map(fromDoc);
}

export async function getOrderById(id: string): Promise<Order | null> {
  if (shouldUseSeedData()) {
    return memoryStore().find((order) => order.id === id) ?? null;
  }

  const collection = await ordersCollection();
  const doc = await collection.findOne({ _id: id });
  return doc ? fromDoc(doc) : null;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<boolean> {
  if (shouldUseSeedData()) {
    const order = memoryStore().find((entry) => entry.id === id);
    if (!order) return false;
    order.status = status;
    return true;
  }

  const collection = await ordersCollection();
  const result = await collection.updateOne({ _id: id }, { $set: { status } });
  return result.matchedCount > 0;
}

export type OrderStats = {
  totalOrders: number;
  /** Revenue excludes cancelled orders. */
  revenue: number;
  pending: number;
  delivered: number;
  itemsSold: number;
};

export async function getOrderStats(): Promise<OrderStats> {
  const orders = await getOrders();
  const counted = orders.filter((order) => order.status !== "cancelled");

  return {
    totalOrders: orders.length,
    revenue: counted.reduce((sum, order) => sum + order.total, 0),
    pending: orders.filter((order) => order.status === "pending").length,
    delivered: orders.filter((order) => order.status === "delivered").length,
    itemsSold: counted.reduce(
      (sum, order) => sum + order.items.reduce((n, item) => n + item.quantity, 0),
      0,
    ),
  };
}
