/**
 * Creates the shop's admin account, or changes its password.
 *
 *   npm run admin -- beelaal2024@gmail.com "Your Name"
 *
 * The password is prompted without echo and hashed here, not passed as a
 * command-line argument. Pick one used for nothing else.
 *
 * Re-running with the same email changes that account's password rather than
 * creating a second one.
 */
import { randomUUID } from "node:crypto";
import { StringDecoder } from "node:string_decoder";
import { MongoClient } from "mongodb";
import { hashPassword } from "../src/lib/auth/password.ts";
import type { UserDoc } from "../src/lib/db/mongo.ts";

const [emailArg, nameArg] = process.argv.slice(2);

function fail(message: string): never {
  console.error(message);
  console.error("");
  console.error('Usage: npm run admin -- <email> ["Display Name"]');
  process.exit(1);
}

if (!emailArg) fail("An email is required.");

const email = emailArg.trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(`"${emailArg}" is not an email address.`);

const uri = process.env.MONGODB_URI;
if (!uri) fail("MONGODB_URI is not set. Check .env.local.");

function readPasswordWithoutEcho(): Promise<string> {
  const input = process.stdin;
  if (!input.isTTY) {
    fail("Run this command in an interactive terminal to enter the password securely.");
  }

  return new Promise((resolve, reject) => {
    const decoder = new StringDecoder("utf8");
    let password = "";

    const cleanup = () => {
      input.off("data", onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write("\n");
    };

    const onData = (chunk: Buffer) => {
      for (const character of decoder.write(chunk)) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Password entry cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(password);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          password = Array.from(password).slice(0, -1).join("");
        } else if (character >= " ") {
          password += character;
        }
      }
    };

    try {
      input.setRawMode(true);
      input.resume();
      input.on("data", onData);
      process.stdout.write("Admin password (input hidden): ");
    } catch (error) {
      reject(error);
    }
  });
}

const passwordArg = await readPasswordWithoutEcho();

// The same rules the signup form enforces, so an account made here could also
// have been made through the site.
if (passwordArg.length < 8) fail("The password must be at least 8 characters.");
if (!/[a-zA-Z]/.test(passwordArg)) fail("The password needs at least one letter.");
if (!/[0-9]/.test(passwordArg)) fail("The password needs at least one number.");

const client = new MongoClient(uri);

try {
  await client.connect();
  const users = client
    .db(process.env.MONGODB_DB || "smartshop")
    .collection<UserDoc>("users");

  const existing = await users.findOne({ email });
  const passwordHash = await hashPassword(passwordArg);

  if (existing) {
    await users.updateOne(
      { _id: existing._id },
      { $set: { passwordHash, role: "admin", ...(nameArg ? { name: nameArg } : {}) } },
    );
    console.log(`Updated ${email}: new password set, role is admin.`);
  } else {
    await users.insertOne({
      _id: randomUUID(),
      name: nameArg?.trim() || "Store Admin",
      email,
      role: "admin",
      passwordHash,
      createdAt: new Date().toISOString(),
    });
    console.log(`Created admin ${email}.`);
  }

  const total = await users.countDocuments();
  const admins = await users.countDocuments({ role: "admin" });
  console.log(`${total} account(s) in total, ${admins} of them admin.`);
  console.log("");
  console.log("Sign in at /login. The password is not stored anywhere but in your head.");
} finally {
  await client.close();
}
