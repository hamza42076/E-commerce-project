import type { Metadata } from "next";
import { ExpiredNotice, ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { peekPasswordReset } from "@/lib/db/password-resets";

export const metadata: Metadata = {
  title: "Choose a new password",
  // A reset token in a URL has no business in a search index or a referrer.
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await searchParams;
  const raw = Array.isArray(token) ? token[0] : token;

  // Checked here, without spending it, so a stale link says so before anyone
  // picks a password and types it twice.
  const found = raw ? await peekPasswordReset(raw) : null;

  if (!raw || !found) {
    return (
      <div className="animate-fade-up rounded-2xl border border-line bg-surface-raised p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <div className="mt-6">
          <ExpiredNotice />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up rounded-2xl border border-line bg-surface-raised p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-1 text-sm text-muted">
        Pick something you have not used here before.
      </p>

      <div className="mt-6">
        <ResetPasswordForm token={raw} email={found.email} />
      </div>
    </div>
  );
}
