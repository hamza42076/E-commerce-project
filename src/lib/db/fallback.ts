import "server-only";
import { isConfigured } from "./mongo";

/**
 * Without MONGODB_URI the repositories fall back to in-memory data so the app
 * still runs locally. In production that would mean quietly serving fake stock
 * and losing every order, so it throws instead.
 */

let warned = false;

export function shouldUseSeedData(): boolean {
  if (isConfigured()) return false;

  if (process.env.NODE_ENV === "production") {
    throw new Error("MONGODB_URI is not set. Refusing to run on in-memory data in production.");
  }

  if (!warned) {
    warned = true;
    console.warn(
      "\n[db] MONGODB_URI is not set — using the in-memory catalogue.\n" +
        "     Products come from seed-products.ts. New users and orders live only\n" +
        "     until the dev server restarts. Copy .env.example to .env.local and\n" +
        "     run `npm run seed` to switch to MongoDB.\n",
    );
  }
  return true;
}
