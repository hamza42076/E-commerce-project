"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EmailField } from "@/components/form/EmailField";
import { PasswordField } from "@/components/form/PasswordField";
import { loginSchema, type LoginValues } from "@/lib/validation";
import { loginAction } from "@/lib/auth/actions";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";

/**
 * Something to say beyond "that field is wrong" — a way forward, which is what
 * most failed sign-ins here actually need.
 */
type Notice =
  | { kind: "no-account"; email: string }
  | { kind: "locked"; message: string };

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showToast = useUIStore((s) => s.showToast);
  const signIn = useAuthStore((s) => s.signIn);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Arrives filled in when someone came here from the signup form after
  // finding the address already taken.
  const prefilledEmail = searchParams.get("email") ?? "";

  // Only same-site paths. Without this, /login?next=https://evil.com would
  // hand the visitor straight to someone else's site after a real sign-in.
  const requested = searchParams.get("next");
  const next =
    requested && requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : null;

  function withNext(path: string, email?: string): string {
    const params = new URLSearchParams();
    if (next) params.set("next", next);
    if (email) params.set("email", email);
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  }

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: prefilledEmail, password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setNotice(null);
    const result = await loginAction(values);

    if (!result.ok) {
      if (result.rateLimited) {
        setNotice({ kind: "locked", message: result.message });
        return;
      }

      if (result.unknownEmail) {
        setNotice({ kind: "no-account", email: values.email });
        return;
      }

      // The action's field union covers signup too; only these exist on this form.
      const field =
        result.field === "email" || result.field === "password" ? result.field : "root";
      // shouldFocus puts the cursor in the field that needs fixing, so nobody
      // has to hunt for the red text — it matters most on a phone, where the
      // message can be below the fold.
      setError(field, { message: result.message }, { shouldFocus: true });
      return;
    }

    // Into the store, which persists it to localStorage until sign-out.
    signIn(result.user, result.token);
    showToast("Signed in", "Welcome back");
    router.push(next ?? (result.role === "admin" ? "/admin" : "/"));
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {notice?.kind === "no-account" && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/40"
        >
          <p className="font-medium text-amber-900 dark:text-amber-200">
            No account uses {notice.email} yet.
          </p>
          <p className="mt-1 text-amber-800 dark:text-amber-300/90">
            First time here? Create an account — it takes about thirty seconds.
          </p>
          <Link
            href={withNext("/signup", notice.email)}
            className="mt-2.5 inline-flex rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
          >
            Create an account
          </Link>
        </div>
      )}

      {notice?.kind === "locked" && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {notice.message}
        </p>
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
        defaultValue={prefilledEmail}
        error={errors.email?.message}
        onCorrect={(email) => setValue("email", email, { shouldValidate: true })}
        {...register("email")}
      />

      <div>
        <PasswordField
          label="Password"
          autoComplete="current-password"
          placeholder="Your password"
          error={errors.password?.message}
          {...register("password")}
        />
        <p className="mt-1.5 text-right">
          {/*
            A button rather than a Link because the address has to be read at
            the moment of the click. Putting getValues() in the href would
            freeze whatever was there when this rendered — which is nothing —
            and subscribing to the field just to keep a href fresh would
            re-render the form on every keystroke.
          */}
          <button
            type="button"
            onClick={() =>
              router.push(withNext("/forgot-password", getValues("email") || undefined))
            }
            className="text-xs text-muted underline underline-offset-2 hover:text-brand-600"
          >
            Forgot your password?
          </button>
        </p>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60 disabled:active:scale-100"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>

      <p className="text-center text-sm text-muted">
        No account yet?{" "}
        <Link href={withNext("/signup")} className="font-medium text-brand-600 hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
