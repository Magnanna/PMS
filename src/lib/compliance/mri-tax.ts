import "server-only";
import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { journalEntries, journalLines, orgs } from "@/db/schema";
import { ACCOUNTS } from "@/lib/ledger/accounts";
import { resolveComplianceConstants, type ComplianceConstants } from "./constants";
import { monthBoundsUtc, calculateMriTax } from "./mri-tax-calc";

export type MriTaxResult = {
  periodLabel: string; // "2026-09"
  grossRentCollectedCents: number;
  ratePct: number;
  taxDueCents: number;
  entryThresholdKes: number;
  belowThreshold: boolean;
};

/**
 * US-D2: MRI tax on gross rent COLLECTED (cash basis, not billed) in the
 * given EAT month — reads from the ledger (rental_income credits), never
 * from invoice totals, per Section 7's "reports read the ledger" rule.
 * All rate/threshold figures come from compliance/constants.ts — never
 * hard-code them here (Section 3/Section 12).
 */
export async function computeMriTax(
  orgId: string,
  year: number,
  month: number
): Promise<MriTaxResult> {
  const [org] = await db.select().from(orgs).where(eq(orgs.id, orgId));
  const constants: ComplianceConstants = resolveComplianceConstants(
    (org?.complianceOverrides as Partial<ComplianceConstants> | null) ?? null
  );

  const { start, end } = monthBoundsUtc(year, month);

  const rentCreditLines = await db
    .select({ creditCents: journalLines.creditCents })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(
      and(
        eq(journalEntries.orgId, orgId),
        eq(journalLines.account, ACCOUNTS.RENTAL_INCOME),
        gte(journalEntries.postedAt, start),
        lt(journalEntries.postedAt, end)
      )
    );

  const grossRentCollectedCents = rentCreditLines.reduce((sum, l) => sum + l.creditCents, 0);
  const { taxDueCents, belowThreshold } = calculateMriTax(grossRentCollectedCents, constants);

  return {
    periodLabel: `${year}-${String(month).padStart(2, "0")}`,
    grossRentCollectedCents,
    ratePct: constants.MRI_RATE_PCT,
    taxDueCents,
    entryThresholdKes: constants.MRI_ENTRY_THRESHOLD_KES,
    belowThreshold,
  };
}
