import "server-only";
import { randomUUID } from "node:crypto";
import type { ClientSession, Filter, Sort } from "mongodb";
import type { Category, Product, ProductQuery, ProductVariant } from "@/types";
import { categoriesCollection, productsCollection, type ProductDoc } from "./mongo";
import { shouldUseSeedData } from "./fallback";
import { seedCategories, seedProducts } from "./seed-products";
import { variantList } from "@/lib/products/variants";

/**
 * Data access layer. Every product read and write in the app goes through this
 * file. See `fallback.ts` for what happens without a connection string.
 */

/** What the admin form and the API both hand in to create or update a product. */
export type ProductInput = {
  name: string;
  description: string;
  category: string;
  sku: string;
  price: number;
  compareAtPrice?: number;
  material?: string;
  strapType?: string;
  badge?: string | null;
  video?: string;
  featured: boolean;
  variants: ProductVariant[];
};

/**
 * Fills in the fields added when variants arrived, so the rest of the app never
 * has to deal with a half-shaped product. Documents written before then keep
 * their `image` and `stock`; `variants` stays empty and the helpers in
 * `lib/products/variants.ts` fall back to those two.
 */
function toProduct(doc: ProductDoc): Product {
  const { _id, ...rest } = doc;
  return {
    id: _id,
    ...rest,
    sku: doc.sku ?? "",
    variants: doc.variants ?? [],
    badge: doc.badge ?? null,
    material: doc.material ?? "",
    strapType: doc.strapType ?? "",
  };
}

/** Escape user input before putting it in a $regex. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFilter(query: ProductQuery): Filter<ProductDoc> {
  const filter: Filter<ProductDoc> = {};

  if (query.category && query.category !== "all") {
    filter.category = query.category;
  }

  const term = query.search?.trim();
  if (term) {
    const pattern = new RegExp(escapeRegex(term), "i");
    filter.$or = [
      { name: pattern },
      { description: pattern },
      { category: pattern },
      { sku: pattern },
      // So "black bag" finds a bag that comes in black.
      { "variants.color": pattern },
    ];
  }

  return filter;
}

function buildSort(sort: ProductQuery["sort"]): Sort {
  switch (sort) {
    case "price-asc":
      return { price: 1 };
    case "price-desc":
      return { price: -1 };
    case "rating":
      return { rating: -1 };
    default:
      return { featured: -1, _id: 1 };
  }
}

// --- Fallback helpers, mirroring the queries above against the seed array ----

function matchesSearch(product: Product, term: string): boolean {
  const needle = term.toLowerCase();
  return (
    product.name.toLowerCase().includes(needle) ||
    product.description.toLowerCase().includes(needle) ||
    product.category.toLowerCase().includes(needle) ||
    product.sku.toLowerCase().includes(needle) ||
    product.variants.some((variant) => variant.color.toLowerCase().includes(needle))
  );
}

function fallbackProducts(query: ProductQuery = {}): Product[] {
  const { search, category, sort = "featured" } = query;
  let results = seedProducts;

  if (category && category !== "all") {
    results = results.filter((p) => p.category === category);
  }
  if (search?.trim()) {
    results = results.filter((p) => matchesSearch(p, search.trim()));
  }

  const sorted = [...results];
  switch (sort) {
    case "price-asc":
      sorted.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      sorted.sort((a, b) => b.price - a.price);
      break;
    case "rating":
      sorted.sort((a, b) => b.rating - a.rating);
      break;
    default:
      sorted.sort(
        (a, b) =>
          Number(b.featured ?? false) - Number(a.featured ?? false) || a.id.localeCompare(b.id),
      );
  }
  return sorted;
}

// --- Reads ------------------------------------------------------------------

export async function getCategories(): Promise<Category[]> {
  if (shouldUseSeedData()) return seedCategories;

  const collection = await categoriesCollection();
  const docs = await collection.find({}).sort({ position: 1 }).toArray();
  return docs.map((doc) => ({ slug: doc._id, name: doc.name }));
}

export async function getProducts(query: ProductQuery = {}): Promise<Product[]> {
  if (shouldUseSeedData()) return fallbackProducts(query);

  const collection = await productsCollection();
  const docs = await collection.find(buildFilter(query)).sort(buildSort(query.sort)).toArray();
  return docs.map(toProduct);
}

export type AssistantProductSearch = {
  keywords?: string[];
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  color?: string;
  inStockOnly?: boolean;
  material?: string;
};

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchesAssistantSearch(product: Product, query: AssistantProductSearch): boolean {
  if (query.category && normalized(product.category) !== normalized(query.category)) return false;
  if (query.minPrice !== undefined && product.price < query.minPrice) return false;
  if (query.maxPrice !== undefined && product.price > query.maxPrice) return false;

  const variants = variantList(product);
  if (query.color && !variants.some((variant) => normalized(variant.color).includes(normalized(query.color!)))) {
    return false;
  }
  if (query.inStockOnly && !variants.some((variant) => variant.stock > 0)) return false;
  if (
    query.material &&
    !normalized(product.material ?? "").includes(normalized(query.material))
  ) {
    return false;
  }

  const searchable = normalized(
    [
      product.name,
      product.slug,
      product.category,
      product.description,
      product.material,
      product.strapType,
      ...variants.map((variant) => variant.color),
    ]
      .filter(Boolean)
      .join(" "),
  );
  return (query.keywords ?? []).every((keyword) => {
    const word = normalized(keyword);
    return searchable.includes(word) || (word.endsWith("s") && searchable.includes(word.slice(0, -1)));
  });
}

/**
 * Bounded assistant search. MongoDB applies structured filters and caps
 * candidates before relevance ranking; only the selected products leave this
 * repository.
 */
