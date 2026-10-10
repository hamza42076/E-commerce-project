import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { passwordResetsCollection, type PasswordResetDoc } from "./mongo";
import { shouldUseSeedData } from "./fallback";

/**
 * Password-reset links.
 *
 * A link is a long random string, not a signed token. The signed tokens in
 * lib/auth/token.ts carry their own validity, which is exactly wrong here: a
 * reset link has to stop working the moment it is used, and nothing
 * self-contained can be withdrawn. So the server keeps a record and deletes it
 * on use.
 *
 * What is kept is the SHA-256 of the token. Reading this collection therefore
 * tells you that someone asked for a reset, but not how to complete one.
 * Hashing is a bare digest rather than scrypt on purpose — the input is 32
 * random bytes, so there is no dictionary to try and nothing for a slow hash to
 * slow down.
 */

export const RESET_TTL_MINUTES = 60;

function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

type MemoryReset = PasswordResetDoc;
const memoryResets: MemoryReset[] = [];

/**
 * Issues a link for one account and invalidates any earlier one.
 *
 * Returns the raw token, which exists only in the returned value and in the
 * email built from it. It is never written down anywhere it could be read back.
 */
export async function createPasswordReset(user: {
  id: string;
  email: string;
}): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const doc: PasswordResetDoc = {
    _id: digest(token),
    userId: user.id,
    email: user.email,
    createdAt: now,
    expiresAt: new Date(now.getTime() + RESET_TTL_MINUTES * 60 * 1000),
  };

  if (shouldUseSeedData()) {
    // Only the newest link works: asking again because the first email did not
    // arrive should not leave two usable links behind.
    for (let i = memoryResets.length - 1; i >= 0; i -= 1) {
      if (memoryResets[i].userId === user.id) memoryResets.splice(i, 1);
    }
    memoryResets.push(doc);
    return token;
  }

  const collection = await passwordResetsCollection();
  await collection.deleteMany({ userId: user.id });
  await collection.insertOne(doc);
  return token;
}

export type ResetLookup = { userId: string; email: string };

/**
 * Trades a token for the account it belongs to, and spends it.
 *
 * Single-use: the record is deleted as part of the same operation that reads
 * it, so two requests arriving together cannot both succeed.
 */
export async function consumePasswordReset(token: string): Promise<ResetLookup | null> {
  if (!token) return null;

  const id = digest(token);
  const now = Date.now();

  if (shouldUseSeedData()) {
    const index = memoryResets.findIndex((entry) => safeEqual(entry._id, id));
    if (index === -1) return null;
    const [found] = memoryResets.splice(index, 1);
    if (found.expiresAt.getTime() <= now) return null;
    return { userId: found.userId, email: found.email };
  }

  const collection = await passwordResetsCollection();
  const found = await collection.findOneAndDelete({ _id: id });
  if (!found) return null;

  // Expired links are deleted rather than left for the TTL monitor, so the
  // record is gone either way by the time this returns.
  if (found.expiresAt.getTime() <= now) return null;

  return { userId: found.userId, email: found.email };
}

/**
 * Says whether a token could still be spent, without spending it.
 *
 * The reset page calls this on load so somebody following a link that has
 * already been used, or has sat in an inbox overnight, is told so before
 * typing a new password rather than after.
 */
export async function peekPasswordReset(token: string): Promise<ResetLookup | null> {
  if (!token) return null;

  const id = digest(token);
  const now = Date.now();

  if (shouldUseSeedData()) {
    const found = memoryResets.find((entry) => safeEqual(entry._id, id));
    if (!found || found.expiresAt.getTime() <= now) return null;
    return { userId: found.userId, email: found.email };
  }

  const collection = await passwordResetsCollection();
  const found = await collection.findOne({ _id: id, expiresAt: { $gt: new Date(now) } });
  return found ? { userId: found.userId, email: found.email } : null;
}

/** Constant-time compare for the in-memory scan; Mongo's index lookup is its own matter. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Drops every outstanding link for an account, after the password changes. */
export async function clearPasswordResets(userId: string): Promise<void> {
  if (shouldUseSeedData()) {
    for (let i = memoryResets.length - 1; i >= 0; i -= 1) {
      if (memoryResets[i].userId === userId) memoryResets.splice(i, 1);
    }
    return;
  }

  const collection = await passwordResetsCollection();
  await collection.deleteMany({ userId });
}
