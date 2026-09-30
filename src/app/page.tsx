import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { getAllProducts, getCategories, getFeaturedProducts } from "@/lib/db/products";

// The root layout reads the session cookie, so every route renders per request.
// That keeps prices, stock and the signed-in header always current.

const CATEGORY_PANELS: Record<string, string> = {
  electronics: "from-brand-500/25 to-brand-700/30",
  fashion: "from-accent-400/25 to-accent-600/30",
  home: "from-brand-600/25 to-accent-400/25",
  beauty: "from-accent-600/25 to-brand-400/25",
};

const PROMISES = [
  {
    title: "Free delivery",
    body: "On every order over Rs 5,000",
    icon: "M3 7h11v8H3zM14 10h4l3 3v2h-7z M7 18.5a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2z M17.5 18.5a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2z",
  },
  {
    title: "Cash on delivery",
    body: "Pay when it reaches you",
    icon: "M3 7.5h18v9H3z M12 14.2a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4z",
  },
  {
    title: "7-day returns",
    body: "Unopened, no questions asked",
    icon: "M4 10a8 8 0 1114 5.3 M4 10V5 M4 10h5",
  },
  {
    title: "Real stock counts",
    body: "What you see is what is left",
    icon: "M4 7.5l8-4 8 4v9l-8 4-8-4z M4 7.5l8 4 8-4 M12 11.5v9",
  },
];

export default async function HomePage() {
  const [featured, categories, all] = await Promise.all([
    getFeaturedProducts(4),
    getCategories(),
    getAllProducts(),
  ]);

  // Counted from the catalogue rather than hardcoded, so the hero stays honest
  // as products are added from the admin panel.
  const inStock = all.filter((product) => product.stock > 0);
  const rated = all.filter((product) => product.reviewCount > 0);
  const productCount = inStock.length;
  const averageRating = rated.length
    ? (rated.reduce((sum, product) => sum + product.rating, 0) / rated.length).toFixed(1)
    : "—";

  return (
    <div>
      {/* Hero — photo behind the store name. Swap public/hero-bag.jpg to restyle. */}
      <section className="relative isolate overflow-hidden border-b border-line">
        <Image
          src="/hero-bag.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-center"
        />

        {/* Two overlays: a teal wash to tie the photo to the brand, and a
            left-to-right darkener so the text keeps its contrast on any crop. */}
        <div className="absolute inset-0 -z-10 bg-brand-900/45 mix-blend-multiply" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/60 to-black/25" />

        <div className="relative mx-auto flex min-h-[32rem] max-w-6xl flex-col items-start justify-center gap-6 px-4 py-20 sm:py-28">
          <span className="animate-fade-up rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            New season stock just landed
          </span>

          <h1
            className="animate-fade-up max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-7xl"
            style={{ animationDelay: "60ms" }}
          >
            Smart
            <span className="bg-gradient-to-r from-brand-300 to-accent-400 bg-clip-text text-transparent">
              Shop
            </span>
          </h1>

          <p
            className="animate-fade-up max-w-xl text-lg text-white/80"
            style={{ animationDelay: "120ms" }}
          >
            Bags, electronics, clothing, home goods and skincare. A small catalogue, chosen
            so you do not have to scroll through ten thousand listings to find one good thing.
          </p>

          <div
            className="animate-fade-up flex flex-wrap gap-3"
            style={{ animationDelay: "180ms" }}
          >
            <Link
              href="/products"
              className="rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-medium text-white shadow-lg shadow-black/25 transition hover:bg-brand-700 active:scale-[0.98]"
            >
              Browse the shop
            </Link>
            <Link
              href="/products?sort=price-asc"
              className="rounded-xl border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20 active:scale-[0.98]"
            >
              Best value first
            </Link>
          </div>

          <dl
            className="animate-fade-up mt-4 flex flex-wrap gap-x-10 gap-y-4"
            style={{ animationDelay: "240ms" }}
          >
            {[
              { value: String(productCount), label: "Products in stock" },
              { value: String(categories.length), label: "Categories" },
              { value: averageRating, label: "Average rating" },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="text-2xl font-semibold text-white">{stat.value}</dt>
                <dd className="text-xs text-white/70">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Promises */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-line lg:grid-cols-4">
          {PROMISES.map((promise) => (
            <div key={promise.title} className="flex items-start gap-3 bg-surface p-5">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    d={promise.icon}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{promise.title}</p>
                <p className="mt-0.5 text-xs text-muted">{promise.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Shop by category</h2>
            <p className="mt-1 text-sm text-muted">Four sections, nothing padded out.</p>
          </div>
          <Link
            href="/products"
            className="shrink-0 text-sm font-medium text-brand-600 transition hover:text-brand-700"
          >
            View all
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/products?category=${category.slug}`}
              className={`group relative flex h-40 flex-col justify-end overflow-hidden rounded-2xl border border-line bg-gradient-to-br p-5 transition duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-xl hover:shadow-brand-900/5 dark:hover:shadow-black/30 ${
                CATEGORY_PANELS[category.slug] ?? "from-brand-500/25 to-brand-600/30"
              }`}
            >
              <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_10%,rgba(255,255,255,0.5),transparent_60%)] dark:bg-[radial-gradient(circle_at_70%_10%,rgba(255,255,255,0.08),transparent_60%)]" />
              <span className="relative font-semibold">{category.name}</span>
              <span className="relative mt-0.5 inline-flex items-center gap-1 text-xs text-muted transition group-hover:gap-2 group-hover:text-brand-700 dark:group-hover:text-brand-300">
                Shop now
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
                  <path
                    d="M5 12h13M13 6l6 6-6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Featured this week</h2>
            <p className="mt-1 text-sm text-muted">The ones people keep coming back for.</p>
          </div>
          <Link
            href="/products"
            className="shrink-0 text-sm font-medium text-brand-600 transition hover:text-brand-700"
          >
            See everything
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Promo */}
      <section className="mx-auto max-w-6xl px-4 pb-8">
        <div className="relative overflow-hidden rounded-3xl bg-brand-700 px-6 py-14 text-center sm:px-12">
          <span className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent-400/25 blur-3xl" />
          <span className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-brand-400/30 blur-3xl" />
          <div className="relative">
            <p className="text-sm font-medium text-brand-200">Limited time</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Up to 25% off selected items
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-brand-100">
              Discounts already applied on the product pages. No codes, no small print.
            </p>
            <Link
              href="/products?sort=price-asc"
              className="mt-7 inline-block rounded-xl bg-white px-6 py-3.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50 active:scale-[0.98]"
            >
              Shop the deals
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
