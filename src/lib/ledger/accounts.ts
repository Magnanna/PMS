/**
 * Ledger account tags (Section 7: "simple account tag for v1 ... rather
 * than a full COA table"). One flat string enum instead of a chart-of-
 * accounts table — keep every account reference going through this file so
 * a typo doesn't silently create a new phantom account.
 */
export const ACCOUNTS = {
  MPESA_CASH: "mpesa_cash",
  CASH_ON_HAND: "cash_on_hand",
  BANK: "bank",
  RENTAL_INCOME: "rental_income",
  PASS_THROUGH_INCOME: "pass_through_income", // water/service charge/garbage — US-C8
  DEPOSIT_LIABILITY: "deposit_liability",
  // Overpayment beyond what's currently invoiced — a liability (money owed
  // back to or on behalf of the tenant), never income. Full credit-balance
  // UI/auto-apply-to-next-invoice is the rest of US-C7, not yet built; this
  // is the ledger-correctness half so debits==credits still holds today.
  UNAPPLIED_RECEIPTS: "unapplied_receipts",
  LATE_FEE_INCOME: "late_fee_income",
  MAINTENANCE_EXPENSE: "maintenance_expense",
  MRI_TAX_PAYABLE: "mri_tax_payable",
} as const;

export type AccountTag = (typeof ACCOUNTS)[keyof typeof ACCOUNTS];

/** Which cash/bank-side account a payment method posts against. */
export function cashAccountForMethod(method: "mpesa_stk" | "mpesa_c2b" | "cash" | "bank" | "other"): AccountTag {
  switch (method) {
    case "mpesa_stk":
    case "mpesa_c2b":
      return ACCOUNTS.MPESA_CASH;
    case "cash":
      return ACCOUNTS.CASH_ON_HAND;
    case "bank":
      return ACCOUNTS.BANK;
    default:
      return ACCOUNTS.CASH_ON_HAND;
  }
}

/** Which income/liability account an invoice line kind posts against. */
export function incomeAccountForLineKind(
  kind: "rent" | "water" | "service_charge" | "garbage" | "deposit" | "late_fee" | "other"
): AccountTag {
  switch (kind) {
    case "rent":
      return ACCOUNTS.RENTAL_INCOME;
    case "deposit":
      return ACCOUNTS.DEPOSIT_LIABILITY;
    case "late_fee":
      return ACCOUNTS.LATE_FEE_INCOME;
    case "water":
    case "service_charge":
    case "garbage":
    case "other":
      return ACCOUNTS.PASS_THROUGH_INCOME;
  }
}
