"use server";

import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/validation";
import {
  createUser,
  findActiveUserByEmail,
  findUserById,
  toUser,
  updateUserPassword,
} from "@/lib/db/users";
import {
  RESET_TTL_MINUTES,
  clearPasswordResets,
  consumePasswordReset,
  createPasswordReset,
} from "@/lib/db/password-resets";
import { passwordResetEmail } from "@/lib/email/templates";
import { sendMail } from "@/lib/email/mailer";
import { siteUrl } from "@/lib/site-url";
import { verifyPassword } from "./password";
import { createSession, destroySession } from "./session";
import { payloadFor, signToken } from "./token";
import {
  LOGIN_EMAIL_LIMIT,
  LOGIN_IP_LIMIT,
  RESET_EMAIL_LIMIT,
  RESET_IP_LIMIT,
  callerIp,
  clearAttempts,
  consumeAttempt,
  describeWait,
} from "./rate-limit";
import type { User, UserRole } from "@/types";

export type AuthFailure = {
  ok: false;
  message: string;
  field?: "email" | "password" | "name";
  /**
   * The email has no account. The form uses this to offer a way forward —
   * a link to sign up with the address already filled in — instead of only
   * saying no.
   */
  unknownEmail?: true;
  /**
   * The email already has an account. The signup form uses this to offer a
   * sign-in link rather than leaving somebody to re-read the error.
   */
  duplicateEmail?: true;
  /** Too many attempts. Shown as a notice rather than a field error. */
  rateLimited?: true;
};

export type AuthSuccess = {
  ok: true;
  role: UserRole;
  /** For the client store. The cookie set alongside is what authorises. */
  user: { name: string; email: string; role: UserRole };
  /** Bearer token, for calling the JSON API from the browser. */
  token: string;
};

export type AuthResult = AuthSuccess | AuthFailure;

/**
 * Every action re-validates with the same zod schema the form used. Client-side
 * validation is for feedback; this is the check that actually counts.
 */

export async function signupAction(values: unknown): Promise<AuthResult> {
  const parsed = signupSchema.safeParse(values);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, message: first?.message ?? "Check the form and try again." };
  }

  const { name, email, password } = parsed.data;

  const user = await createUser({ name, email, password });
  if (!user) {
    return {
      ok: false,
      message: "An account with that email already exists.",
      field: "email",
      duplicateEmail: true,
    };
  }

  await createSession(user);
  return succeed(user);
}

export async function loginAction(values: unknown): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, message: first?.message ?? "Check the form and try again." };
  }

  const { email, password } = parsed.data;

  /**
   * This form tells the truth about which half was wrong: an unknown address
   * and a wrong password get different answers. That is a real kindness — most
   * failed sign-ins here are a first-time visitor who has not registered yet,
   * or somebody who typed their address wrong, and "email or password is
   * incorrect" leaves both of them stuck guessing.
   *
   * The cost is that the form will confirm whether an address has an account.
   * The counters below are what make that affordable: a handful of answers per
   * address and a few dozen per source, then nothing for fifteen minutes. That
   * is plenty for someone who forgot which email they used, and useless for
   * harvesting a customer list or guessing at one account's password.
   *
   * Both counters are consumed before the password is checked, so a locked-out
   * caller learns nothing at all — not even whether the address exists.
   */
  const ip = await callerIp();

  const byIp = await consumeAttempt(LOGIN_IP_LIMIT, ip);
  if (!byIp.allowed) return tooMany(byIp.retryAfterSeconds);

  const byEmail = await consumeAttempt(LOGIN_EMAIL_LIMIT, email);
  if (!byEmail.allowed) return tooMany(byEmail.retryAfterSeconds);

  const record = await findActiveUserByEmail(email);

  if (!record) {
    return {
      ok: false,
      message: "No account uses this email address yet.",
      field: "email",
      unknownEmail: true,
    };
  }

  if (!(await verifyPassword(password, record.passwordHash))) {
    return {
      ok: false,
      message: "That password is not correct.",
      field: "password",
    };
  }

  // Got there in the end — the failures on the way do not count against them.
  await clearAttempts(LOGIN_EMAIL_LIMIT, email);
  await clearAttempts(LOGIN_IP_LIMIT, ip);

  const user = toUser(record);
  await createSession(user);
  return succeed(user);
}

function tooMany(retryAfterSeconds: number): AuthFailure {
  return {
    ok: false,
    message: `Too many attempts. Try again in ${describeWait(retryAfterSeconds)}, or reset your password.`,
    rateLimited: true,
  };
}

/**
 * The cookie is set separately by createSession and is the thing that
 * actually authorises. These two come back so the client store can show who is
 * signed in without a round trip, and hold a token for the JSON API.
 */
