/**
 * Previews both order emails, and optionally sends them.
 *
 *   npm run email:preview                  writes two .html files, sends nothing
 *   npm run email:test -- you@example.com  checks SMTP, then sends both for real
 *
 * The customer confirmation goes to the address you pass. The owner
 * notification goes to OWNER_EMAIL, falling back to the same address.
 */
import { writeFile } from "node:fs/promises";
import nodemailer from "nodemailer";
import {
  newOrderOwnerEmail,
  orderConfirmationEmail,
} from "../src/lib/email/templates.ts";
import type { Order } from "../src/types/index.ts";

const recipient = process.argv.slice(2).find((arg) => arg.includes("@"));

const sampleOrder: Order = {
  id: "preview",
  reference: "SS-1042",
  customerName: "Ayesha Khan",
  email: recipient ?? "customer@example.com",
  phone: "03001234567",
  address: "House 42, Street 7, Gulberg III",
  city: "Lahore",
  notes: "Please call before arriving.",
  items: [
    { productId: "p-001", name: "Wireless Noise-Cancelling Headphones", price: 24999, quantity: 1 },
    { productId: "p-003", name: "65W USB-C Fast Charger", price: 4299, quantity: 2 },
  ],
  subtotal: 33597,
  delivery: 0,
  total: 33597,
  status: "pending",
  createdAt: new Date().toISOString(),
};

const customer = orderConfirmationEmail(sampleOrder);
const owner = newOrderOwnerEmail(sampleOrder);

await writeFile("email-preview-customer.html", customer.html);
await writeFile("email-preview-owner.html", owner.html);

console.log("Customer : " + customer.subject);
console.log("           -> email-preview-customer.html");
console.log("Owner    : " + owner.subject);
console.log("           -> email-preview-owner.html");
console.log("\nOpen those files in a browser to see how they look.");

if (!recipient) {
  console.log("\nNo address given, so nothing was sent.");
  console.log("To send for real:  npm run email:test -- you@example.com");
  process.exit(0);
}

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, OWNER_EMAIL } = process.env;

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.error("\nSMTP is not configured. Add SMTP_HOST, SMTP_USER and SMTP_PASS to .env.local.");
  process.exit(1);
}

const port = Number(SMTP_PORT ?? 587);
const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure: port === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

console.log(`\nChecking ${SMTP_HOST}:${port} ...`);
await transport.verify();
console.log("SMTP credentials accepted.");

const from = SMTP_FROM || `SmartShop <${SMTP_USER}>`;
const ownerTo = OWNER_EMAIL?.trim() || recipient;

for (const [label, to, mail] of [
  ["customer confirmation", recipient, customer],
  ["owner notification", ownerTo, owner],
] as const) {
  const info = await transport.sendMail({
    from,
    to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
  console.log(`Sent ${label} to ${to} (${info.messageId})`);
}

transport.close();
