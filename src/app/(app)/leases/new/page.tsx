import { db } from "@/db";
import { units, properties, tenantProfiles } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireOrgMembership } from "@/lib/auth/session";
import { NewLeaseForm } from "./form";

export default async function NewLeasePage() {
  const { orgId } = await requireOrgMembership();

  const vacantUnits = await db
    .select({
      id: units.id,
      unitNumber: units.unitNumber,
      rentAmountCents: units.rentAmountCents,
      propertyName: properties.name,
    })
    .from(units)
    .innerJoin(properties, eq(units.propertyId, properties.id))
    .where(and(eq(units.orgId, orgId), eq(units.status, "vacant")));

  const tenants = await db
    .select({ id: tenantProfiles.id, name: tenantProfiles.name })
    .from(tenantProfiles)
    .where(eq(tenantProfiles.orgId, orgId));

  return (
    <div className="flex justify-center">
      <NewLeaseForm vacantUnits={vacantUnits} tenants={tenants} />
    </div>
  );
}
