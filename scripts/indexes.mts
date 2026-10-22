/**
 * Creates every index the app relies on, and touches no data.
 *
 *   npm run indexes
 *
 * Separate from `npm run seed` because seeding upserts the in-repo catalogue,
 * which is not something you want to do to a live shop just to add an index.
 * Run this after deploying a change that introduces a collection.
 *
 * Index creation is idempotent: an index that already exists with the same
 * options is a no-op.
 */
import { MongoClient } from "mongodb";
import { ensureIdempotencyIndex } from "../src/lib/db/idempotency-index.ts";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "smartshop";

if (!uri) {
  console.error(
    "MONGODB_URI is not set.\n" +
      "Copy .env.example to .env.local and put your connection string there.",
  );
  process.exit(1);
}

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(dbName);
  console.log(`Connected to "${dbName}"`);

  const made: string[] = [];
  const ensure = async <T,>(
    label: string,
    run: () => Promise<T>,
  ): Promise<T> => {
    const result = await run();
    made.push(label);
    return result;
  };

  await ensure("products.slug (unique)", () =>
    db.collection("products").createIndex({ slug: 1 }, { unique: true }),
  );
  await ensure("products.sku (unique, case-insensitive, sparse)", () =>
    db
      .collection("products")
      .createIndex(
        { sku: 1 },
        { unique: true, sparse: true, collation: { locale: "en", strength: 2 } },
      ),
  );
  await ensure("products.category", () =>
    db.collection("products").createIndex({ category: 1 }),
  );
  await ensure("products.featured", () =>
    db.collection("products").createIndex({ featured: -1 }),
  );
  await ensure("products.price", () => db.collection("products").createIndex({ price: 1 }));
  await ensure("products.variants.color", () =>
    db.collection("products").createIndex({ "variants.color": 1 }),
  );

  await ensure("users.email (unique)", () =>
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
  );

  await ensure("orders.createdAt", () =>
    db.collection("orders").createIndex({ createdAt: -1 }),
  );
  await ensure("orders.status", () => db.collection("orders").createIndex({ status: 1 }));
  await ensure("orders.reference (unique)", () =>
    db.collection("orders").createIndex({ reference: 1 }, { unique: true }),
  );
  await ensure("orders.userId + createdAt", () =>
    db.collection("orders").createIndex({ userId: 1, createdAt: -1 }),
  );
  const orders = db.collection("orders");
  const removedLegacyIndexes = await ensure(
    "orders.userId + idempotencyKey (unique, partial)",
    () => ensureIdempotencyIndex(orders),
  );
  for (const name of removedLegacyIndexes) {
    made.push(`removed legacy global idempotencyKey index (${name})`);
  }

  // expireAfterSeconds: 0 means "delete when expiresAt has passed", so each
  // document carries its own lifetime rather than the index fixing one.
  await ensure("passwordResets.expiresAt (TTL)", () =>
    db.collection("passwordResets").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  );
  await ensure("passwordResets.userId", () =>
    db.collection("passwordResets").createIndex({ userId: 1 }),
  );
  await ensure("rateLimits.expiresAt (TTL)", () =>
    db.collection("rateLimits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  );

  for (const label of made) console.log(`  ok  ${label}`);
  console.log(`\n${made.length} indexes ensured. No documents were read or written.`);
} finally {
  await client.close();
}
