/**
 * Pure MRI-tax arithmetic — zero external deps (no DB, no env), split out
 * from mri-tax.ts so it's trivially unit-testable (same pattern as
 * billing/period.ts, for the same reason: importing anything that pulls in
 * "@/db" drags in src/env.ts's boot-time validation, which fails outside a
 * running app/test env with real credentials).
 */
import type { ComplianceConstants } from "./constants";

const EAT_OFFSET_HOURS = 3;

/** UTC instant boundaries for a given EAT calendar month — e.g. September
 *  2026 in EAT starts at 2026-08-31T21:00:00Z and ends at 2026-09-30T21:00:00Z.
 *  Filtering journal_entries.posted_at (stored UTC) against these gives an
 *  EAT-correct month even though the column itself carries no timezone
 *  info beyond UTC (NFR-4). */
export function monthBoundsUtc(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - EAT_OFFSET_HOURS * 3600 * 1000);
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0) - EAT_OFFSET_HOURS * 3600 * 1000);
  return { start, end };
}

export type MriTaxCalcResult = { taxDueCents: number; belowThreshold: boolean };

/** Pure rate/threshold arithmetic (Section 12: money logic needs unit
 *  tests with integer-cent cases + a negative case). */
export function calculateMriTax(
  grossRentCollectedCents: number,
  constants: ComplianceConstants
): MriTaxCalcResult {
  const grossRentCollectedKes = grossRentCollectedCents / 100;
  // Historically a monthly-gross-rent threshold; draft RRI Regulations
  // propose it as annual instead — see OQ-2. Applied here as a monthly
  // figure (the current/legacy reading) with the "verify before filing"
  // disclaimer carried in the UI, not silently assumed correct.
  const belowThreshold = grossRentCollectedKes < constants.MRI_ENTRY_THRESHOLD_KES / 12;
  const taxDueCents = belowThreshold
    ? 0
    : Math.round((grossRentCollectedCents * constants.MRI_RATE_PCT) / 100);
  return { taxDueCents, belowThreshold };
}
