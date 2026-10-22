import "server-only";
import { randomUUID } from "node:crypto";
import type { ClientSession, Filter } from "mongodb";
import type { Order, OrderItem, OrderStatus, OrderStatusChange, PaymentStatus } from "@/types";
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

type SampleOrder = Omit<Order, "paymentMethod" | "paymentStatus" | "statusHistory" | "updatedAt">;

const SAMPLE_ORDERS: SampleOrder[] = [
  {
    id: "sample-1",
    reference: "SS-1001",
    customerName: "Ayesha Khan",
    email: "ayesha@example.com",
    phone: "03001234567",
    address: "House 42, Street 7, Gulberg III",
    city: "Lahore",
    items: [
      { productId: "p-001", name: "Wireless Noise-Cancelling Headphones", price: 24999, quantity: 1, color: "", colorCode: "", image: "" },
      { productId: "p-003", name: "65W USB-C Fast Charger", price: 4299, quantity: 1, color: "", colorCode: "", image: "" },
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
    items: [{ productId: "p-005", name: "Oversized Cotton Hoodie", price: 4999, quantity: 2, color: "", colorCode: "", image: "" }],
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
      { productId: "p-012", name: "Vitamin C Brightening Serum", price: 3299, quantity: 1, color: "", colorCode: "", image: "" },
      { productId: "p-013", name: "Hydrating Face Moisturiser", price: 2599, quantity: 1, color: "", colorCode: "", image: "" },
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
    items: [{ productId: "p-011", name: "Aromatherapy Oil Diffuser", price: 3799, quantity: 1, color: "", colorCode: "", image: "" }],
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
    items: [{ productId: "p-010", name: "Washed Linen Bedding Set", price: 15999, quantity: 1, color: "", colorCode: "", image: "" }],
    subtotal: 15999,
    delivery: 0,
    total: 15999,
    status: "cancelled",
    createdAt: daysAgo(14),
  },
];

let memoryOrders: Order[] | null = null;

function memoryStore(): Order[] {
  memoryOrders ??= SAMPLE_ORDERS.map((order) => ({
    ...order,
    paymentMethod: "cod",
    paymentStatus: "pending",
    statusHistory: [
      {
        status: order.status,
        at: order.createdAt,
        actorId: order.userId ?? "system",
        actorRole: order.userId ? "customer" : "admin",
      },
    ],
    updatedAt: order.createdAt,
  }));
  return memoryOrders;
}

function fromDoc(doc: OrderDoc): Order {
  const { _id, ...rest } = doc;
  const status = rest.status;
  const createdAt = rest.createdAt;
  return {
    id: _id,
    ...rest,
    paymentMethod: rest.paymentMethod ?? "cod",
    paymentStatus: rest.paymentStatus ?? "pending",
    statusHistory:
      rest.statusHistory ??
      [{ status, at: createdAt, actorId: rest.userId ?? "system", actorRole: rest.userId ? "customer" : "admin" }],
    updatedAt: rest.updatedAt ?? createdAt,
    // Orders written before colours existed have items without them. Filling
    // the gaps here means nothing downstream has to check.
    items: rest.items.map((item) => ({
      ...item,
      color: item.color ?? "",
      colorCode: item.colorCode ?? "",
      image: item.image ?? "",
    })),
  };
}

function byNewest(a: Order, b: Order): number {
  return b.createdAt.localeCompare(a.createdAt);
}

function newReference(): string {
  return `SS-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
}

export type CreateOrderInput = {
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  area?: string;
  province?: string;
  postalCode?: string;
  notes?: string;
  items: OrderItem[];
  subtotal: number;
  delivery: number;
  total: number;
  userId: string;
  idempotencyKey: string;
  actorId: string;
};

export async function findOrderByIdempotencyKey(
  userId: string,
  idempotencyKey: string,
  session?: ClientSession,
): Promise<Order | null> {
  if (shouldUseSeedData()) {
    const found = memoryStore().find(
      (order) => order.userId === userId && order.idempotencyKey === idempotencyKey,
    );
    return found ?? null;
  }

  const collection = await ordersCollection();
  const doc = await collection.findOne({ userId, idempotencyKey }, { session });
  return doc ? fromDoc(doc) : null;
}

export async function createOrder(
  input: CreateOrderInput,
  session?: ClientSession,
): Promise<Order> {
  const now = new Date().toISOString();
  const order: Order = {
    id: randomUUID(),
    reference: newReference(),
    ...input,
    paymentMethod: "cod",
    paymentStatus: "pending",
    status: "pending",
    statusHistory: [
      { status: "pending", at: now, actorId: input.actorId, actorRole: "customer" },
    ],
    createdAt: now,
    updatedAt: now,
  };

  if (shouldUseSeedData()) {
    memoryStore().unshift(order);
    return order;
  }

  const collection = await ordersCollection();
  const { id, ...rest } = order;
  await collection.insertOne({ _id: id, ...rest }, { session });
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

export type OrderPageQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  from?: string;
  to?: string;
};

export type OrderPage = { orders: Order[]; total: number; page: number; pageSize: number };

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getOrdersPage(query: OrderPageQuery): Promise<OrderPage> {
  const pageSize = Math.min(50, Math.max(1, Math.floor(query.pageSize)));
  const requestedPage = Math.max(1, Math.floor(query.page));
  const search = query.search?.trim().slice(0, 80);
  const validDate = (value?: string) =>
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
      ? value
      : undefined;
  const from = validDate(query.from);
  const to = validDate(query.to);
  const dateFilter: { $gte?: string; $lte?: string } = {};
  if (from) dateFilter.$gte = `${from}T00:00:00.000Z`;
  if (to) dateFilter.$lte = `${to}T23:59:59.999Z`;

  if (shouldUseSeedData()) {
    const filtered = memoryStore().filter((order) => {
      if (query.status && order.status !== query.status) return false;
      if (query.paymentStatus && (order.paymentStatus ?? "pending") !== query.paymentStatus) return false;
      if (from && order.createdAt < `${from}T00:00:00.000Z`) return false;
      if (to && order.createdAt.slice(0, 10) > to) return false;
      if (
        search &&
        ![order.reference, order.customerName, order.phone]
          .some((value) => value.toLowerCase().includes(search.toLowerCase()))
      ) {
        return false;
      }
      return true;
    }).sort(byNewest);
    const page = Math.min(requestedPage, Math.max(1, Math.ceil(filtered.length / pageSize)));
    return {
      orders: filtered.slice((page - 1) * pageSize, page * pageSize),
      total: filtered.length,
      page,
      pageSize,
    };
  }

  const filter: Filter<OrderDoc> = {};
  const conditions: Filter<OrderDoc>[] = [];
  if (query.status) filter.status = query.status;
  if (query.paymentStatus === "paid") filter.paymentStatus = "paid";
  if (query.paymentStatus === "pending") {
    conditions.push({ $or: [{ paymentStatus: "pending" }, { paymentStatus: { $exists: false } }] });
  }
  if (Object.keys(dateFilter).length > 0) filter.createdAt = dateFilter;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    conditions.push({ $or: [{ reference: pattern }, { customerName: pattern }, { phone: pattern }] });
  }
  if (conditions.length > 0) filter.$and = conditions;

  const collection = await ordersCollection();
  const total = await collection.countDocuments(filter);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));
  const docs = await collection
    .find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .toArray();
  return { orders: docs.map(fromDoc), total, page, pageSize };
}

/** Orders placed by one account, newest first. */
export async function getOrdersByUser(userId: string): Promise<Order[]> {
  if (shouldUseSeedData()) {
    return memoryStore()
      .filter((order) => order.userId === userId)
      .sort(byNewest);
  }

  const collection = await ordersCollection();
  const docs = await collection.find({ userId }).sort({ createdAt: -1 }).toArray();
  return docs.map(fromDoc);
}

export async function getOrderById(
  id: string,
  session?: ClientSession,
): Promise<Order | null> {
  if (shouldUseSeedData()) {
    return memoryStore().find((order) => order.id === id) ?? null;
  }

  const collection = await ordersCollection();
  const doc = await collection.findOne({ _id: id }, { session });
  return doc ? fromDoc(doc) : null;
}

export async function updateOrderStatus(
  id: string,
  expectedStatus: OrderStatus,
  status: OrderStatus,
  change: OrderStatusChange,
  options: { restoreInventory?: boolean; session?: ClientSession } = {},
): Promise<boolean> {
  const now = change.at;
  if (shouldUseSeedData()) {
    const order = memoryStore().find((entry) => entry.id === id);
    if (!order || order.status !== expectedStatus) return false;
    order.status = status;
    order.updatedAt = now;
    order.statusHistory.push(change);
    if (options.restoreInventory) order.inventoryRestoredAt = now;
    return true;
  }

  const collection = await ordersCollection();
  const set: Record<string, unknown> = { status, updatedAt: now };
  if (options.restoreInventory) set.inventoryRestoredAt = now;
  const result = await collection.updateOne(
    {
      _id: id,
      status: expectedStatus,
      ...(options.restoreInventory ? { inventoryRestoredAt: { $exists: false } } : {}),
    },
    { $set: set, $push: { statusHistory: change } },
    { session: options.session },
  );
  return result.matchedCount > 0;
}

export async function markCodPaymentCollected(
  id: string,
  adminId: string,
  session?: ClientSession,
): Promise<boolean> {
  const now = new Date().toISOString();
  if (shouldUseSeedData()) {
    const order = memoryStore().find((entry) => entry.id === id);
    if (!order || order.status !== "delivered" || order.paymentStatus === "paid") return false;
    order.paymentStatus = "paid";
    order.paidAt = now;
    order.paidBy = adminId;
    order.updatedAt = now;
    return true;
  }

  const collection = await ordersCollection();
  const result = await collection.updateOne(
    { _id: id, status: "delivered", paymentStatus: { $ne: "paid" } },
    { $set: { paymentStatus: "paid", paidAt: now, paidBy: adminId, updatedAt: now } },
    { session },
  );
  return result.modifiedCount === 1;
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
