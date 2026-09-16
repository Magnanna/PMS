import { describe, expect, it } from "vitest";
import { calculateMriTax, monthBoundsUtc } from "../mri-tax-calc";
import { DEFAULT_COMPLIANCE_CONSTANTS } from "../constants";

describe("monthBoundsUtc", () => {
  it("converts an EAT calendar month to UTC instant boundaries", () => {
    // September 2026 in EAT (UTC+3) starts at 2026-08-31T21:00:00Z.
    const { start, end } = monthBoundsUtc(2026, 9);
    expect(start.toISOString()).toBe("2026-08-31T21:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-30T21:00:00.000Z");
  });

  it("handles a December -> January year rollover", () => {
    const { end } = monthBoundsUtc(2026, 12);
    expect(end.toISOString()).toBe("2026-12-31T21:00:00.000Z");
  });
});

describe("calculateMriTax", () => {
  const constants = DEFAULT_COMPLIANCE_CONSTANTS;

  it("computes 7.5% of gross rent collected, above threshold", () => {
    // KES 100,000 collected -> well above the ~24,000/month threshold.
    const result = calculateMriTax(100_000_00, constants);
    expect(result.belowThreshold).toBe(false);
    expect(result.taxDueCents).toBe(7_500_00);
  });

  it("charges nothing when gross rent is below the monthly threshold", () => {
    // KES 10,000 collected, threshold ~24,000/month.
    const result = calculateMriTax(10_000_00, constants);
    expect(result.belowThreshold).toBe(true);
    expect(result.taxDueCents).toBe(0);
  });

  it("charges nothing when nothing was collected (negative/edge case)", () => {
    const result = calculateMriTax(0, constants);
    expect(result.belowThreshold).toBe(true);
    expect(result.taxDueCents).toBe(0);
  });

  it("rounds to the nearest cent rather than truncating", () => {
    // 333 cents * 7.5% = 24.975 -> rounds to 25.
    const result = calculateMriTax(30_000_00 + 333, constants);
    const raw = ((30_000_00 + 333) * constants.MRI_RATE_PCT) / 100;
    expect(result.taxDueCents).toBe(Math.round(raw));
  });

  it("respects a per-org override of the rate", () => {
    const result = calculateMriTax(100_000_00, { ...constants, MRI_RATE_PCT: 10 });
    expect(result.taxDueCents).toBe(10_000_00);
  });

  it("respects a per-org override of the threshold", () => {
    const result = calculateMriTax(10_000_00, {
      ...constants,
      MRI_ENTRY_THRESHOLD_KES: 0, // org opts into taxing everything
    });
    expect(result.belowThreshold).toBe(false);
  });
});