export async function searchProductsForAssistant(
  query: AssistantProductSearch,
  limit = 6,
): Promise<Product[]> {
  const boundedLimit = Math.min(6, Math.max(1, Math.floor(limit)));
  if (shouldUseSeedData()) {
    return seedProducts
      .filter((product) => matchesAssistantSearch(product, query))
      .sort(
        (a, b) =>
          Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
          a.price - b.price ||
          a.id.localeCompare(b.id),
      )
      .slice(0, boundedLimit);
  }

  const filter: Filter<ProductDoc> = {};
  const conditions: Filter<ProductDoc>[] = [];

  if (query.category) filter.category = new RegExp(`^${escapeRegex(query.category)}$`, "i");
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {
      ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
      ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
    };
  }
  if (query.color) {
    filter.$or = [{ "variants.color": new RegExp(escapeRegex(query.color), "i") }];
  }
  if (query.material) {
    filter.material = new RegExp(escapeRegex(query.material), "i");
  }
  if (query.inStockOnly) {
    conditions.push({
      $or: [
        { variants: { $elemMatch: { stock: { $gt: 0 } } } },
        { variants: { $exists: false }, stock: { $gt: 0 } },
        { variants: { $size: 0 }, stock: { $gt: 0 } },
      ],
    });
  }

  for (const keyword of query.keywords ?? []) {
    const pattern = new RegExp(escapeRegex(keyword), "i");
    conditions.push({
      $or: [
        { name: pattern },
        { slug: pattern },
        { description: pattern },
        { category: pattern },
        { material: pattern },
        { strapType: pattern },
        { "variants.color": pattern },
      ],
    });
  }

  if (conditions.length > 0) {
    filter.$and = [...(filter.$and ?? []), ...conditions];
  }
  const collection = await productsCollection();
  const candidates = await collection
    .find(filter)
    .sort({ featured: -1, _id: 1 })
    .limit(100)
    .toArray();

  return candidates
    .map(toProduct)
    .filter((product) => matchesAssistantSearch(product, query))
    .sort(
      (a, b) =>
        Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
        a.price - b.price ||
        a.id.localeCompare(b.id),
    )
    .slice(0, boundedLimit);
}

