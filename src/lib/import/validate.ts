import { normalizeKenyanPhone } from "@/lib/payments/phone";

export type ImportRow = {
  propertyName: string;
  propertyType: "residential" | "commercial" | "mixed";
  propertyAddress: string;
  county: string;
  unitNumber: string;
  bedrooms: number | null;
  rentKes: number;
  tenantName: string;
  tenantPhone: string; // normalized
  tenantEmail: string | null;
  leaseStartDate: string;
  depositKes: number;
  billingDay: number;
  arrearsKes: number;
};

export type ImportRowError = { rowIndex: number; message: string };

export type ImportValidationResult = {
  validRows: ImportRow[];
  errors: ImportRowError[];
};

/**
 * US-I1: pure validation, no DB — a dry run and a commit share this so the
 * report the landlord sees before committing is exactly what would be
 * imported, not a lossy preview.
 */
export function validateImportRows(rawRows: Record<string, string>[]): ImportValidationResult {
  const validRows: ImportRow[] = [];
  const errors: ImportRowError[] = [];

  rawRows.forEach((raw, i) => {
    const rowIndex = i + 2; // +1 for header, +1 for 1-indexing in the user's spreadsheet

    const propertyName = raw.property_name?.trim();
    if (!propertyName) {
      errors.push({ rowIndex, message: "property_name is required" });
      return;
    }

    const propertyType = (raw.property_type?.trim().toLowerCase() || "residential") as
      | "residential"
      | "commercial"
      | "mixed";
    if (!["residential", "commercial", "mixed"].includes(propertyType)) {
      errors.push({ rowIndex, message: `property_type must be residential/commercial/mixed, got "${raw.property_type}"` });
      return;
    }

    const unitNumber = raw.unit_number?.trim();
    if (!unitNumber) {
      errors.push({ rowIndex, message: "unit_number is required" });
      return;
    }

    const rentKes = Number(raw.rent_kes);
    if (!Number.isFinite(rentKes) || rentKes <= 0) {
      errors.push({ rowIndex, message: `rent_kes must be a positive number, got "${raw.rent_kes}"` });
      return;
    }

    const tenantName = raw.tenant_name?.trim();
    if (!tenantName) {
      errors.push({ rowIndex, message: "tenant_name is required" });
      return;
    }

    let tenantPhone: string;
    try {
      tenantPhone = normalizeKenyanPhone(raw.tenant_phone ?? "");
    } catch (e) {
      errors.push({ rowIndex, message: e instanceof Error ? e.message : "Invalid tenant_phone" });
      return;
    }

    const leaseStartDate = raw.lease_start_date?.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(leaseStartDate ?? "")) {
      errors.push({ rowIndex, message: `lease_start_date must be YYYY-MM-DD, got "${raw.lease_start_date}"` });
      return;
    }

    const billingDay = Number(raw.billing_day || 1);
    if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 28) {
      errors.push({ rowIndex, message: `billing_day must be an integer 1-28, got "${raw.billing_day}"` });
      return;
    }

    const bedroomsRaw = raw.bedrooms?.trim();
    const bedrooms = bedroomsRaw ? Number(bedroomsRaw) : null;
    if (bedroomsRaw && (!Number.isFinite(bedrooms) || (bedrooms as number) < 0)) {
      errors.push({ rowIndex, message: `bedrooms must be a non-negative number, got "${raw.bedrooms}"` });
      return;
    }

    const depositKes = raw.deposit_kes ? Number(raw.deposit_kes) : 0;
    if (!Number.isFinite(depositKes) || depositKes < 0) {
      errors.push({ rowIndex, message: `deposit_kes must be a non-negative number, got "${raw.deposit_kes}"` });
      return;
    }

    const arrearsKes = raw.arrears_kes ? Number(raw.arrears_kes) : 0;
    if (!Number.isFinite(arrearsKes) || arrearsKes < 0) {
      errors.push({ rowIndex, message: `arrears_kes must be a non-negative number, got "${raw.arrears_kes}"` });
      return;
    }

    validRows.push({
      propertyName,
      propertyType,
      propertyAddress: raw.property_address?.trim() || "",
      county: raw.county?.trim() || "",
      unitNumber,
      bedrooms,
      rentKes,
      tenantName,
      tenantPhone,
      tenantEmail: raw.tenant_email?.trim() || null,
      leaseStartDate,
      depositKes,
      billingDay,
      arrearsKes,
    });
  });

  return { validRows, errors };
}