function succeed(user: User): AuthSuccess {
  return {
    ok: true,
    role: user.role,
    user: { name: user.name, email: user.email, role: user.role },
    token: signToken(payloadFor(user)),
  };
}

export async function logoutAction(): Promise<void> {
  await destroySession();
}

/* -------------------------------------------------------------------------- */
/* Password reset                                                             */
/* -------------------------------------------------------------------------- */

export type ResetRequestResult =
  | { ok: true; email: string; expiresMinutes: number }
  | {
      ok: false;
      message: string;
      field?: "email";
      unknownEmail?: true;
      rateLimited?: true;
    };

/**
 * Step one: email a link.
 *
 * Like the sign-in form, this says so when an address has no account, for the
 * same reason — somebody who mistyped their address would otherwise be left
 * watching an inbox for a message that is never coming. Rate limited harder
 * than sign-in, because each successful call puts a message in somebody's
 * inbox whether they asked for it or not.
 */
export async function requestPasswordResetAction(values: unknown): Promise<ResetRequestResult> {
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, message: first?.message ?? "Enter your email address.", field: "email" };
  }

  const { email } = parsed.data;
  const ip = await callerIp();

  const byIp = await consumeAttempt(RESET_IP_LIMIT, ip);
  if (!byIp.allowed) {
    return {
      ok: false,
      message: `Too many reset requests. Try again in ${describeWait(byIp.retryAfterSeconds)}.`,
      rateLimited: true,
    };
  }

  const byEmail = await consumeAttempt(RESET_EMAIL_LIMIT, email);
  if (!byEmail.allowed) {
    return {
      ok: false,
      message: `We have already sent a few links to that address. Check your inbox and spam folder, then try again in ${describeWait(byEmail.retryAfterSeconds)}.`,
      rateLimited: true,
    };
  }

  const record = await findActiveUserByEmail(email);
  if (!record) {
    return {
      ok: false,
      message: "No account uses this email address yet.",
      field: "email",
      unknownEmail: true,
    };
  }

  const token = await createPasswordReset({ id: record.id, email: record.email });
  const base = await siteUrl();
  const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}`;

  const message = passwordResetEmail({
    name: record.name,
    resetUrl,
    expiresMinutes: RESET_TTL_MINUTES,
  });

  // Sent inline rather than in `after()`: unlike an order confirmation, this
  // email *is* the outcome of the request, so the person needs to be told when
  // it could not be sent instead of being left waiting for it.
  const sent = await sendMail({ to: record.email, ...message });

  if (!sent.ok) {
    // The link is still valid, so it is withdrawn — leaving a live reset token
    // behind for a message nobody received is pointless risk.
    await clearPasswordResets(record.id);

    if (sent.skipped) {
      console.warn(
        `[auth] Reset link for ${record.email} was not sent — SMTP is not configured.\n` +
          `       The link was: ${resetUrl}`,
      );
      return {
        ok: false,
        message: "Email is not set up on this server, so the link could not be sent.",
      };
    }

    return {
      ok: false,
      message: "We could not send the email just now. Please try again in a moment.",
    };
  }

  return { ok: true, email: record.email, expiresMinutes: RESET_TTL_MINUTES };
}

export type ResetResult =
  | AuthSuccess
  | {
      ok: false;
      message: string;
      field?: "password" | "confirmPassword";
      /** The link was already spent, or has run out. Its own screen. */
      expired?: true;
    };

/**
 * Step two: spend the link and set the new password.
 *
 * A successful reset signs them in. Following the link proves they can read
 * that mailbox, which is the same thing the password proves, and the
 * alternative is bouncing somebody who has just proved who they are back to a
 * form to type the password they only set a second ago.
 */
export async function resetPasswordAction(values: unknown): Promise<ResetResult> {
  const parsed = resetPasswordSchema.safeParse(values);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path?.[0];
    return {
      ok: false,
      message: first?.message ?? "Check the form and try again.",
      field: path === "password" || path === "confirmPassword" ? path : undefined,
    };
  }

  const { token, password } = parsed.data;

  const found = await consumePasswordReset(token);
  if (!found) {
    return {
      ok: false,
      expired: true,
      message: "This link has expired or has already been used. Ask for a new one.",
    };
  }

  const changed = await updateUserPassword(found.userId, password);
  if (!changed) {
    return { ok: false, message: "That account no longer exists." };
  }

  // consumePasswordReset already removed this one; this clears any other link
  // outstanding for the account.
  await clearPasswordResets(found.userId);

  // The address has just been proved reachable, so previous failures against it
  // are no longer evidence of anything.
  await clearAttempts(LOGIN_EMAIL_LIMIT, found.email);

  const user = await findUserById(found.userId);
  if (!user) {
    return { ok: false, message: "That account no longer exists." };
  }

  await createSession(user);
  return succeed(user);
}
