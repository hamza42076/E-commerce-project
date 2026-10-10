"use client";

import { useState, type ChangeEvent, type FocusEvent, type InputHTMLAttributes, type Ref } from "react";
import { TextField } from "./TextField";
import { suggestEmail } from "@/lib/email-hints";

/**
 * An email input that notices a mistyped domain.
 *
 * This exists because of four real bounced orders. The address on them was
 * `coodinakakeera@gmail.com` instead of `coodingkakeera@gmail.com` — one
 * letter, typed the same way four times. Nothing rejected it, because it is a
 * perfectly valid address; the confirmation simply went nowhere, and from the
 * customer's side the shop just never wrote back.
 *
 * The check runs on blur rather than on every keystroke. Mid-typing, `gmail.c`
 * looks like a typo of `gmail.com` and prompting then would mean suggesting a
 * correction to someone who is still halfway through the word.
 *
 * Accepting is always a choice. `@gmail.com.pk` and `@gmai.lt` are real
 * domains; a guess that overruled the person typing would be worse than the
 * typo.
 */
export function EmailField({
  label,
  error,
  hint,
  onCorrect,
  onBlur,
  onChange,
  ref,
  ...props
}: {
  label: string;
  error?: string;
  hint?: string;
  /** Called with the corrected address when the suggestion is accepted. */
  onCorrect: (email: string) => void;
  ref?: Ref<HTMLInputElement>;
} & InputHTMLAttributes<HTMLInputElement>) {
  const [suggestion, setSuggestion] = useState<string | null>(null);

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    setSuggestion(suggestEmail(event.target.value));
    onBlur?.(event);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    // Whatever was suggested was about the old value. Keeping it on screen
    // while the address changes underneath it is just confusing.
    if (suggestion) setSuggestion(null);
    onChange?.(event);
  }

  return (
    <div>
      <TextField
        {...props}
        ref={ref}
        label={label}
        type="email"
        error={error}
        hint={hint}
        onBlur={handleBlur}
        onChange={handleChange}
      />

      {suggestion && (
        <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400" aria-live="polite">
          Did you mean{" "}
          <button
            type="button"
            onClick={() => {
              onCorrect(suggestion);
              setSuggestion(null);
            }}
            className="font-medium underline underline-offset-2 hover:no-underline"
          >
            {suggestion}
          </button>
          ?
        </p>
      )}
    </div>
  );
}
