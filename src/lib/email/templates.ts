// Relative with an explicit extension, not the "@/" alias, so that
// scripts/test-email.mts can import this file under plain Node, which does not
// understand tsconfig path aliases. Same reason as scripts/seed.mts.
import { formatPrice } from "../format.ts";
import type { Order } from "@/types";

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
            <span style="color:${MUTED};">&times; ${item.quantity}</span>
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
        `  ${item.name} x ${item.quantity} — ${formatPrice(item.price * item.quantity)}`,
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
            <strong>${item.quantity} &times;</strong> ${escapeHtml(item.name)}
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
      (item) => `  ${item.quantity} x ${item.name} — ${formatPrice(item.price * item.quantity)}`,
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
