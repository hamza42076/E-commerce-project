import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-32 -top-40 h-96 w-96 rounded-full bg-brand-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-accent-500/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-16">
        {children}
        <p className="mt-8 text-center text-xs text-subtle">
          By continuing you agree to the{" "}
          <Link href="/products" className="underline underline-offset-2 hover:text-muted">
            store terms
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
