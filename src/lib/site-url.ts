import "server-only";
import { headers } from "next/headers";

/**
 * Where this site lives, for links that go into emails.
 *
 * Note what is *not* used in production: the request's own `Host` header. A
 * password-reset link is the one place that would matter — send a reset request
 * with `Host: attacker.example`, and the mail goes to the real owner of the
 * account carrying a real token pointed at somebody else's server. So the host
 * is taken from configuration or from Vercel's own environment, both of which
 * the caller cannot influence, and the header is trusted only in development
 * where it is how `localhost:3000` is discovered at all.
 */

function normalise(value: string): string {
  const withScheme = /^https?:\/\//.test(value) ? value : `https://${value}`;
  return withScheme.replace(/\/+$/, "");
}

export async function siteUrl(): Promise<string> {
  // Set this once a real domain exists; it wins over everything below.
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (configured) return normalise(configured);

  // Supplied by Vercel. The production hostname first, so a link mailed out
  // from a preview deployment still points at the live site.
  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return normalise(vercel);

  if (process.env.NODE_ENV !== "production") {
    const headerList = await headers();
    const host = headerList.get("host");
    if (host) {
      const scheme = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
      return `${scheme}://${host}`;
    }
  }

  // Nothing to go on. Better a visibly wrong link than one pointed wherever the
  // request asked it to be pointed.
  return "http://localhost:3000";
}
