/**
 * Single source of truth for Kenyan statutory constants (PRD v2 Section 3).
 * Never hard-code a rate/threshold/cap anywhere else in the app — import
 * from here so a law change (Finance Act, RRI Regulations, etc.) is a
 * one-file edit. Re-verify against KRA guidance before launch and after
 * every Finance Act (OQ-2).
 */

export type ComplianceConstants = {
  /** MRI = Monthly Rental Income tax rate, percent. */
  MRI_RATE_PCT: number;
  /** Historically the ~monthly gross-rent entry threshold; draft RRI Regs
   *  (22 Mar 2026) propose this as an ANNUAL figure instead. Verify before
   *  filing use — see OQ-2 in the PRD. */
  MRI_ENTRY_THRESHOLD_KES: number;
  /** Rent Restriction Act (Cap 304) controlled-tenancy cap, KES/month. */
  CONTROLLED_TENANCY_CAP_KES: number;
  /** MRI return + payment due day of the month following collection. */
  MRI_DUE_DAY_OF_MONTH: number;
};

export const DEFAULT_COMPLIANCE_CONSTANTS: ComplianceConstants = {
  // 7.5% retained by Finance Act 2025 (proposed 10% dropped).
  MRI_RATE_PCT: 7.5,
  MRI_ENTRY_THRESHOLD_KES: 288_000,
  CONTROLLED_TENANCY_CAP_KES: 2_500,
  MRI_DUE_DAY_OF_MONTH: 20,
};

/**
 * Merge an org's overrides (orgs.complianceOverrides, nullable jsonb) over
 * the platform defaults. Used everywhere a statutory figure is computed —
 * never read DEFAULT_COMPLIANCE_CONSTANTS directly in business logic.
 */
export function resolveComplianceConstants(
  orgOverrides: Partial<ComplianceConstants> | null | undefined
): ComplianceConstants {
  return { ...DEFAULT_COMPLIANCE_CONSTANTS, ...(orgOverrides ?? {}) };
}
