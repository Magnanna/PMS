"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { properties, units, tenantProfiles, leases, invoices, invoiceLines, orgs } from "@/db/schema";
import { requireOrgMembership } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { parseCsvWithHeader } from "@/lib/import/csv";
import { validateImportRows, type ImportRow, type ImportRowError } from "@/lib/import/validate";
import { resolveComplianceConstants, type ComplianceConstants } from "@/lib/compliance/constants";
import { logAudit } from "@/lib/audit/log";

export type ImportPreview = {
  validCount: number;
  errors: ImportRowError[];
  rows: ImportRow[];
};

/** Dry run: parse + validate only, never touches the DB. */
export async function previewImport(csvText: string): Promise<ImportPreview> {
  await requireOrgMembership();
  const rawRows = parseCsvWithHeader(csvText);
  const { validRows, errors } = validateImportRows(rawRows);
  return { validCount: validRows.length, errors, rows: validRows };
}

export type ImportCommitResult = {
  propertiesCreated: number;
  unitsCreated: number;
  tenantsCreated: number;
  leasesCreated: number;
  leasesSkipped: number; // unit already had an active lease — idempotent re-import
  errors: ImportRowError[];
};

/**
 * US-I1: commit the same validated rows previewImport showed. Idempotent
 * by (property name + unit number): re-running an import with the same
 * spreadsheet finds the existing property/unit instead of duplicating,
 * and skips creating a lease if the unit already has an active one.
 * Opening arrears post as a standalone invoice (receivable), never as
 * income directly — a real payment against it still goes through the
 * normal ledger path when it's eventually paid.
 */
export async function commitImport(csvText: string): Promise<ImportCommitResult> {
  const { orgId, role, userId } = await requireOrgMembership();
  assertCan(role, "property:write");

  const rawRows = parseCsvWithHeader(csvText);
  const { validRows, errors } = validateImportRows(rawRows);

  const constants = await resolveOrgConstants(orgId);

  let propertiesCreated = 0;
  let unitsCreated = 0;
  let tenantsCreated = 0;
  let leasesCreated = 0;
  let leasesSkipped = 0;

  const propertyIdByName = new Map<string, string>();
  const tenantIdByPhone = new Map<string, string>();

  for (const row of validRows) {
    let propertyId = propertyIdByName.get(row.propertyName.toLowerCase());
    if (!propertyId) {
      const [existing] = await db
        .select({ id: properties.id })
        .from(properties)
        .where(and(eq(properties.orgId, orgId), eq(properties.name, row.propertyName)));

      if (existing) {
        propertyId = existing.id;
      } else {
        const [created] = await db
          .insert(properties)
          .values({
            orgId,
            name: row.propertyName,
            type: row.propertyType,
            address: row.propertyAddress,
            county: row.county || null,
          })
          .returning({ id: properties.id });
        propertyId = created.id;
        propertiesCreated++;
      }
      propertyIdByName.set(row.propertyName.toLowerCase(), propertyId);
    }

    let [unit] = await db
      .select()
      .from(units)
      .where(and(eq(units.propertyId, propertyId), eq(units.unitNumber, row.unitNumber)));

    if (!unit) {
      const [created] = await db
        .insert(units)
        .values({
          orgId,
          propertyId,
          unitNumber: row.unitNumber,
          bedrooms: row.propertyType === "commercial" ? null : row.bedrooms,
          rentAmountCents: Math.round(row.rentKes * 100),
          status: "vacant",
        })
        .returning();
      unit = created;
      unitsCreated++;
    }

    let tenantId = tenantIdByPhone.get(row.tenantPhone);
    if (!tenantId) {
      const [existing] = await db
        .select({ id: tenantProfiles.id })
        .from(tenantProfiles)
        .where(and(eq(tenantProfiles.orgId, orgId), eq(tenantProfiles.phone, row.tenantPhone)));

      if (existing) {
        tenantId = existing.id;
      } else {
        const [created] = await db
          .insert(tenantProfiles)
          .values({
            orgId,
            name: row.tenantName,
            phone: row.tenantPhone,
            email: row.tenantEmail,
          })
          .returning({ id: tenantProfiles.id });
        tenantId = created.id;
        tenantsCreated++;
      }
      tenantIdByPhone.set(row.tenantPhone, tenantId);
    }

    const existingActiveLease = await db.$count(
      leases,
      and(eq(leases.unitId, unit.id), eq(leases.status, "active"))
    );
    if (existingActiveLease > 0) {
      leasesSkipped++;
      continue;
    }

    const rentAmountCents = Math.round(row.rentKes * 100);
    const controlledTenancy = row.rentKes <= constants.CONTROLLED_TENANCY_CAP_KES;

    const [lease] = await db
      .insert(leases)
      .values({
        orgId,
        unitId: unit.id,
        tenantProfileId: tenantId,
        startDate: row.leaseStartDate,
        rentAmountCents,
        depositAmountCents: Math.round(row.depositKes * 100),
        billingDay: row.billingDay,
        controlledTenancy,
        status: "active",
      })
      .returning({ id: leases.id });

    await db.update(units).set({ status: "occupied" }).where(eq(units.id, unit.id));
    leasesCreated++;

    // Opening arrears -> a standalone receivable invoice, not income.
    if (row.arrearsKes > 0) {
      const [openingInvoice] = await db
        .insert(invoices)
        .values({
          orgId,
          leaseId: lease.id,
          billingPeriod: row.leaseStartDate.slice(0, 7) + "-01",
          dueDate: row.leaseStartDate,
          reference: `OPEN${lease.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`,
          status: "open",
        })
        .returning({ id: invoices.id });

      await db.insert(invoiceLines).values({
        invoiceId: openingInvoice.id,
        kind: "other",
        description: "Opening arrears (imported)",
        amountCents: Math.round(row.arrearsKes * 100),
      });
    }
  }

  await logAudit({
    orgId,
    actorUserId: userId,
    actorRole: role,
    action: "csv_import.committed",
    entityType: "import",
    after: { propertiesCreated, unitsCreated, tenantsCreated, leasesCreated, leasesSkipped },
  });

  return { propertiesCreated, unitsCreated, tenantsCreated, leasesCreated, leasesSkipped, errors };
}

async function resolveOrgConstants(orgId: string): Promise<ComplianceConstants> {
  const [org] = await db
    .select({ complianceOverrides: orgs.complianceOverrides })
    .from(orgs)
    .where(eq(orgs.id, orgId));
  return resolveComplianceConstants(
    (org?.complianceOverrides as Partial<ComplianceConstants> | null) ?? null
  );
}
