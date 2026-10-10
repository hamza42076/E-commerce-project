// Relative with an explicit extension, not the "@/" alias, so that
// scripts/test-email.mts can import this file under plain Node, which does not
// understand tsconfig path aliases. Same reason as scripts/seed.mts.
import { formatPrice } from "../format.ts";
import type { Order, OrderItem, OrderStatus } from "@/types";

/**
 * Order confirmation email.
 *
 * Email clients strip <style> blocks and external CSS, so everything is inline
 * and the layout is tables — ugly to write, but it is what renders in Outlook
 * and Gmail alike. Every message ships a plain-text part too, which matters for
 * deliverability as much as for accessibility.
 */

/** Customer-supplied values go into HTML, so they are escaped first. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BRAND = "#0d9488";
const INK = "#16161d";
const MUTED = "#6b6b7b";
const LINE = "#e7e7ee";

/**
 * The colour ordered, from the order's own snapshot — not looked up from the
 * product, which may have changed or been deleted since.
 */
function colorNote(item: OrderItem): string {
  if (!item.color) return "";
  return `<br /><span style="color:${MUTED};font-size:13px;">Colour: ${escapeHtml(item.color)}</span>`;
}

function colorText(item: OrderItem): string {
  return item.color ? ` (${item.color})` : "";
}

/** One line of a totals block. Shared by both emails. */
const totalRow = (label: string, value: string, bold = false) => `
    <tr>
      <td style="padding:6px 0;color:${bold ? INK : MUTED};font-size:${bold ? "16px" : "14px"};${bold ? "font-weight:600;" : ""}">
        ${label}
      </td>
      <td style="padding:6px 0;color:${INK};font-size:${bold ? "16px" : "14px"};text-align:right;${bold ? "font-weight:600;" : ""}">
        ${value}
      </td>
    </tr>`;

