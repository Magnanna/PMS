import "server-only";
import { db } from "@/db";
import { journalEntries, journalLines } from "@/db/schema";
import type { AccountTag } from "./accounts";

export type JournalLineInput = {
  account: AccountTag;
  debitCents?: number;
  creditCents?: number;
  propertyId?: string;
  unitId?: string;
};

/**
 * The only writer to journal_entries/journal_lines (mirrors Zeno's
 * "posting.ts is the only writer" rule — every other module that needs to
 * post money goes through this). Enforces the append-only + debits==credits
 * invariants from PRD Section 7/NFR-1 before anything touches the DB.
 */
export async function postJournalEntry(input: {
  orgId: string;
  sourceType: string;
  sourceId: string;
  memo?: string;
  lines: JournalLineInput[];
}): Promise<string> {
  if (input.lines.length < 2) {
    throw new Error("A journal entry needs at least two lines (double-entry)");
  }

  const totalDebits = input.lines.reduce((sum, l) => sum + (l.debitCents ?? 0), 0);
  const totalCredits = input.lines.reduce((sum, l) => sum + (l.creditCents ?? 0), 0);

  if (totalDebits !== totalCredits) {
    throw new Error(
      `Journal entry does not balance: debits ${totalDebits} !== credits ${totalCredits}`
    );
  }
  if (totalDebits <= 0) {
    throw new Error("Journal entry must move a positive amount");
  }

  const [entry] = await db
    .insert(journalEntries)
    .values({
      orgId: input.orgId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      memo: input.memo ?? null,
    })
    .returning({ id: journalEntries.id });

  await db.insert(journalLines).values(
    input.lines.map((l) => ({
      entryId: entry.id,
      account: l.account,
      propertyId: l.propertyId ?? null,
      unitId: l.unitId ?? null,
      debitCents: l.debitCents ?? 0,
      creditCents: l.creditCents ?? 0,
    }))
  );

  return entry.id;
}
