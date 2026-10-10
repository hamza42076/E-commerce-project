/**
 * Catches a mistyped email domain before it costs anything.
 *
 * Four order confirmations on this shop bounced because the address was one
 * letter out. A mistyped domain is accepted by the sending server and only
 * bounces minutes later, to the shop rather than the customer, so from their
 * side the email simply never arrives.
 *
 * This only ever *suggests*. The typed address stays valid and submittable —
 * plenty of real domains look like typos of popular ones.
 */

/** The domains worth guarding, by how often they are typed here. */
const COMMON_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "live.com",
  "protonmail.com",
];

/** Exact mistypes seen often enough to be worth naming outright. */
const KNOWN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmail.om": "gmail.com",
  "gnail.com": "gmail.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "hotmai.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloook.com": "outlook.com",
  "iclod.com": "icloud.com",
};

/** Single-edit distance, capped at 2 — anything further apart is not a typo. */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;

  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const next =
        a[i - 1] === b[j - 1]
          ? diagonal
          : 1 + Math.min(diagonal, previous[j], previous[j - 1]);
      diagonal = previous[j];
      previous[j] = next;
    }
  }

  return previous[b.length];
}

/**
 * A likelier spelling of the address, or null when it looks fine.
 *
 * Only the domain is checked. The local part is the person's own name and
 * guessing at it would be noise — `coodinakakeera` is indistinguishable from a
 * deliberate spelling to anything but the person typing it.
 */
export function suggestEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (COMMON_DOMAINS.includes(domain)) return null;

  const known = KNOWN_TYPOS[domain];
  if (known) return `${local}@${known}`;

  // Otherwise, the nearest common domain if it is within one or two edits.
  let best: { domain: string; distance: number } | null = null;
  for (const candidate of COMMON_DOMAINS) {
    const distance = editDistance(domain, candidate);
    if (distance <= 2 && (!best || distance < best.distance)) {
      best = { domain: candidate, distance };
    }
  }

  return best ? `${local}@${best.domain}` : null;
}
