import { describe, expect, it } from "vitest";
import { ACCOUNTS, cashAccountForMethod, incomeAccountForLineKind } from "../accounts";

describe("cashAccountForMethod", () => {
  it("routes both M-Pesa methods to the mpesa_cash account", () => {
    expect(cashAccountForMethod("mpesa_stk")).toBe(ACCOUNTS.MPESA_CASH);
    expect(cashAccountForMethod("mpesa_c2b")).toBe(ACCOUNTS.MPESA_CASH);
  });

  it("routes cash to cash_on_hand", () => {
    expect(cashAccountForMethod("cash")).toBe(ACCOUNTS.CASH_ON_HAND);
  });

  it("routes bank to bank", () => {
    expect(cashAccountForMethod("bank")).toBe(ACCOUNTS.BANK);
  });

  it("falls back to cash_on_hand for 'other'", () => {
    expect(cashAccountForMethod("other")).toBe(ACCOUNTS.CASH_ON_HAND);
  });
});

describe("incomeAccountForLineKind", () => {
  it("routes rent to rental_income", () => {
    expect(incomeAccountForLineKind("rent")).toBe(ACCOUNTS.RENTAL_INCOME);
  });

  it("routes deposit to deposit_liability — never income (Section 7 invariant)", () => {
    expect(incomeAccountForLineKind("deposit")).toBe(ACCOUNTS.DEPOSIT_LIABILITY);
    expect(incomeAccountForLineKind("deposit")).not.toBe(ACCOUNTS.RENTAL_INCOME);
  });

  it("routes late_fee to its own income account, not rental_income", () => {
    expect(incomeAccountForLineKind("late_fee")).toBe(ACCOUNTS.LATE_FEE_INCOME);
  });

  it("routes water/service_charge/garbage/other to pass_through_income", () => {
    expect(incomeAccountForLineKind("water")).toBe(ACCOUNTS.PASS_THROUGH_INCOME);
    expect(incomeAccountForLineKind("service_charge")).toBe(ACCOUNTS.PASS_THROUGH_INCOME);
    expect(incomeAccountForLineKind("garbage")).toBe(ACCOUNTS.PASS_THROUGH_INCOME);
    expect(incomeAccountForLineKind("other")).toBe(ACCOUNTS.PASS_THROUGH_INCOME);
  });
});
