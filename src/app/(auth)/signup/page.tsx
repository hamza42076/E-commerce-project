import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/SignupForm";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Create account",
};

/** Only same-site paths, so ?next= cannot be used to bounce someone off-site. */
function safeNext(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return undefined;
  return raw;
}

/** A single plain value, for prefilling a field from the query string. */
function single(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.slice(0, 120) || undefined;
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await getSession()) redirect("/");

  const { next, email } = await searchParams;

  return (
    <div className="animate-fade-up rounded-2xl border border-line bg-surface-raised p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted">It takes about thirty seconds.</p>

      <div className="mt-6">
        <SignupForm next={safeNext(next)} defaultEmail={single(email)} />
      </div>
    </div>
  );
}
