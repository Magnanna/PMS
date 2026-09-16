import "server-only";
import { and, eq, gte, lt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { journalEntries, journalLines, units } from "@/db/schema";
import { summarizePnlLines, type PnlSummary } from "./pnl-calc";

export type PnlResult = PnlSummary & { vacancyLossCents: number };

/**
 * US-G2: per-property (or whole-org, if propertyId omitted) P&L for a date
 * range, read from the ledger — never document totals (Section 7).
 * Vacancy loss (expected rent of currently-vacant units) is read from
 * units, not the ledger, since a vacant unit generates no journal lines by
 * definition — that's the whole point of showing it.
 */
export async function computePnl(
  orgId: string,
  startDate: Date,
  endDate: Date,
  propertyId?: string
): Promise<PnlResult> {
  const lines = await db
    .select({
      account: journalLines.account,
      debitCents: journalLines.debitCents,
      creditCents: journalLines.creditCents,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(
      and(
        eq(journalEntries.orgId, orgId),
        gte(journalEntries.postedAt, startDate),
        lt(journalEntries.postedAt, endDate),
        propertyId ? eq(journalLines.propertyId, propertyId) : undefined
      )
    );

  const summary = summarizePnlLines(lines);

  const vacantUnits = await db
    .select({ rentAmountCents: units.rentAmountCents })
    .from(units)
    .where(
      and(
        eq(units.orgId, orgId),
        eq(units.status, "vacant"),
        isNull(units.archivedAt),
        propertyId ? eq(units.propertyId, propertyId) : undefined
      )
    );
  const vacancyLossCents = vacantUnits.reduce((sum, u) => sum + u.rentAmountCents, 0);

  return { ...summary, vacancyLossCents };
}
