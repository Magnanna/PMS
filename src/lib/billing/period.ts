/**
 * Pure billing-period/date helpers — deliberately zero external deps (no DB,
 * no env) so they're trivially unit-testable and reusable from the invoice
 * generator, the tax reminder (US-D3), and anything else that needs an
 * EAT-safe "today".
 */

const EAT_OFFSET_HOURS = 3; // Africa/Nairobi, UTC+3, no DST

/** "Today" as a Y-M-D triple in Africa/Nairobi, regardless of server timezone
 *  (NFR-4 — never use bare `NOW()`/`new Date()` day-of-month for billing). */
export function nairobiToday(referenceDate: Date): { year: number; month: number; day: number } {
  const eat = new Date(referenceDate.getTime() + EAT_OFFSET_HOURS * 60 * 60 * 1000);
  return { year: eat.getUTCFullYear(), month: eat.getUTCMonth() + 1, day: eat.getUTCDate() };
}

export function billingPeriodFor(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** Due date = billing day of the SAME period. Grace-period/late-fee logic is
 *  US-C4, not this. */
export function dueDateFor(year: number, month: number, billingDay: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(billingDay).padStart(2, "0")}`;
}

/** Short, org-unique, alphanumeric-safe reference — doubles as the M-Pesa
 *  AccountReference (Daraja rejects punctuation, so keep it plain) and stays
 *  under Daraja's ~12-char limit. Built from the unit id rather than the
 *  unit number: unit numbers ("A1") are only unique per-property, not
 *  per-org, so two properties sharing a unit number would otherwise collide
 *  on the (org_id, reference) unique constraint. */
export function invoiceReference(unitId: string, year: number, month: number): string {
  const idPart = unitId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `${idPart}${String(year).slice(-2)}${String(month).padStart(2, "0")}`;
}
