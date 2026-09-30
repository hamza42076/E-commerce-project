import { Suspense } from "react";
import type { Metadata } from "next";
import { Filters } from "@/components/Filters";
import { ProductCard } from "@/components/ProductCard";
import { getCategories, getProducts } from "@/lib/db/products";
import type { ProductQuery } from "@/types";

// Always rendered on demand: the search, filter and sort all come from the URL.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop",
};

const SORTS = new Set(["featured", "price-asc", "price-desc", "rating"]);

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sortParam = first(params.sort);

  const query: ProductQuery = {
    search: first(params.q),
    category: first(params.category),
    sort: SORTS.has(sortParam ?? "") ? (sortParam as ProductQuery["sort"]) : "featured",
  };

  const [products, categories] = await Promise.all([getProducts(query), getCategories()]);
  const activeCategory = categories.find((category) => category.slug === query.category);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          {activeCategory ? activeCategory.name : "Shop"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {query.search
            ? `Results for "${query.search}"`
            : "Everything in the catalogue, filtered how you like it."}
        </p>
      </header>

      <Suspense
        fallback={<div className="skeleton h-36 rounded-2xl" aria-hidden="true" />}
      >
        <Filters categories={categories} />
      </Suspense>

      <p className="mt-6 text-sm text-muted">
        {products.length} {products.length === 1 ? "product" : "products"}
      </p>

      {products.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line-strong py-20 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-sunken text-subtle">
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M16 16l4.5 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <p className="mt-4 font-medium">Nothing matched that.</p>
          <p className="mt-1 text-sm text-muted">
            Try a different search term or clear the category filter.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
