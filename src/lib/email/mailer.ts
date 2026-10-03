import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Plain SMTP, so any provider works — Gmail, Resend, Mailgun, a cPanel mailbox.
 * Nothing here is provider-specific beyond what is in .env.local.
 *
 * Email is never allowed to break a checkout: if it is not configured, or the
 * send fails, the caller gets a result object and the order still stands.
 */

declare global {
  var __mailTransport: Transporter | undefined;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransport(): Transporter {
  globalThis.__mailTransport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    // Port 465 is implicit TLS; 587 upgrades with STARTTLS.
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return globalThis.__mailTransport;
}

function fromAddress(): string {
  return process.env.SMTP_FROM || `SmartShop <${process.env.SMTP_USER}>`;
}

export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; skipped: true }
  | { ok: false; skipped: false; error: string };

export async function sendMail(message: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  if (!isEmailConfigured()) {
    console.warn(
      `[email] SMTP is not configured — skipping "${message.subject}" to ${message.to}.\n` +
        "        Set SMTP_HOST, SMTP_USER and SMTP_PASS in .env.local to send for real.",
    );
    return { ok: false, skipped: true };
  }

  try {
    const info = await getTransport().sendMail({
      from: fromAddress(),
      // Replies reach a person rather than bouncing off the sending mailbox.
      // Spam filters also treat a valid Reply-To as a small positive signal.
      replyTo: process.env.REPLY_TO_EMAIL || process.env.OWNER_EMAIL || undefined,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      headers: {
        // Marks the message as transactional, not bulk marketing. Some filters
        // weigh this; none of it substitutes for a properly authenticated domain.
        "X-Auto-Response-Suppress": "OOF, AutoReply",
        Precedence: "transactional",
      },
    });
    console.log(`[email] Sent "${message.subject}" to ${message.to} (${info.messageId})`);
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[email] Failed to send "${message.subject}" to ${message.to}: ${reason}`);
    return { ok: false, skipped: false, error: reason };
  }
}

/** Checks the SMTP credentials without sending anything. Used by the test script. */
export async function verifyConnection(): Promise<{ ok: boolean; error?: string }> {
  if (!isEmailConfigured()) return { ok: false, error: "SMTP is not configured." };
  try {
    await getTransport().verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
