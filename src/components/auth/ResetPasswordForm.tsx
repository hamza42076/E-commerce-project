"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PasswordField, PasswordRequirements } from "@/components/form/PasswordField";
import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/validation";
import { resetPasswordAction } from "@/lib/auth/actions";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";

export function ResetPasswordForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const signIn = useAuthStore((s) => s.signIn);
  // The link can expire between the page loading and the form being submitted,
  // which is a different ending from a wrong password and needs its own screen.
  const [expired, setExpired] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordValues) {
    const result = await resetPasswordAction(values);

    if (!result.ok) {
      if ("expired" in result && result.expired) {
        setExpired(true);
        return;
      }
      setError(result.field ?? "root", { message: result.message }, { shouldFocus: true });
      return;
    }

    // Following the link proved they can read that mailbox, so they are signed
    // in rather than sent back to type the password they just chose.
    signIn(result.user, result.token);
    showToast("Password changed", "You are signed in");
    router.push(result.role === "admin" ? "/admin" : "/");
    router.refresh();
  }

  if (expired) {
    return <ExpiredNotice />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <input type="hidden" {...register("token")} />

      <p className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-muted">
        Setting a new password for <span className="font-medium text-ink">{email}</span>.
      </p>

      {errors.root?.message && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {errors.root.message}
        </p>
      )}

      <div>
        <PasswordField
          label="New password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.password?.message}
          {...register("password")}
        />
        <PasswordHints control={control} />
      </div>

      <PasswordField
        label="Confirm new password"
        autoComplete="new-password"
        placeholder="Type it again"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60 disabled:active:scale-100"
      >
        {isSubmitting ? "Saving..." : "Save new password"}
      </button>
    </form>
  );
}

function PasswordHints({ control }: { control: Control<ResetPasswordValues> }) {
  const value = useWatch({ control, name: "password" });
  return <PasswordRequirements value={value ?? ""} />;
}

/** Shown for a link that has already been used, or has sat too long. */
export function ExpiredNotice() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 dark:border-amber-900 dark:bg-amber-950/40">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          This link no longer works
        </p>
        <p className="mt-1 text-sm text-amber-800 dark:text-amber-300/90">
          Reset links expire after an hour and can only be used once. Ask for a fresh
          one and it will arrive in a moment.
        </p>
      </div>

      <Link
        href="/forgot-password"
        className="inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
      >
        Send a new link
      </Link>

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
