"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/types";

const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
];

export function Filters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeCategory = searchParams.get("category") ?? "all";
  const activeSort = searchParams.get("sort") ?? "featured";
  const urlSearch = searchParams.get("q") ?? "";

  const [search, setSearch] = useState(urlSearch);
  // Track the last value we pushed so a back/forward navigation still syncs the box.
  const lastPushed = useRef(urlSearch);

  useEffect(() => {
    if (urlSearch !== lastPushed.current) {
      lastPushed.current = urlSearch;
      setSearch(urlSearch);
    }
  }, [urlSearch]);

  function buildUrl(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || value === "all" || value === "featured") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  // Debounce so typing doesn't push a history entry per keystroke.
  useEffect(() => {
    if (search === urlSearch) return;
    const timer = window.setTimeout(() => {
      lastPushed.current = search;
      router.replace(buildUrl({ q: search }), { scroll: false });
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, urlSearch]);

  const allCategories = [{ slug: "all", name: "All" }, ...categories];
  const hasFilters = activeCategory !== "all" || activeSort !== "featured" || urlSearch !== "";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
          >
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products..."
            aria-label="Search products"
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="shrink-0">Sort</span>
          <select
            value={activeSort}
            onChange={(event) =>
              router.replace(buildUrl({ sort: event.target.value }), { scroll: false })
            }
            className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand-500"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {allCategories.map((category) => {
          const active = category.slug === activeCategory;
          return (
            <button
              key={category.slug}
              type="button"
              aria-pressed={active}
              onClick={() =>
                router.replace(buildUrl({ category: category.slug }), { scroll: false })
              }
              className={`rounded-full px-3.5 py-1.5 text-sm transition active:scale-95 ${
                active
                  ? "bg-brand-600 text-white shadow-sm shadow-brand-600/25"
                  : "border border-line text-muted hover:border-brand-300 hover:text-brand-600"
              }`}
            >
              {category.name}
            </button>
          );
        })}

        {hasFilters && (
          <button
            type="button"
            onClick={() => router.replace(pathname, { scroll: false })}
            className="ml-auto text-sm text-muted underline-offset-4 transition hover:text-rose-600 hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
