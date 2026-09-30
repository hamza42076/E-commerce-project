import type { UserRole } from "@/types";

/**
 * Accounts that always exist so there is a way in on a fresh checkout. The seed
 * script inserts them into MongoDB, and the in-memory fallback recreates them on
 * every dev server start. Replace or remove them before going live.
 */
export const DEMO_ACCOUNTS = [
  { email: "admin@smartshop.pk", password: "Admin1234", name: "Store Admin", role: "admin" },
  { email: "demo@smartshop.pk", password: "Demo1234", name: "Demo Customer", role: "customer" },
] as const satisfies readonly { email: string; password: string; name: string; role: UserRole }[];
