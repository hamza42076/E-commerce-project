import "server-only";
import { randomUUID } from "node:crypto";
import type { Filter, Sort } from "mongodb";
import type { Category, Product, ProductQuery } from "@/types";
import { categoriesCollection, productsCollection, type ProductDoc } from "./mongo";
import { shouldUseSeedData } from "./fallback";
import { seedCategories, seedProducts } from "./seed-products";

/**
 * Data access layer. Every product read in the app goes through this file.
 * See `fallback.ts` for what happens without a connection string.
 */

function toProduct(doc: ProductDoc): Product {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
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
    filter.$or = [{ name: pattern }, { description: pattern }, { category: pattern }];
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

function fallbackProducts(query: ProductQuery = {}): Product[] {
  const { search, category, sort = "featured" } = query;
  let results = seedProducts;

  if (category && category !== "all") {
    results = results.filter((p) => p.category === category);
  }
  if (search?.trim()) {
    const term = search.trim().toLowerCase();
    results = results.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term),
    );
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

// --- Public API --------------------------------------------------------------

export async function getCategories(): Promise<Category[]> {
  if (shouldUseSeedData()) return seedCategories;

  const collection = await categoriesCollection();
  const docs = await collection.find({}).sort({ position: 1 }).toArray();
  return docs.map((doc) => ({ slug: doc._id, name: doc.name }));
}

export async function getProducts(query: ProductQuery = {}): Promise<Product[]> {
  if (shouldUseSeedData()) return fallbackProducts(query);

  const collection = await productsCollection();
  const docs = await collection
    .find(buildFilter(query))
    .sort(buildSort(query.sort))
    .toArray();
  return docs.map(toProduct);
}

export async function getFeaturedProducts(limit = 4): Promise<Product[]> {
  if (shouldUseSeedData()) return seedProducts.filter((p) => p.featured).slice(0, limit);

  const collection = await productsCollection();
  const docs = await collection.find({ featured: true }).limit(limit).toArray();
  return docs.map(toProduct);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (shouldUseSeedData()) return seedProducts.find((p) => p.slug === slug) ?? null;

  const collection = await productsCollection();
  const doc = await collection.findOne({ slug });
  return doc ? toProduct(doc) : null;
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  if (shouldUseSeedData()) {
    const wanted = new Set(ids);
    return seedProducts.filter((p) => wanted.has(p.id));
  }

  const collection = await productsCollection();
  const docs = await collection.find({ _id: { $in: ids } }).toArray();
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

// --- Admin writes ------------------------------------------------------------

export type NewProduct = Omit<Product, "id" | "rating" | "reviewCount">;

/** Returns null when the slug is already taken. */
export async function createProduct(input: NewProduct): Promise<Product | null> {
  const product: Product = {
    id: `p-${randomUUID().slice(0, 8)}`,
    rating: 0,
    reviewCount: 0,
    ...input,
  };

  if (shouldUseSeedData()) {
    if (seedProducts.some((existing) => existing.slug === product.slug)) return null;
    seedProducts.unshift(product);
    return product;
  }

  const collection = await productsCollection();
  if (await collection.findOne({ slug: product.slug })) return null;

  const { id, ...rest } = product;
  await collection.insertOne({ _id: id, ...rest });
  return product;
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

export async function countProducts(): Promise<number> {
  if (shouldUseSeedData()) return seedProducts.length;
  const collection = await productsCollection();
  return collection.countDocuments();
}