export function orderConfirmationEmail(order: Order): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Order ${order.reference} confirmed — SmartShop`;

  const itemRows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${LINE};color:${INK};font-size:14px;">
            ${escapeHtml(item.name)}
            <span style="color:${MUTED};">&times; ${item.quantity}</span>${colorNote(item)}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid ${LINE};color:${INK};font-size:14px;text-align:right;white-space:nowrap;">
            ${formatPrice(item.price * item.quantity)}
          </td>
        </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${LINE};">

            <tr>
              <td style="background:${BRAND};padding:24px;">
                <div style="color:#ffffff;font-size:20px;font-weight:600;">SmartShop</div>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 24px 8px;">
                <h1 style="margin:0 0 8px;color:${INK};font-size:22px;font-weight:600;">
                  Thanks, ${escapeHtml(order.customerName.split(" ")[0] ?? "there")} — your order is in.
                </h1>
                <p style="margin:0;color:${MUTED};font-size:14px;line-height:1.6;">
                  Your reference is
                  <strong style="color:${INK};">${escapeHtml(order.reference)}</strong>.
                  We will call you on ${escapeHtml(order.phone)} to confirm before dispatch.
                  Payment is cash on delivery.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 24px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td colspan="2" style="padding-bottom:4px;color:${MUTED};font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">
                      Your order
                    </td>
                  </tr>
                  ${itemRows}
                  ${totalRow("Subtotal", formatPrice(order.subtotal))}
                  ${totalRow("Delivery", order.delivery === 0 ? "Free" : formatPrice(order.delivery))}
                  ${totalRow("Total due on delivery", formatPrice(order.total), true)}
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:24px;">
                <div style="background:#f6f7fb;border-radius:8px;padding:16px;">
                  <div style="color:${MUTED};font-size:12px;text-transform:uppercase;letter-spacing:0.04em;padding-bottom:6px;">
                    Delivering to
                  </div>
                  <div style="color:${INK};font-size:14px;line-height:1.6;">
                    ${escapeHtml(order.customerName)}<br />
                    ${escapeHtml(order.address)}<br />
                    ${escapeHtml(order.city)}<br />
                    ${escapeHtml(order.phone)}
                  </div>
                  ${
                    order.notes
                      ? `<div style="color:${MUTED};font-size:13px;padding-top:10px;">Notes: ${escapeHtml(order.notes)}</div>`
                      : ""
                  }
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 24px 28px;color:${MUTED};font-size:13px;line-height:1.6;">
                Expect delivery in 2&ndash;4 working days. Reply to this email if anything
                looks wrong.
              </td>
            </tr>

            <tr>
              <td style="background:#f6f7fb;padding:16px 24px;color:${MUTED};font-size:12px;text-align:center;">
                SmartShop &middot; Prices in PKR &middot; Free delivery over Rs 5,000
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const lines = [
    `Thanks, ${order.customerName.split(" ")[0] ?? "there"} — your order is in.`,
    ``,
    `Reference: ${order.reference}`,
    `We will call you on ${order.phone} to confirm before dispatch.`,
    `Payment is cash on delivery.`,
    ``,
    `YOUR ORDER`,
    ...order.items.map(
      (item) =>
        `  ${item.name}${colorText(item)} x ${item.quantity} — ${formatPrice(item.price * item.quantity)}`,
    ),
    ``,
    `  Subtotal: ${formatPrice(order.subtotal)}`,
    `  Delivery: ${order.delivery === 0 ? "Free" : formatPrice(order.delivery)}`,
    `  Total due on delivery: ${formatPrice(order.total)}`,
    ``,
    `DELIVERING TO`,
    `  ${order.customerName}`,
    `  ${order.address}`,
    `  ${order.city}`,
    `  ${order.phone}`,
    ...(order.notes ? [`  Notes: ${order.notes}`] : []),
    ``,
    `Expect delivery in 2-4 working days.`,
    `SmartShop — prices in PKR, free delivery over Rs 5,000.`,
  ];

  return { subject, html, text: lines.join("\n") };
}

/**
 * Sent to the shop, not the customer. Written to be acted on from a phone
 * notification: the subject carries the reference and the amount, and the
 * phone number is a tel: link so it can be dialled from the email.
 */
export function newOrderOwnerEmail(order: Order): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `New order ${order.reference} — ${formatPrice(order.total)} — ${order.city}`;

  const itemRows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid ${LINE};color:${INK};font-size:14px;">
            <strong>${item.quantity} &times;</strong> ${escapeHtml(item.name)}${colorNote(item)}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid ${LINE};color:${MUTED};font-size:13px;text-align:right;white-space:nowrap;">
            ${formatPrice(item.price * item.quantity)}
          </td>
        </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${LINE};">

            <tr>
              <td style="background:${INK};padding:20px 24px;">
                <div style="color:#ffffff;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;">New order</div>
                <div style="color:#ffffff;font-size:24px;font-weight:600;padding-top:4px;">
                  ${escapeHtml(order.reference)} &middot; ${formatPrice(order.total)}
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 24px 0;">
                <div style="color:${MUTED};font-size:12px;text-transform:uppercase;letter-spacing:0.04em;padding-bottom:8px;">
                  Pack this
                </div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${itemRows}
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:24px;">
                <div style="background:#f6f7fb;border-radius:8px;padding:16px;">
                  <div style="color:${MUTED};font-size:12px;text-transform:uppercase;letter-spacing:0.04em;padding-bottom:6px;">
                    Deliver to
                  </div>
                  <div style="color:${INK};font-size:15px;font-weight:600;">
                    ${escapeHtml(order.customerName)}
                  </div>
                  <div style="color:${INK};font-size:14px;line-height:1.6;padding-top:4px;">
                    ${escapeHtml(order.address)}<br />
                    ${escapeHtml(order.city)}
                  </div>
                  <div style="padding-top:10px;">
                    <a href="tel:${encodeURIComponent(order.phone)}" style="color:${BRAND};font-size:16px;font-weight:600;text-decoration:none;">
                      ${escapeHtml(order.phone)}
                    </a>
                  </div>
                  <div style="color:${MUTED};font-size:13px;padding-top:4px;">
                    ${escapeHtml(order.email)}
                  </div>
                  ${
                    order.notes
                      ? `<div style="color:${INK};font-size:13px;padding-top:10px;border-top:1px solid ${LINE};margin-top:10px;"><strong>Customer notes:</strong> ${escapeHtml(order.notes)}</div>`
                      : ""
                  }
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:0 24px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${totalRow("Subtotal", formatPrice(order.subtotal))}
                  ${totalRow("Delivery", order.delivery === 0 ? "Free" : formatPrice(order.delivery))}
                  ${totalRow("Collect on delivery", formatPrice(order.total), true)}
                </table>
              </td>
            </tr>

            <tr>
              <td style="background:#f6f7fb;padding:16px 24px;color:${MUTED};font-size:12px;text-align:center;">
                Mark it shipped in the admin panel once it goes out.
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const lines = [
    `NEW ORDER ${order.reference} — ${formatPrice(order.total)}`,
    ``,
    `PACK THIS`,
    ...order.items.map(
      (item) => `  ${item.quantity} x ${item.name}${colorText(item)} — ${formatPrice(item.price * item.quantity)}`,
    ),
    ``,
    `DELIVER TO`,
    `  ${order.customerName}`,
    `  ${order.address}`,
    `  ${order.city}`,
    `  ${order.phone}`,
    `  ${order.email}`,
    ...(order.notes ? [`  Customer notes: ${order.notes}`] : []),
    ``,
    `  Subtotal: ${formatPrice(order.subtotal)}`,
    `  Delivery: ${order.delivery === 0 ? "Free" : formatPrice(order.delivery)}`,
    `  Collect on delivery: ${formatPrice(order.total)}`,
    ``,
    `Mark it shipped in the admin panel once it goes out.`,
  ];

  return { subject, html, text: lines.join("\n") };
}

/**
 * Sent to the customer when the shop changes an order's status from the admin
 * panel. One template, four tones — a cancellation should not read like a
 * dispatch notice.
 */

type StatusCopy = {
  subject: (reference: string) => string;
  heading: string;
  body: string;
  /** Accent colour for the status strip. Cancelled is the only sombre one. */
  stripe: string;
  showTotal: boolean;
};

const STATUS_COPY: Record<OrderStatus, StatusCopy> = {
  pending: {
    subject: (r) => `Order ${r} is being prepared — SmartShop`,
    heading: "We are preparing your order",
    body: "It is back in the queue and we will let you know as soon as it goes out for delivery.",
    stripe: "#f59e0b",
    showTotal: true,
  },
  shipped: {
    subject: (r) => `Order ${r} is on the way — SmartShop`,
    heading: "Your order is on the way",
    body: "It has left us and should reach you within 2 to 4 working days. Our rider will call before arriving.",
    stripe: "#0284c7",
    showTotal: true,
  },
  delivered: {
    subject: (r) => `Order ${r} delivered — SmartShop`,
    heading: "Delivered. Thank you.",
    body: "Your order has been marked delivered. If anything is missing or not right, reply to this email within 7 days and we will sort it out.",
    stripe: "#059669",
    showTotal: false,
  },
  cancelled: {
    subject: (r) => `Order ${r} has been cancelled — SmartShop`,
    heading: "Your order has been cancelled",
    body: "This order will not be delivered and there is nothing to pay. If you did not expect this, reply to this email and we will look into it.",
    stripe: "#e11d48",
    showTotal: false,
  },
};

export function orderStatusEmail(order: Order): {
  subject: string;
  html: string;
  text: string;
} {
  const copy = STATUS_COPY[order.status];

  const itemLines = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid ${LINE};color:${INK};font-size:14px;">
            ${escapeHtml(item.name)} <span style="color:${MUTED};">&times; ${item.quantity}</span>${colorNote(item)}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid ${LINE};color:${INK};font-size:14px;text-align:right;white-space:nowrap;">
            ${formatPrice(item.price * item.quantity)}
          </td>
        </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${LINE};">

            <tr><td style="background:${copy.stripe};height:5px;"></td></tr>

            <tr>
              <td style="padding:24px 24px 0;">
                <div style="color:${BRAND};font-size:18px;font-weight:600;">SmartShop</div>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 24px 0;">
                <h1 style="margin:0 0 10px;color:${INK};font-size:22px;font-weight:600;">
                  ${copy.heading}
                </h1>
                <p style="margin:0;color:${MUTED};font-size:14px;line-height:1.6;">
                  Order <strong style="color:${INK};">${escapeHtml(order.reference)}</strong>.
                  ${copy.body}
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:22px 24px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td colspan="2" style="padding-bottom:4px;color:${MUTED};font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">
                      In this order
                    </td>
                  </tr>
                  ${itemLines}
                  ${
                    copy.showTotal
                      ? totalRow("Due on delivery", formatPrice(order.total), true)
                      : totalRow("Order total", formatPrice(order.total))
                  }
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:22px 24px;">
                <div style="background:#f6f7fb;border-radius:8px;padding:16px;">
                  <div style="color:${MUTED};font-size:12px;text-transform:uppercase;letter-spacing:0.04em;padding-bottom:6px;">
                    Delivery address
                  </div>
                  <div style="color:${INK};font-size:14px;line-height:1.6;">
                    ${escapeHtml(order.customerName)}<br />
                    ${escapeHtml(order.address)}<br />
                    ${escapeHtml(order.city)}<br />
                    ${escapeHtml(order.phone)}
                  </div>
                </div>
              </td>
            </tr>

            <tr>
              <td style="background:#f6f7fb;padding:16px 24px;color:${MUTED};font-size:12px;text-align:center;">
                SmartShop &middot; Prices in PKR &middot; Free delivery over Rs 5,000
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const lines = [
    copy.heading.toUpperCase(),
    ``,
    `Order ${order.reference}.`,
    copy.body,
    ``,
    `IN THIS ORDER`,
    ...order.items.map(
      (item) =>
        `  ${item.name}${colorText(item)} x ${item.quantity} — ${formatPrice(item.price * item.quantity)}`,
    ),
    ``,
    `  ${copy.showTotal ? "Due on delivery" : "Order total"}: ${formatPrice(order.total)}`,
    ``,
    `DELIVERY ADDRESS`,
    `  ${order.customerName}`,
    `  ${order.address}`,
    `  ${order.city}`,
    `  ${order.phone}`,
    ``,
    `SmartShop — prices in PKR, free delivery over Rs 5,000.`,
  ];

  return { subject: copy.subject(order.reference), html, text: lines.join("\n") };
}

/**
 * The password-reset link.
 *
 * Says plainly that nothing has happened yet and that ignoring the message is
 * safe, because the person reading it may not be the person who asked for it —
 * a mistyped address on the form sends this to a stranger, and the honest
 * version of that email is one that does not alarm them.
 *
 * The URL appears twice: as a button, and as text underneath. Plenty of mail
 * clients and corporate gateways mangle or strip the link on a styled button,
 * and a reset email that cannot be followed is worse than no email.
 */
export function passwordResetEmail(input: {
  name: string;
  resetUrl: string;
  expiresMinutes: number;
}): { subject: string; html: string; text: string } {
  const subject = "Reset your SmartShop password";
  const safeUrl = escapeHtml(input.resetUrl);
  const expiry =
    input.expiresMinutes >= 60
      ? `${Math.round(input.expiresMinutes / 60)} hour${input.expiresMinutes >= 120 ? "s" : ""}`
      : `${input.expiresMinutes} minutes`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${LINE};">

            <tr>
              <td style="background:${BRAND};padding:24px;">
                <div style="color:#ffffff;font-size:20px;font-weight:600;">SmartShop</div>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 24px 0;">
                <h1 style="margin:0 0 12px;color:${INK};font-size:22px;font-weight:600;">
                  Reset your password
                </h1>
                <p style="margin:0;color:${MUTED};font-size:14px;line-height:1.6;">
                  Hi ${escapeHtml(input.name)}, somebody asked to reset the password for this
                  email address. Choose a new one using the button below.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:24px 24px 0;" align="center">
                <a href="${safeUrl}"
                   style="display:inline-block;background:${BRAND};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:8px;">
                  Choose a new password
                </a>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 24px 0;">
                <p style="margin:0;color:${MUTED};font-size:13px;line-height:1.6;">
                  Or paste this into your browser:
                </p>
                <p style="margin:6px 0 0;word-break:break-all;">
                  <a href="${safeUrl}" style="color:${BRAND};font-size:13px;">${safeUrl}</a>
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:22px 24px;">
                <div style="background:#f6f7fb;border-radius:8px;padding:16px;color:${MUTED};font-size:13px;line-height:1.6;">
                  This link works once and expires in ${expiry}.
                  If you did not ask for it, you can ignore this email —
                  your password has not been changed.
                </div>
              </td>
            </tr>

            <tr>
              <td style="background:#f6f7fb;padding:16px 24px;color:${MUTED};font-size:12px;text-align:center;">
                SmartShop &middot; We will never ask you for your password by email
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `RESET YOUR PASSWORD`,
    ``,
    `Hi ${input.name}, somebody asked to reset the password for this email`,
    `address. Open the link below to choose a new one:`,
    ``,
    `  ${input.resetUrl}`,
    ``,
    `This link works once and expires in ${expiry}.`,
    `If you did not ask for it, ignore this email — your password has not`,
    `been changed.`,
    ``,
    `SmartShop — we will never ask you for your password by email.`,
  ].join("\n");

  return { subject, html, text };
}
