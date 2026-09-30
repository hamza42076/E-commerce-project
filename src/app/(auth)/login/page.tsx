import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSession } from "@/lib/auth/session";
import { DEMO_ACCOUNTS } from "@/lib/db/demo-accounts";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  if (await getSession()) redirect("/");

  return (
    <div className="animate-fade-up rounded-2xl border border-line bg-surface-raised p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Sign in to track your orders.</p>

      <div className="mt-6">
        <Suspense fallback={<div className="skeleton h-72 rounded-xl" aria-hidden="true" />}>
          <LoginForm />
        </Suspense>
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-line-strong bg-surface-sunken p-3.5">
        <p className="text-xs font-medium">Demo accounts</p>
        <ul className="mt-2 space-y-1 text-xs text-muted">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email} className="flex flex-wrap gap-x-2">
              <span className="font-mono">{account.email}</span>
              <span className="font-mono">{account.password}</span>
              <span className="text-subtle">({account.role})</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
