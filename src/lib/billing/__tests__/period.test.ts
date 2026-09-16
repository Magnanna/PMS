import { describe, expect, it } from "vitest";
import { nairobiToday, billingPeriodFor, dueDateFor, invoiceReference } from "../period";

describe("nairobiToday", () => {
  it("returns the EAT date even when UTC is still the previous day", () => {
    // 2026-01-05 22:00 UTC = 2026-01-06 01:00 EAT
    const result = nairobiToday(new Date("2026-01-05T22:00:00.000Z"));
    expect(result).toEqual({ year: 2026, month: 1, day: 6 });
  });

  it("returns the same date when EAT doesn't cross midnight", () => {
    // 2026-06-15 06:00 UTC = 2026-06-15 09:00 EAT
    const result = nairobiToday(new Date("2026-06-15T06:00:00.000Z"));
    expect(result).toEqual({ year: 2026, month: 6, day: 15 });
  });

  it("rolls over year at the boundary (Dec 31 UTC late night -> Jan 1 EAT)", () => {
    const result = nairobiToday(new Date("2026-12-31T22:00:00.000Z"));
    expect(result).toEqual({ year: 2027, month: 1, day: 1 });
  });
});

describe("billingPeriodFor / dueDateFor", () => {
  it("pads single-digit months", () => {
    expect(billingPeriodFor(2026, 3)).toBe("2026-03-01");
    expect(dueDateFor(2026, 3, 5)).toBe("2026-03-05");
  });

  it("never produces an invalid day since billing day is capped at 28 (US-B4)", () => {
    // February in a non-leap year still has 28 days — day 28 is always valid.
    expect(dueDateFor(2027, 2, 28)).toBe("2027-02-28");
  });
});

describe("invoiceReference", () => {
  it("is deterministic for the same unit/period", () => {
    const unitId = "3f2b91a6-1234-4abc-8def-000000000000";
    expect(invoiceReference(unitId, 2026, 9)).toBe(invoiceReference(unitId, 2026, 9));
  });

  it("differs for two units that happen to share a unit NUMBER across properties", () => {
    // Regression guard: an earlier version built the reference from the
    // human unit number ("A1"), which collides across properties and would
    // violate the (org_id, reference) unique constraint.
    const unitA = "aaaaaaaa-0000-0000-0000-000000000000";
    const unitB = "bbbbbbbb-0000-0000-0000-000000000000";
    expect(invoiceReference(unitA, 2026, 9)).not.toBe(invoiceReference(unitB, 2026, 9));
  });

  it("stays alphanumeric and short enough for Daraja's AccountReference limit", () => {
    const ref = invoiceReference("3f2b91a6-1234-4abc-8def-000000000000", 2026, 9);
    expect(ref).toMatch(/^[A-Z0-9]+$/);
    expect(ref.length).toBeLessThanOrEqual(12);
  });
});
