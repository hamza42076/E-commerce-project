/**
 * Seeds the MongoDB database from the in-repo catalogue.
 *
 *   npm run seed
 *
 * Safe to re-run: products and categories are upserted by id, so local edits to
 * seed-products.ts are pushed up without duplicating rows. Pass --fresh to drop
 * the collections first.
 */
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { seedCategories, seedProducts } from "../src/lib/db/seed-products.ts";
import type { CategoryDoc, ProductDoc, UserDoc } from "../src/lib/db/mongo.ts";
import { DEMO_ACCOUNTS } from "../src/lib/db/demo-accounts.ts";
import { hashPassword } from "../src/lib/auth/password.ts";

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
      db.collection("users").deleteMany({}),
      db.collection("orders").deleteMany({}),
    ]);
    console.log("Cleared products, categories, users and orders");
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

  // Demo accounts, so there is a way in as soon as the database is up. Only
  // inserted when missing — a password changed later is never overwritten.
  const users = db.collection<UserDoc>("users");
  let usersAdded = 0;
  for (const account of DEMO_ACCOUNTS) {
    const existing = await users.findOne({ email: account.email });
    if (existing) continue;
    await users.insertOne({
      _id: randomUUID(),
      name: account.name,
      email: account.email,
      role: account.role,
      passwordHash: await hashPassword(account.password),
      createdAt: new Date().toISOString(),
    });
    usersAdded += 1;
  }

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
  ]);

  console.log(
    `Categories: ${categoryResult.upsertedCount} added, ${categoryResult.modifiedCount} updated`,
  );
  console.log(
    `Products:   ${productResult.upsertedCount} added, ${productResult.modifiedCount} updated`,
  );
  console.log(`Totals:     ${await products.countDocuments()} products, ${await categories.countDocuments()} categories`);
  console.log(`Users:      ${usersAdded} demo account(s) added`);
  console.log("Indexes ensured on products, users and orders");
} finally {
  await client.close();
}
