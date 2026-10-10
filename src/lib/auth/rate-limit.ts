import "server-only";
import { headers } from "next/headers";
import { rateLimitsCollection } from "@/lib/db/mongo";
import { shouldUseSeedData } from "@/lib/db/fallback";

/**
 * Attempt counters for the auth forms.
 *
 * The sign-in form now says "no account with this email" rather than a single
 * message for every failure, which is a real help to someone who mistyped their
 * address and a small gift to someone enumerating customers. This is the other
 * half of that trade: the answer is only cheap a handful of times, after which
 * the form stops answering at all for a while.
 *
 * It also covers the thing enumeration is usually a prelude to — guessing
 * passwords against an address that is known to exist.
 *
 * Fixed windows, not a token bucket. A window that simply expires is one
 * document with a TTL index on it; the precision a sliding window would buy is
 * worth nothing at these limits.
 */

export type Limit = {
  /** Prefix identifying what is being counted, e.g. "login". */
  readonly name: string;
  /** Attempts allowed inside one window. */
  readonly max: number;
  readonly windowSeconds: number;
};

/**
 * Per email address. Low, because this is the counter that makes guessing
 * passwords for one known account impractical.
 */
export const LOGIN_EMAIL_LIMIT: Limit = { name: "login-email", max: 8, windowSeconds: 15 * 60 };

/**
 * Per IP. Deliberately looser: a family, an office or a phone network share one
 * address, and three people failing to sign in should not lock out the fourth.
 * It is here to cap a spray across *many* addresses, which the email counter
 * cannot see.
 */
export const LOGIN_IP_LIMIT: Limit = { name: "login-ip", max: 30, windowSeconds: 15 * 60 };

/**
 * Reset requests per email. Each one sends a real message to a real inbox, so
 * the limit protects whoever owns that address from being mailbombed through
 * this form as much as it protects the shop.
 */
export const RESET_EMAIL_LIMIT: Limit = { name: "reset-email", max: 3, windowSeconds: 60 * 60 };

export const RESET_IP_LIMIT: Limit = { name: "reset-ip", max: 12, windowSeconds: 60 * 60 };

export type LimitVerdict =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/** Dev-only store, used when MONGODB_URI is not configured. */
const memoryCounters = new Map<string, { count: number; expiresAt: number }>();

function keyFor(limit: Limit, subject: string): string {
  return `${limit.name}:${subject.trim().toLowerCase()}`;
}

/**
 * Counts one attempt and says whether it is allowed.
 *
 * Call this *before* doing the work, and call `clearAttempts` once the attempt
 * turns out to have succeeded, so a person who gets their password right on the
 * fifth try starts from zero again rather than carrying four failures around
 * for the rest of the window.
 */
export async function consumeAttempt(limit: Limit, subject: string): Promise<LimitVerdict> {
  const key = keyFor(limit, subject);
  const now = Date.now();
  const windowMs = limit.windowSeconds * 1000;

  if (shouldUseSeedData()) {
    const existing = memoryCounters.get(key);
    const current =
      existing && existing.expiresAt > now ? existing : { count: 0, expiresAt: now + windowMs };
    current.count += 1;
    memoryCounters.set(key, current);

    return current.count > limit.max
      ? { allowed: false, retryAfterSeconds: Math.ceil((current.expiresAt - now) / 1000) }
      : { allowed: true };
  }

  const collection = await rateLimitsCollection();

  // The TTL monitor only runs about once a minute, so an expired window can
  // still be sitting there. Clearing it first keeps the increment below from
  // continuing a window that has already ended.
  await collection.deleteOne({ _id: key, expiresAt: { $lte: new Date(now) } });

  const updated = await collection.findOneAndUpdate(
    { _id: key },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date(now + windowMs) },
    },
    { upsert: true, returnDocument: "after" },
  );

  if (!updated) return { allowed: true };

  if (updated.count > limit.max) {
    const remaining = updated.expiresAt.getTime() - now;
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(remaining / 1000)) };
  }

  return { allowed: true };
}

/** Forgets the attempts for one subject, after a success. */
export async function clearAttempts(limit: Limit, subject: string): Promise<void> {
  const key = keyFor(limit, subject);

  if (shouldUseSeedData()) {
    memoryCounters.delete(key);
    return;
  }

  const collection = await rateLimitsCollection();
  await collection.deleteOne({ _id: key });
}

/**
 * The caller's IP, as far as it can be known.
 *
 * `x-forwarded-for` is a request header and anyone can write anything in it, so
 * this is a sorting key and not an identity: the limits above are sized on the
 * assumption that a determined caller can change it at will. Behind Vercel the
 * leftmost entry is the real client address.
 */
export async function callerIp(): Promise<string> {
  const headerList = await headers();

  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return headerList.get("x-real-ip") ?? "unknown";
}

/** "15 minutes", "1 minute" — for telling somebody how long they are locked out. */
export function describeWait(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  if (minutes <= 1) return "a minute";
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.ceil(minutes / 60);
  return hours === 1 ? "an hour" : `${hours} hours`;
}
