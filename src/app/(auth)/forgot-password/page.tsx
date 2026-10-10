import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password",
};

/**
 * Reachable while signed in on purpose — unlike /login and /signup, which
 * redirect. Somebody who is signed in on their phone and wants to change a
 * password they half-remember should not be bounced to the home page.
 */
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { email } = await searchParams;
  const raw = Array.isArray(email) ? email[0] : email;

  return (
    <div className="animate-fade-up rounded-2xl border border-line bg-surface-raised p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1 text-sm text-muted">
        Enter your email and we will send you a link to choose a new one.
      </p>

      <div className="mt-6">
        <ForgotPasswordForm defaultEmail={raw?.slice(0, 120) || undefined} />
      </div>
    </div>
  );
}
