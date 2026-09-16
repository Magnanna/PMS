import { describe, expect, it } from "vitest";
import { validateImportRows } from "../validate";

const GOOD_ROW = {
  property_name: "Riverside Apartments",
  property_type: "residential",
  unit_number: "A1",
  rent_kes: "35000",
  tenant_name: "Wanjiru Kamau",
  tenant_phone: "0712345678",
  lease_start_date: "2026-01-01",
  billing_day: "1",
};

describe("validateImportRows", () => {
  it("accepts a fully valid row", () => {
    const { validRows, errors } = validateImportRows([GOOD_ROW]);
    expect(errors).toEqual([]);
    expect(validRows).toHaveLength(1);
    expect(validRows[0].tenantPhone).toBe("254712345678");
  });

  it("rejects a row missing property_name (negative case)", () => {
    const { validRows, errors } = validateImportRows([{ ...GOOD_ROW, property_name: "" }]);
    expect(validRows).toEqual([]);
    expect(errors[0].message).toContain("property_name");
  });

  it("rejects a non-positive rent_kes (negative case)", () => {
    const { errors } = validateImportRows([{ ...GOOD_ROW, rent_kes: "0" }]);
    expect(errors[0].message).toContain("rent_kes");
  });

  it("rejects an invalid tenant_phone (negative case)", () => {
    const { errors } = validateImportRows([{ ...GOOD_ROW, tenant_phone: "12345" }]);
    expect(errors).toHaveLength(1);
  });

  it("rejects a malformed lease_start_date (negative case)", () => {
    const { errors } = validateImportRows([{ ...GOOD_ROW, lease_start_date: "01/01/2026" }]);
    expect(errors[0].message).toContain("lease_start_date");
  });

  it("rejects a billing_day outside 1-28 (negative case, US-B4 invariant)", () => {
    const { errors } = validateImportRows([{ ...GOOD_ROW, billing_day: "30" }]);
    expect(errors[0].message).toContain("billing_day");
  });

  it("defaults billing_day to 1 when omitted", () => {
    const row = { ...GOOD_ROW };
    delete (row as Record<string, string>).billing_day;
    const { validRows, errors } = validateImportRows([row]);
    expect(errors).toEqual([]);
    expect(validRows[0].billingDay).toBe(1);
  });

  it("defaults property_type to residential when omitted", () => {
    const row = { ...GOOD_ROW };
    delete (row as Record<string, string>).property_type;
    const { validRows } = validateImportRows([row]);
    expect(validRows[0].propertyType).toBe("residential");
  });

  it("reports the 1-indexed spreadsheet row number (header + 1-index)", () => {
    const { errors } = validateImportRows([GOOD_ROW, { ...GOOD_ROW, rent_kes: "-5" }]);
    expect(errors[0].rowIndex).toBe(3); // row 1 is the header, row 2 is GOOD_ROW, row 3 is the bad one
  });

  it("continues validating remaining rows after one fails (not short-circuiting)", () => {
    const { validRows, errors } = validateImportRows([
      { ...GOOD_ROW, unit_number: "" },
      GOOD_ROW,
    ]);
    expect(errors).toHaveLength(1);
    expect(validRows).toHaveLength(1);
  });

  it("defaults deposit_kes and arrears_kes to 0 when omitted", () => {
    const { validRows } = validateImportRows([GOOD_ROW]);
    expect(validRows[0].depositKes).toBe(0);
    expect(validRows[0].arrearsKes).toBe(0);
  });
});
