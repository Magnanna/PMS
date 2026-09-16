import { describe, expect, it } from "vitest";
import { summarizePnlLines } from "../pnl-calc";
import { ACCOUNTS } from "@/lib/ledger/accounts";

describe("summarizePnlLines", () => {
  it("sums rental income (credit-normal) correctly", () => {
    const result = summarizePnlLines([
      { account: ACCOUNTS.RENTAL_INCOME, debitCents: 0, creditCents: 40_000_00 },
      { account: ACCOUNTS.RENTAL_INCOME, debitCents: 0, creditCents: 35_000_00 },
    ]);
    expect(result.totalIncomeCents).toBe(75_000_00);
    expect(result.totalExpenseCents).toBe(0);
    expect(result.netCents).toBe(75_000_00);
  });

  it("sums maintenance expense (debit-normal) as a positive expense figure", () => {
    const result = summarizePnlLines([
      { account: ACCOUNTS.MAINTENANCE_EXPENSE, debitCents: 5_000_00, creditCents: 0 },
    ]);
    expect(result.totalExpenseCents).toBe(5_000_00);
    expect(result.byAccount).toContainEqual({
      account: ACCOUNTS.MAINTENANCE_EXPENSE,
      amountCents: 5_000_00,
    });
  });

  it("computes net = income - expense", () => {
    const result = summarizePnlLines([
      { account: ACCOUNTS.RENTAL_INCOME, debitCents: 0, creditCents: 100_000_00 },
      { account: ACCOUNTS.MAINTENANCE_EXPENSE, debitCents: 15_000_00, creditCents: 0 },
    ]);
    expect(result.netCents).toBe(85_000_00);
  });

  it("ignores accounts outside the income/expense sets (e.g. cash/deposit)", () => {
    const result = summarizePnlLines([
      { account: ACCOUNTS.MPESA_CASH, debitCents: 0, creditCents: 40_000_00 },
      { account: ACCOUNTS.DEPOSIT_LIABILITY, debitCents: 0, creditCents: 40_000_00 },
    ]);
    expect(result.totalIncomeCents).toBe(0);
    expect(result.totalExpenseCents).toBe(0);
    expect(result.byAccount).toEqual([]);
  });

  it("omits an account from byAccount when its net is exactly zero", () => {
    const result = summarizePnlLines([
      { account: ACCOUNTS.RENTAL_INCOME, debitCents: 0, creditCents: 0 },
    ]);
    expect(result.byAccount).toEqual([]);
  });

  it("returns zeroed totals for an empty ledger slice (negative/edge case)", () => {
    const result = summarizePnlLines([]);
    expect(result).toEqual({ byAccount: [], totalIncomeCents: 0, totalExpenseCents: 0, netCents: 0 });
  });

  it("handles a net-negative month (expenses exceed income)", () => {
    const result = summarizePnlLines([
      { account: ACCOUNTS.RENTAL_INCOME, debitCents: 0, creditCents: 10_000_00 },
      { account: ACCOUNTS.MAINTENANCE_EXPENSE, debitCents: 25_000_00, creditCents: 0 },
    ]);
    expect(result.netCents).toBe(-15_000_00);
  });
});
