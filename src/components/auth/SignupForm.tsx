"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TextField } from "@/components/form/TextField";
import { EmailField } from "@/components/form/EmailField";
import { PasswordField, PasswordRequirements } from "@/components/form/PasswordField";
import { signupSchema, type SignupValues } from "@/lib/validation";
import { signupAction } from "@/lib/auth/actions";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";

export function SignupForm({ next, defaultEmail }: { next?: string; defaultEmail?: string }) {
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const signIn = useAuthStore((s) => s.signIn);
  const [takenEmail, setTakenEmail] = useState<string | null>(null);

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
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      // Arrives filled in when someone tried to sign in with an address that
      // has no account, so they do not type it a second time.
      email: defaultEmail ?? "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: SignupValues) {
    setTakenEmail(null);
    const result = await signupAction(values);

    if (!result.ok) {
      if (result.duplicateEmail) {
        setTakenEmail(values.email);
        return;
      }

      setError(result.field ?? "root", { message: result.message }, { shouldFocus: true });
      return;
    }

    signIn(result.user, result.token);
    showToast("Account created", "You are signed in");
    // Back to whatever they were looking at before signing up.
    router.push(next ?? "/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {takenEmail && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/40"
        >
          <p className="font-medium text-amber-900 dark:text-amber-200">
            {takenEmail} already has an account.
          </p>
          <p className="mt-1 text-amber-800 dark:text-amber-300/90">
            Sign in instead, or reset the password if you have forgotten it.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Link
              href={withNext("/login", takenEmail)}
              className="inline-flex rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
            >
              Sign in
            </Link>
            <Link
              href={withNext("/forgot-password", takenEmail)}
              className="text-xs text-amber-900 underline underline-offset-2 dark:text-amber-300"
            >
              Reset password
            </Link>
          </div>
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

      <TextField
        label="Full name"
        autoComplete="name"
        placeholder="Ayesha Khan"
        error={errors.name?.message}
        {...register("name")}
      />

      <EmailField
        label="Email"
        autoComplete="email"
        placeholder="you@example.com"
        hint="Order confirmations are sent here."
        // Also on the element, not just in defaultValues: react-hook-form fills
        // an uncontrolled input after hydration, so without this the prefilled
        // address is missing from the server-rendered HTML and absent entirely
        // if the JavaScript never arrives.
        defaultValue={defaultEmail ?? ""}
        error={errors.email?.message}
        onCorrect={(email) => setValue("email", email, { shouldValidate: true })}
        {...register("email")}
      />

      <div>
        <PasswordField
          label="Password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.password?.message}
          {...register("password")}
        />
        <PasswordHints control={control} />
      </div>

      <PasswordField
        label="Confirm password"
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
        {isSubmitting ? "Creating account..." : "Create account"}
      </button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={withNext("/login")} className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

/**
 * The live rule checklist, in its own component so that subscribing to the
 * password field re-renders three lines of text rather than the whole form on
 * every keystroke.
 */
function PasswordHints({ control }: { control: Control<SignupValues> }) {
  const value = useWatch({ control, name: "password" });
  return <PasswordRequirements value={value ?? ""} />;
}