export async function getFeaturedProducts(limit = 4): Promise<Product[]> {
  if (shouldUseSeedData()) {
    return seedProducts
      .filter((p) => p.featured)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      .slice(0, limit);
  }

  const collection = await productsCollection();
  const docs = await collection
    .find({ featured: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toProduct);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (shouldUseSeedData()) return seedProducts.find((p) => p.slug === slug) ?? null;

  const collection = await productsCollection();
  const doc = await collection.findOne({ slug });
  return doc ? toProduct(doc) : null;
}

export async function getProductById(
  id: string,
  session?: ClientSession,
): Promise<Product | null> {
  if (shouldUseSeedData()) return seedProducts.find((p) => p.id === id) ?? null;

  const collection = await productsCollection();
  const doc = await collection.findOne({ _id: id }, { session });
  return doc ? toProduct(doc) : null;
}

export async function getProductsByIds(
  ids: string[],
  session?: ClientSession,
): Promise<Product[]> {
  if (ids.length === 0) return [];
  if (shouldUseSeedData()) {
    const wanted = new Set(ids);
    return seedProducts.filter((p) => wanted.has(p.id));
  }

  const collection = await productsCollection();
  const docs = await collection.find({ _id: { $in: ids } }, { session }).toArray();
  return docs.map(toProduct);
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  if (shouldUseSeedData()) {
    return seedProducts
      .filter((p) => p.category === product.category && p.id !== product.id)
      .slice(0, limit);
  }

  const collection = await productsCollection();
  const docs = await collection
    .find({ category: product.category, _id: { $ne: product.id } })
    .limit(limit)
    .toArray();
  return docs.map(toProduct);
}

/** Every product, used by the cart to resolve stored ids. */
export async function getAllProducts(): Promise<Product[]> {
  if (shouldUseSeedData()) return seedProducts;

  const collection = await productsCollection();
  const docs = await collection.find({}).sort({ _id: 1 }).toArray();
  return docs.map(toProduct);
}

export async function countProducts(): Promise<number> {
  if (shouldUseSeedData()) return seedProducts.length;
  const collection = await productsCollection();
  return collection.countDocuments();
}

// --- Admin writes ------------------------------------------------------------

/** Case-insensitive, so "ss-bag-001" cannot sit beside "SS-BAG-001". */
export async function skuTaken(sku: string, exceptId?: string): Promise<boolean> {
  const needle = sku.trim().toLowerCase();

  if (shouldUseSeedData()) {
    return seedProducts.some(
      (p) => p.id !== exceptId && p.sku.trim().toLowerCase() === needle,
    );
  }

  const collection = await productsCollection();
  const filter: Filter<ProductDoc> = {
    sku: new RegExp(`^${escapeRegex(sku.trim())}$`, "i"),
  };
  if (exceptId) filter._id = { $ne: exceptId };
  return (await collection.countDocuments(filter, { limit: 1 })) > 0;
}

/** Appends -2, -3 … rather than refusing, so two similar names can coexist. */
async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const taken = async (candidate: string) => {
    if (shouldUseSeedData()) {
      return seedProducts.some((p) => p.slug === candidate && p.id !== exceptId);
    }
    const collection = await productsCollection();
    const filter: Filter<ProductDoc> = { slug: candidate };
    if (exceptId) filter._id = { $ne: exceptId };
    return (await collection.countDocuments(filter, { limit: 1 })) > 0;
  };

  if (!(await taken(base))) return base;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!(await taken(candidate))) return candidate;
  }
  return `${base}-${randomUUID().slice(0, 6)}`;
}

/**
 * Derived from the variants so the two can never disagree. Kept on the document
 * because older products rely on these two fields and the listing queries read
 * them without knowing about variants.
 */
function legacyMirror(variants: ProductVariant[]): { image: string; stock: number } {
  const first = variants.find((v) => v.stock > 0) ?? variants[0];
  return {
    image: first?.image ?? "",
    stock: variants.reduce((sum, v) => sum + v.stock, 0),
  };
}

/**
 * An explicit field list rather than spreading the product, so a field added to
 * `Product` for the UI's benefit has to be opted into storage deliberately.
 */
