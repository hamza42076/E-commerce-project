"use client";

import type { InputHTMLAttributes, Ref, TextareaHTMLAttributes } from "react";

type Common = {
  label: string;
  error?: string;
  hint?: string;
};

const baseInput =
  "w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm outline-none transition placeholder:text-subtle focus:ring-4 disabled:opacity-60";

/** Exported so PasswordField looks identical to the fields around it. */
export function shellClass(hasError: boolean): string {
  return hasError
    ? `${baseInput} border-rose-400 focus:border-rose-500 focus:ring-rose-500/10`
    : `${baseInput} border-line focus:border-brand-500 focus:ring-brand-500/10`;
}

export function TextField({
  label,
  error,
  hint,
  id,
  ref,
  ...props
}: Common & InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  const fieldId = id ?? props.name;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        {...props}
        id={fieldId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={shellClass(Boolean(error))}
      />
      {error ? (
        <p id={`${fieldId}-error`} className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextAreaField({
  label,
  error,
  hint,
  id,
  ref,
  ...props
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  const fieldId = id ?? props.name;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <textarea
        {...props}
        id={fieldId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${shellClass(Boolean(error))} min-h-24 resize-y`}
      />
      {error ? (
        <p id={`${fieldId}-error`} className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  error,
  hint,
  id,
  ref,
  children,
  ...props
}: Common &
  React.SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  const fieldId = id ?? props.name;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <select
        {...props}
        id={fieldId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={shellClass(Boolean(error))}
      >
        {children}
      </select>
      {error ? (
        <p id={`${fieldId}-error`} className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
