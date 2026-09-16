/**
 * Pure P&L aggregation — zero DB/env deps, split out from pnl.ts (same
 * reasoning as billing/period.ts and compliance/mri-tax-calc.ts) so it's
 * directly unit-testable.
 */
import { ACCOUNTS } from "@/lib/ledger/accounts";

const INCOME_ACCOUNTS = [
  ACCOUNTS.RENTAL_INCOME,
  ACCOUNTS.PASS_THROUGH_INCOME,
  ACCOUNTS.LATE_FEE_INCOME,
] as const;
const EXPENSE_ACCOUNTS = [ACCOUNTS.MAINTENANCE_EXPENSE] as const;

export type PnlLine = { account: string; debitCents: number; creditCents: number };

export type PnlSummary = {
  byAccount: { account: string; amountCents: number }[];
  totalIncomeCents: number;
  totalExpenseCents: number;
  netCents: number;
};

export function summarizePnlLines(lines: PnlLine[]): PnlSummary {
  const byAccountMap = new Map<string, number>();
  for (const line of lines) {
    const net = line.creditCents - line.debitCents; // income accounts: credit-normal
    byAccountMap.set(line.account, (byAccountMap.get(line.account) ?? 0) + net);
  }

  let totalIncomeCents = 0;
  let totalExpenseCents = 0;
  const byAccount: { account: string; amountCents: number }[] = [];

  for (const account of INCOME_ACCOUNTS) {
    const amountCents = byAccountMap.get(account) ?? 0;
    if (amountCents !== 0) byAccount.push({ account, amountCents });
    totalIncomeCents += amountCents;
  }
  for (const account of EXPENSE_ACCOUNTS) {
    // Expense accounts are debit-normal — flip sign for display as a
    // positive expense figure.
    const amountCents = -(byAccountMap.get(account) ?? 0);
    if (amountCents !== 0) byAccount.push({ account, amountCents });
    totalExpenseCents += amountCents;
  }

  return {
    byAccount,
    totalIncomeCents,
    totalExpenseCents,
    netCents: totalIncomeCents - totalExpenseCents,
  };
}