function toDocFields(product: Product): Omit<ProductDoc, "_id"> {
  return {
    slug: product.slug,
    sku: product.sku,
    name: product.name,
    description: product.description,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    category: product.category,
    material: product.material,
    strapType: product.strapType,
    badge: product.badge,
    video: product.video,
    variants: product.variants,
    image: product.image,
    stock: product.stock,
    rating: product.rating,
    reviewCount: product.reviewCount,
    featured: product.featured,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export type WriteResult =
  | { ok: true; product: Product }
  | { ok: false; reason: "sku-taken" | "not-found" };

export async function createProduct(
  input: ProductInput,
  baseSlug: string,
): Promise<WriteResult> {
  if (await skuTaken(input.sku)) return { ok: false, reason: "sku-taken" };

  const now = new Date().toISOString();
  const product: Product = {
    id: `p-${randomUUID().slice(0, 8)}`,
    slug: await uniqueSlug(baseSlug),
    rating: 0,
    reviewCount: 0,
    ...input,
    ...legacyMirror(input.variants),
    createdAt: now,
    updatedAt: now,
  };

  if (shouldUseSeedData()) {
    seedProducts.unshift(product);
    return { ok: true, product };
  }

  const collection = await productsCollection();
  await collection.insertOne({ _id: product.id, ...toDocFields(product) });
  return { ok: true, product };
}

export async function updateProduct(
  id: string,
  input: ProductInput,
  baseSlug: string,
): Promise<WriteResult> {
  const existing = await getProductById(id);
  if (!existing) return { ok: false, reason: "not-found" };
  if (await skuTaken(input.sku, id)) return { ok: false, reason: "sku-taken" };

  // The slug only moves if the name changed, so existing links keep working
  // through ordinary edits like a price change.
  const slug =
    baseSlug === existing.slug ? existing.slug : await uniqueSlug(baseSlug, id);

  const product: Product = {
    ...existing,
    ...input,
    ...legacyMirror(input.variants),
    slug,
    updatedAt: new Date().toISOString(),
  };

  if (shouldUseSeedData()) {
    const index = seedProducts.findIndex((p) => p.id === id);
    if (index === -1) return { ok: false, reason: "not-found" };
    seedProducts[index] = product;
    return { ok: true, product };
  }

  const collection = await productsCollection();
  await collection.updateOne({ _id: id }, { $set: toDocFields(product) });
  return { ok: true, product };
}

export async function deleteProduct(id: string): Promise<boolean> {
  if (shouldUseSeedData()) {
    const index = seedProducts.findIndex((product) => product.id === id);
    if (index === -1) return false;
    seedProducts.splice(index, 1);
    return true;
  }

  const collection = await productsCollection();
  const result = await collection.deleteOne({ _id: id });
  return result.deletedCount > 0;
}

/**
 * Takes stock off one colour, and only if that colour still has enough.
 *
 * The check and the decrement are a single conditional update, so two orders
 * landing at the same moment cannot both pass a "do we have enough?" test and
 * oversell. A `false` return means someone else got there first.
 */
export async function decrementVariantStock(
  productId: string,
  color: string,
  quantity: number,
  session?: ClientSession,
): Promise<boolean> {
  if (shouldUseSeedData()) {
    const product = seedProducts.find((p) => p.id === productId);
    if (!product) return false;

    if (product.variants.length === 0) {
      if (product.stock < quantity) return false;
      product.stock -= quantity;
      return true;
    }

    const variant = product.variants.find((v) => v.color === color);
    if (!variant || variant.stock < quantity) return false;
    variant.stock -= quantity;
    product.stock = product.variants.reduce((sum, v) => sum + v.stock, 0);
    return true;
  }

  const collection = await productsCollection();

  // A product with no variants keeps its stock at the top level.
  if (color === "") {
    const result = await collection.updateOne(
      { _id: productId, stock: { $gte: quantity } },
      { $inc: { stock: -quantity } },
      { session },
    );
    return result.modifiedCount > 0;
  }

  const result = await collection.updateOne(
    {
      _id: productId,
      variants: { $elemMatch: { color, stock: { $gte: quantity } } },
    },
    { $inc: { "variants.$.stock": -quantity, stock: -quantity } },
    { session },
  );
  return result.modifiedCount > 0;
}

/**
 * Puts stock back. Used to undo reservations when a later line in the same
 * order turns out to be unavailable, so a half-reserved order does not leave
 * stock stranded.
 */
export async function restoreVariantStock(
  productId: string,
  color: string,
  quantity: number,
  session?: ClientSession,
): Promise<boolean> {
  if (shouldUseSeedData()) {
    const product = seedProducts.find((p) => p.id === productId);
    if (!product) return false;

    if (product.variants.length === 0) {
      product.stock += quantity;
      return true;
    }
    const variant = product.variants.find((v) => v.color === color);
    if (!variant) return false;
    variant.stock += quantity;
    product.stock = product.variants.reduce((sum, v) => sum + v.stock, 0);
    return true;
  }

  const collection = await productsCollection();

  if (color === "") {
    const result = await collection.updateOne(
      { _id: productId },
      { $inc: { stock: quantity } },
      { session },
    );
    return result.modifiedCount === 1;
  }

  const result = await collection.updateOne(
    { _id: productId, "variants.color": color },
    { $inc: { "variants.$.stock": quantity, stock: quantity } },
    { session },
  );
  return result.modifiedCount === 1;
}
