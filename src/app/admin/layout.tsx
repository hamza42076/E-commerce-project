import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSession } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s · Admin · SmartShop",
  },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  // Not signed in at all: send them to sign in and come back here afterwards.
  if (!session) redirect("/login?next=/admin");

  // Signed in but not staff: no hint that the page exists.
  if (session.role !== "admin") redirect("/");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin panel</h1>
          <p className="mt-0.5 text-sm text-muted">Signed in as {session.name}</p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-line px-3 py-2 text-sm transition hover:border-brand-400 hover:text-brand-600"
        >
          View storefront
        </Link>
      </header>

      <AdminNav />

      <div className="mt-6">{children}</div>
    </div>
  );
}
