"use server";

import { redirect } from "next/navigation";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { properties, units, tenantProfiles, leases } from "@/db/schema";
import { requireOrgMembership } from "@/lib/auth/session";
import { resolveComplianceConstants } from "@/lib/compliance/constants";

/**
 * US-I2: one-click demo data so a new landlord can see the flow before
 * committing real data. M1 scope only (no payments/maintenance yet — those
 * land when Epics C/E ship and this seed grows with them).
 */
export async function seedDemoData() {
  const { orgId } = await requireOrgMembership();
  const constants = resolveComplianceConstants(null);

  const [propertyA] = await db
    .insert(properties)
    .values({
      orgId,
      name: "Riverside Apartments (DEMO)",
      address: "Riverside Drive, Nairobi",
      county: "Nairobi",
      type: "residential",
    })
    .returning();

  const [propertyB] = await db
    .insert(properties)
    .values({
      orgId,
      name: "Kibera Rentals (DEMO)",
      address: "Kibera Road, Nairobi",
      county: "Nairobi",
      type: "residential",
    })
    .returning();

  const [unitA1] = await db
    .insert(units)
    .values([
      { orgId, propertyId: propertyA.id, unitNumber: "A1", bedrooms: 2, rentAmountCents: 3_500_000, status: "vacant" },
      { orgId, propertyId: propertyA.id, unitNumber: "A2", bedrooms: 1, rentAmountCents: 2_200_000, status: "vacant" },
    ])
    .returning();

  const [unitB1] = await db
    .insert(units)
    .values([
      // Below the controlled-tenancy cap on purpose, to demo the flag.
      { orgId, propertyId: propertyB.id, unitNumber: "1", bedrooms: 1, rentAmountCents: 250_000, status: "vacant" },
    ])
    .returning();

  const [tenant1, tenant2, tenant3] = await db
    .insert(tenantProfiles)
    .values([
      { orgId, name: "Wanjiru Kamau (DEMO)", phone: "254712000001" },
      { orgId, name: "Otieno Odhiambo (DEMO)", phone: "254712000002" },
      { orgId, name: "Amina Hassan (DEMO)", phone: "254712000003" },
    ])
    .returning();

  const today = new Date().toISOString().slice(0, 10);

  await db.insert(leases).values([
    {
      orgId,
      unitId: unitA1.id,
      tenantProfileId: tenant1.id,
      startDate: today,
      rentAmountCents: unitA1.rentAmountCents,
      depositAmountCents: unitA1.rentAmountCents,
      billingDay: 1,
      controlledTenancy: unitA1.rentAmountCents / 100 <= constants.CONTROLLED_TENANCY_CAP_KES,
      status: "active",
    },
    {
      orgId,
      unitId: unitB1.id,
      tenantProfileId: tenant2.id,
      startDate: today,
      rentAmountCents: unitB1.rentAmountCents,
      depositAmountCents: unitB1.rentAmountCents,
      billingDay: 5,
      controlledTenancy: unitB1.rentAmountCents / 100 <= constants.CONTROLLED_TENANCY_CAP_KES,
      status: "active",
    },
  ]);

  await db
    .update(units)
    .set({ status: "occupied" })
    .where(inArray(units.id, [unitA1.id, unitB1.id]));

  // tenant3 / unitA2 stay unlinked — demonstrates a vacant unit + unassigned tenant.
  void tenant3;

  redirect("/dashboard");
}
