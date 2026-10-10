"use server";

import { loginSchema, signupSchema } from "@/lib/validation";
import { createUser, findUserByEmail, toUser } from "@/lib/db/users";
import { verifyPassword } from "./password";
import { createSession, destroySession } from "./session";
import { payloadFor, signToken } from "./token";
import type { User, UserRole } from "@/types";

export type AuthResult =
  | {
      ok: true;
      role: UserRole;
      /** For the client store. The cookie set alongside is what authorises. */
      user: { name: string; email: string; role: UserRole };
      /** Bearer token, for calling the JSON API from the browser. */
      token: string;
    }
  | { ok: false; message: string; field?: "email" | "password" | "name" };

/**
 * Both actions re-validate with the same zod schema the form used. Client-side
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
    return { ok: false, message: "An account with that email already exists.", field: "email" };
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
  const record = await findUserByEmail(email);

  // Same message either way, so the form cannot be used to discover which
  // email addresses have accounts.
  const invalid: AuthResult = {
    ok: false,
    message: "Email or password is incorrect.",
    field: "password",
  };

  if (!record) return invalid;
  if (!(await verifyPassword(password, record.passwordHash))) return invalid;

  const user = toUser(record);
  await createSession(user);
  return succeed(user);
}

/**
 * The cookie is set separately by createSession and is the thing that
 * actually authorises. These two come back so the client store can show who is
 * signed in without a round trip, and hold a token for the JSON API.
 */
function succeed(user: User): AuthResult {
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
