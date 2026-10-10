/**
 * Seeds the MongoDB database from the in-repo catalogue.
 *
 *   npm run seed
 *
 * Safe to re-run: products and categories are upserted by id, so local edits to
 * seed-products.ts are pushed up without duplicating rows. Pass --fresh to drop
 * them first.
 *
 * No accounts are created here — see scripts/set-admin.mts.
 */
import { MongoClient } from "mongodb";
import { seedCategories, seedProducts } from "../src/lib/db/seed-products.ts";
import type { CategoryDoc, ProductDoc, UserDoc } from "../src/lib/db/mongo.ts";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "smartshop";
const fresh = process.argv.includes("--fresh");

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

  const products = db.collection<ProductDoc>("products");
  const categories = db.collection<CategoryDoc>("categories");

  if (fresh) {
    await Promise.all([
      products.deleteMany({}),
      categories.deleteMany({}),
      db.collection("orders").deleteMany({}),
    ]);
    console.log("Cleared products, categories and orders");
  }

  const categoryResult = await categories.bulkWrite(
    seedCategories.map((category, index) => ({
      updateOne: {
        filter: { _id: category.slug },
        update: { $set: { name: category.name, position: index } },
        upsert: true,
      },
    })),
  );

  const productResult = await products.bulkWrite(
    seedProducts.map(({ id, ...rest }) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: rest },
        upsert: true,
      },
    })),
  );

  // No accounts are seeded. A known email and password shipped with the code
  // would mean every deployment starts with a published way in. Customers sign
  // up through the site; make the administrator with `npm run admin`.
  const users = db.collection<UserDoc>("users");

  await Promise.all([
    products.createIndex({ slug: 1 }, { unique: true }),
    // Unique, case-insensitive, and sparse so documents written before SKUs
    // existed (which have no sku field) do not all collide on null.
    products.createIndex(
      { sku: 1 },
      { unique: true, sparse: true, collation: { locale: "en", strength: 2 } },
    ),
    products.createIndex({ category: 1 }),
    products.createIndex({ featured: -1 }),
    products.createIndex({ price: 1 }),
    products.createIndex({ "variants.color": 1 }),
    users.createIndex({ email: 1 }, { unique: true }),
    db.collection("orders").createIndex({ createdAt: -1 }),
    db.collection("orders").createIndex({ status: 1 }),

    // Both of these collections are entirely short-lived rows, so each one is
    // swept by a TTL index on its own expiry instead of accumulating forever.
    // expireAfterSeconds: 0 means "delete once expiresAt is in the past", which
    // lets each document carry its own lifetime — an hour for a reset link,
    // fifteen minutes or an hour for a rate-limit window.
    db.collection("passwordResets").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("passwordResets").createIndex({ userId: 1 }),
    db.collection("rateLimits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);

  console.log(
    `Categories: ${categoryResult.upsertedCount} added, ${categoryResult.modifiedCount} updated`,
  );
  console.log(
    `Products:   ${productResult.upsertedCount} added, ${productResult.modifiedCount} updated`,
  );
  console.log(`Totals:     ${await products.countDocuments()} products, ${await categories.countDocuments()} categories`);
  console.log("Indexes ensured on products, users, orders, passwordResets and rateLimits");
} finally {
  await client.close();
}
