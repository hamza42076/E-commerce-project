"use client";

import { useId, useState, type InputHTMLAttributes, type KeyboardEvent, type Ref } from "react";
import { shellClass } from "./TextField";
import { PASSWORD_RULES } from "@/lib/validation";

/**
 * A password input that can be read back.
 *
 * Two things a plain `type="password"` cannot do, both of which cause the same
 * failure — a password typed correctly, rejected, and no way to see why:
 *
 *   - Reveal what was typed. Especially on a phone, where the keyboard is
 *     small and the only feedback is a row of dots.
 *   - Notice Caps Lock. The classic one: it is on, every character is wrong,
 *     and the field looks exactly the same as if it were right.
 */
export function PasswordField({
  label,
  error,
  hint,
  id,
  ref,
  onKeyUp,
  ...props
}: {
  label: string;
  error?: string;
  hint?: string;
  ref?: Ref<HTMLInputElement>;
} & InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const fallbackId = useId();
  const fieldId = id ?? props.name ?? fallbackId;

  const describedBy =
    [error ? `${fieldId}-error` : null, !error && hint ? `${fieldId}-hint` : null, capsLock ? `${fieldId}-caps` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  function handleKeyUp(event: KeyboardEvent<HTMLInputElement>) {
    // getModifierState is the only way to read this: there is no event for Caps
    // Lock changing, so it can only be sampled while a key is in flight.
    setCapsLock(event.getModifierState("CapsLock"));
    onKeyUp?.(event);
  }

  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>

      <div className="relative">
        <input
          {...props}
          id={fieldId}
          ref={ref}
          type={visible ? "text" : "password"}
          onKeyUp={handleKeyUp}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          // pr-11 leaves room for the button sitting on top of the field.
          className={`${shellClass(Boolean(error))} pr-11`}
        />

        <button
          type="button"
          // tabIndex -1 keeps Tab going straight from the password to the next
          // field, the way it does on a form without this button.
          tabIndex={-1}
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>

      {capsLock && (
        <p
          id={`${fieldId}-caps`}
          className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5 shrink-0" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
              clipRule="evenodd"
            />
          </svg>
          Caps Lock is on
        </p>
      )}

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

/**
 * The password rules, ticked off as they are met.
 *
 * Takes the value rather than reading the form itself, so the parent decides
 * how it is watched and this stays a plain render of what it is given.
 *
 * Shown from the first keystroke onwards and not before: an untouched field
 * covered in red crosses reads as three things already wrong.
 */
export function PasswordRequirements({ value }: { value: string }) {
  if (!value) return null;

  return (
    <ul className="mt-2 space-y-1" aria-live="polite">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        return (
          <li
            key={rule.label}
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              met ? "text-emerald-600 dark:text-emerald-400" : "text-subtle"
            }`}
          >
            {met ? (
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5 shrink-0" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M16.704 5.29a.75.75 0 0 1 .006 1.06l-7.5 7.59a.75.75 0 0 1-1.07.004l-3.85-3.85a.75.75 0 1 1 1.06-1.061l3.315 3.315 6.97-7.053a.75.75 0 0 1 1.069-.005Z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <span className="flex size-3.5 shrink-0 items-center justify-center" aria-hidden="true">
                <span className="size-1.5 rounded-full border border-current" />
              </span>
            )}
            <span>{rule.label}</span>
            <span className="sr-only">{met ? " — done" : " — still needed"}</span>
          </li>
        );
      })}
    </ul>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="size-[18px]"
      aria-hidden="true"
    >
      <path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10Z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="size-[18px]"
      aria-hidden="true"
    >
      <path d="M7.2 5.1A7.9 7.9 0 0 1 10 4.5c5.5 0 8.5 5.5 8.5 5.5a15 15 0 0 1-2.2 2.9M4.3 6.9A14.8 14.8 0 0 0 1.5 10s3 5.5 8.5 5.5c1 0 1.9-.2 2.7-.5" />
      <path d="M8.3 8.3a2.5 2.5 0 0 0 3.4 3.4" />
      <path d="M2.5 2.5l15 15" />
    </svg>
  );
}
