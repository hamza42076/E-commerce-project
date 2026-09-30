import "server-only";
import { randomUUID } from "node:crypto";
import type { User, UserRecord, UserRole } from "@/types";
import { usersCollection, type UserDoc } from "./mongo";
import { shouldUseSeedData } from "./fallback";
import { DEMO_ACCOUNTS } from "./demo-accounts";
import { hashPassword } from "@/lib/auth/password";

/**
 * User storage. Without MongoDB these live in a module-level array, which means
 * accounts created in development disappear when the dev server restarts. The
 * two demo accounts below are re-seeded every time so signing in always works.
 */

let memoryUsers: UserRecord[] | null = null;

async function memoryStore(): Promise<UserRecord[]> {
  if (memoryUsers) return memoryUsers;

  memoryUsers = await Promise.all(
    DEMO_ACCOUNTS.map(async (account) => ({
      id: `demo-${account.role}`,
      name: account.name,
      email: account.email,
      role: account.role as UserRole,
      passwordHash: await hashPassword(account.password),
      createdAt: new Date().toISOString(),
    })),
  );
  return memoryUsers;
}

/**
 * An allowlist rather than "everything except passwordHash", so any secret
 * added to UserRecord later has to be opted in before it can reach a client.
 */
function toUser(record: UserRecord): User {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    createdAt: record.createdAt,
  };
}

function fromDoc(doc: UserDoc): UserRecord {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const normalised = email.trim().toLowerCase();

  if (shouldUseSeedData()) {
    const store = await memoryStore();
    return store.find((user) => user.email === normalised) ?? null;
  }

  const collection = await usersCollection();
  const doc = await collection.findOne({ email: normalised });
  return doc ? fromDoc(doc) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  if (shouldUseSeedData()) {
    const store = await memoryStore();
    const found = store.find((user) => user.id === id);
    return found ? toUser(found) : null;
  }

  const collection = await usersCollection();
  const doc = await collection.findOne({ _id: id });
  return doc ? toUser(fromDoc(doc)) : null;
}

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
};

/** Returns null when the email is already taken. */
export async function createUser(input: CreateUserInput): Promise<User | null> {
  const email = input.email.trim().toLowerCase();
  const existing = await findUserByEmail(email);
  if (existing) return null;

  const record: UserRecord = {
    id: randomUUID(),
    name: input.name.trim(),
    email,
    role: input.role ?? "customer",
    passwordHash: await hashPassword(input.password),
    createdAt: new Date().toISOString(),
  };

  if (shouldUseSeedData()) {
    const store = await memoryStore();
    store.push(record);
    return toUser(record);
  }

  const collection = await usersCollection();
  const { id, ...rest } = record;
  await collection.insertOne({ _id: id, ...rest });
  return toUser(record);
}

export async function countUsers(): Promise<number> {
  if (shouldUseSeedData()) {
    const store = await memoryStore();
    return store.length;
  }
  const collection = await usersCollection();
  return collection.countDocuments();
}

export { toUser };
