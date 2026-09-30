import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/SignupForm";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Create account",
};

export default async function SignupPage() {
  if (await getSession()) redirect("/");

  return (
    <div className="animate-fade-up rounded-2xl border border-line bg-surface-raised p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted">It takes about thirty seconds.</p>

      <div className="mt-6">
        <SignupForm />
      </div>
    </div>
  );
}
