/**
 * Ported verbatim from zoho-books-clone ("Zeno") src/lib/payments/ref-format.ts.
 * See docs/PORTED.md.
 *
 * Gateway provider refs are long UUIDs or verbose conversation ids —
 * unreadable in an SMS or on a receipt. Compress to the last 8 alphanumeric
 * characters, uppercased, as a short code a landlord can actually read back
 * or note down.
 */
export function shortRef(providerRef: string): string {
  const alnum = (providerRef || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return alnum.slice(-8) || providerRef;
}
