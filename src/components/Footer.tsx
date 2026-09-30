import Link from "next/link";

const COLUMNS = [
  {
    title: "Shop",
    links: [
      { href: "/products", label: "All products" },
      { href: "/products?category=electronics", label: "Electronics" },
      { href: "/products?category=fashion", label: "Fashion" },
      { href: "/products?category=home", label: "Home & Living" },
      { href: "/products?category=beauty", label: "Beauty" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/products?sort=price-asc", label: "Best value" },
      { href: "/products?sort=rating", label: "Top rated" },
      { href: "/cart", label: "Your cart" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-surface-sunken">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M4 8h16l-1.4 9.2a2 2 0 01-2 1.7H7.4a2 2 0 01-2-1.7z M8.5 8V6.4a3.5 3.5 0 017 0V8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="text-lg">
                Smart<span className="text-brand-600">Shop</span>
              </span>
            </Link>
            <p className="mt-3 max-w-sm text-sm text-muted">
              A small, carefully picked catalogue. Electronics, clothing, home goods and
              skincare, delivered across Pakistan.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold">{column.title}</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-muted transition hover:text-brand-600">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} SmartShop. Demo storefront.</p>
          <p>Prices in PKR &middot; Free delivery over Rs 5,000</p>
        </div>
      </div>
    </footer>
  );
}
