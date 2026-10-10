"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EmailField } from "@/components/form/EmailField";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/validation";
import { requestPasswordResetAction } from "@/lib/auth/actions";

type Sent = { email: string; expiresMinutes: number };

export function ForgotPasswordForm({ defaultEmail }: { defaultEmail?: string }) {
  const [sent, setSent] = useState<Sent | null>(null);
  const [noAccount, setNoAccount] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: defaultEmail ?? "" },
  });

  async function onSubmit(values: ForgotPasswordValues) {
    setNoAccount(null);
    const result = await requestPasswordResetAction(values);

    if (!result.ok) {
      if (result.unknownEmail) {
        setNoAccount(values.email);
        return;
      }
      setError(result.field ?? "root", { message: result.message }, { shouldFocus: true });
      return;
    }

    setSent({ email: result.email, expiresMinutes: result.expiresMinutes });
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
            Link sent to {sent.email}
          </p>
          <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-300/90">
            Open it within {sent.expiresMinutes} minutes to choose a new password. It
            works once.
          </p>
        </div>

        {/*
          Said plainly because it is where these emails usually end up. The shop
          sends from a Gmail address rather than its own domain, so filters are
          suspicious of it — and somebody who cannot find the message assumes
          the site is broken rather than checking a folder.
        */}
        <p className="text-sm text-muted">
          Nothing after a minute or two? Look in your spam or promotions folder — and
          check the address above is spelled the way you expect.
        </p>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setSent(null)}
            className="font-medium text-brand-600 hover:underline"
          >
            Use a different address
          </button>
          <span className="text-subtle">·</span>
          <Link href="/login" className="font-medium text-brand-600 hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {noAccount && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/40"
        >
          <p className="font-medium text-amber-900 dark:text-amber-200">
            No account uses {noAccount} yet.
          </p>
          <p className="mt-1 text-amber-800 dark:text-amber-300/90">
            Check the spelling, or create an account with this address.
          </p>
          <Link
            href={`/signup?email=${encodeURIComponent(noAccount)}`}
            className="mt-2.5 inline-flex rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
          >
            Create an account
          </Link>
        </div>
      )}

      {errors.root?.message && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {errors.root.message}
        </p>
      )}

      <EmailField
        label="Email"
        autoComplete="email"
        placeholder="you@example.com"
        hint="The address you signed up with."
        // In the markup as well as in defaultValues, so the prefilled address
        // is there before hydration rather than after it.
        defaultValue={defaultEmail ?? ""}
        error={errors.email?.message}
        onCorrect={(email) => setValue("email", email, { shouldValidate: true })}
        {...register("email")}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60 disabled:active:scale-100"
      >
        {isSubmitting ? "Sending link..." : "Send reset link"}
      </button>

      <p className="text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
