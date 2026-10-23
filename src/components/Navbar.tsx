"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCartStore, useCartCount } from "@/stores/cart";
import { useUIStore } from "@/stores/ui";
import { useAuthUser } from "@/stores/auth";
import { useWishlistStore } from "@/stores/wishlist";
import { UserMenu } from "./UserMenu";

// Category links are not listed here: with one category there is nothing to
// navigate between, and the shop page's filter pills are built from the
// database, so they appear on their own once a second category exists.
const LINKS = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Shop" },
];

export function Navbar() {
  const itemCount = useCartCount();
  const wishlistCount = useWishlistStore((state) => state.productIds.length);
  const signedIn = useAuthUser();
  const ready = useCartStore((s) => s.hydrated);
  const openCart = useUIStore((s) => s.openCart);
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className="bg-brand-700 px-4 py-2 text-center text-xs font-medium text-white">
        Free delivery on orders over Rs 5,000 &middot; Cash on delivery available
      </div>

      <header
        className={`sticky top-0 z-40 border-b bg-surface/85 backdrop-blur transition-shadow ${
          scrolled ? "border-line shadow-sm" : "border-transparent"
        }`}
      >
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link
            href="/account/wishlist"
            aria-label={`Wishlist${wishlistCount > 0 ? `, ${wishlistCount} saved` : ""}`}
            className={`flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm transition hover:border-brand-400 hover:text-brand-600 ${
              pathname.startsWith("/account/wishlist") ? "border-brand-400 text-brand-600" : ""
            }`}
          >
            <span className="relative">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {signedIn && wishlistCount > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold tabular-nums text-white">
                  {wishlistCount}
                </span>
              )}
            </span>
            <span className="hidden sm:inline">Wishlist</span>
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            className="-ml-2 rounded-lg p-2 text-muted transition hover:bg-surface-sunken hover:text-ink md:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d={menuOpen ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden="true">
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

          <div className="ml-4 hidden items-center gap-5 text-sm md:flex">
            {LINKS.map((link) => {
              const active =
                link.href === "/" ? pathname === "/" : pathname.startsWith("/products");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative py-1 transition ${
                    active ? "font-medium text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {link.label}
                  {active && (
                    <span className="absolute -bottom-0.5 left-0 h-0.5 w-full rounded-full bg-brand-600" />
                  )}
                </Link>
              );
            })}
          </div>

          <button
            type="button"
            onClick={openCart}
            className="ml-auto flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm transition hover:border-brand-400 hover:text-brand-600"
          >
            <span className="relative">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path
                  d="M3 4h2l2.4 11.2a2 2 0 002 1.6h7.7a2 2 0 002-1.6L21 8H6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {ready && itemCount > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold tabular-nums text-white">
                  {itemCount}
                </span>
              )}
            </span>
            <span className="hidden sm:inline">Cart</span>
          </button>

          <UserMenu />
        </nav>

        {menuOpen && (
          <div className="animate-fade-in border-t border-line bg-surface md:hidden">
            <ul className="mx-auto max-w-6xl px-4 py-2">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-2 py-2.5 text-sm text-muted transition hover:bg-surface-sunken hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>
    </>
  );
}
