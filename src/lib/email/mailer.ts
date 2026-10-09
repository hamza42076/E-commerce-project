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

    // An order sends two messages at once — one to the customer, one to the
    // shop. Without pooling nodemailer opens a separate connection for each,
    // and Gmail answers a second simultaneous connection from the same account
    // by resetting it: `read ECONNRESET`, one of the two emails silently lost,
    // seemingly at random. Pooling with a single connection makes the second
    // message queue behind the first instead of racing it, and saves
    // re-authenticating every time.
    pool: true,
    maxConnections: 1,
    maxMessages: 50,
    // Well inside Gmail's limits, but enough to stop a burst looking like one.
    rateDelta: 1000,
    rateLimit: 5,
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

  const envelope = {
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
  };

  // One retry. A dropped connection is the common failure here and it almost
  // always works a moment later; a refused login or a bad address will not, so
  // only transport-level errors are worth a second attempt.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const info = await getTransport().sendMail(envelope);
      console.log(`[email] Sent "${message.subject}" to ${message.to} (${info.messageId})`);
      return { ok: true, messageId: info.messageId };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);

      if (attempt === 1 && isTransient(error)) {
        console.warn(
          `[email] "${message.subject}" to ${message.to} failed (${reason}) — retrying.`,
        );
        // The pooled connection is the one that just broke; drop it so the
        // retry opens a fresh one rather than reusing a dead socket.
        resetTransport();
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }

      console.error(`[email] Failed to send "${message.subject}" to ${message.to}: ${reason}`);
      return { ok: false, skipped: false, error: reason };
    }
  }

  // Unreachable: the loop either returns or falls through the error branch.
  return { ok: false, skipped: false, error: "Unknown send failure." };
}

/** Dropped sockets and timeouts, as opposed to a rejected login or address. */
function isTransient(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code ?? "";
  const message = error instanceof Error ? error.message : String(error);
  return (
    ["ECONNRESET", "ETIMEDOUT", "ECONNECTION", "ESOCKET", "EPIPE", "EAI_AGAIN"].includes(code) ||
    /ECONNRESET|socket close|timed out|connection closed/i.test(message)
  );
}

function resetTransport(): void {
  try {
    globalThis.__mailTransport?.close();
  } catch {
    // Already gone; nothing to clean up.
  }
  globalThis.__mailTransport = undefined;
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
