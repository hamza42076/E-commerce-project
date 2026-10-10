"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/lib/auth/actions";
import { useUIStore } from "@/stores/ui";
import { useAuthUser, useAuthStore } from "@/stores/auth";

export function UserMenu() {
  const session = useAuthUser();
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const signOutStore = useAuthStore((s) => s.signOut);
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!session) {
    return (
      <Link
        href="/login"
        className="rounded-lg border border-line px-3 py-2 text-sm transition hover:border-brand-400 hover:text-brand-600"
      >
        Sign in
      </Link>
    );
  }

  const initials = session.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  async function handleLogout() {
    setOpen(false);
    // Cookie server-side, store and localStorage here.
    await logoutAction();
    signOutStore();
    showToast("Signed out");
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-sm transition hover:border-brand-400"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
          {initials}
        </span>
        <span className="hidden max-w-24 truncate sm:block">{session.name}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="animate-fade-in absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-line bg-surface-raised shadow-lg"
        >
          {session.role === "admin" && (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm transition hover:bg-surface-sunken"
            >
              Admin panel
            </Link>
          )}
          <Link
            href="/products"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm transition hover:bg-surface-sunken"
          >
            Keep shopping
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="block w-full border-t border-line px-4 py-2.5 text-left text-sm text-rose-600 transition hover:bg-surface-sunken dark:text-rose-400"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
