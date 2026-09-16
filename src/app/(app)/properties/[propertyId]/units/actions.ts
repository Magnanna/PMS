"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { units, leases, properties } from "@/db/schema";
import { requireOrgMembership } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";

const unitSchema = z.object({
  unitNumber: z.string().min(1, "Unit number is required"),
  bedrooms: z.coerce.number().int().nonnegative().optional(),
  floorAreaSqft: z.coerce.number().int().positive().optional(),
  commercialUnitType: z.enum(["office", "shop", "warehouse", "other"]).optional(),
  rentAmountKes: z.coerce.number().positive("Rent must be greater than 0"),
});

export type FormState = { error: string | null };

/** US-B2: which questions this unit form asks depends on the parent
 *  property's type — a commercial unit is never asked bedrooms, a
 *  residential unit is never asked floor area/commercial type. "mixed"
 *  properties get both sets since either kind of unit could live there. */
export async function createUnit(
  propertyId: string,
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const { orgId, role } = await requireOrgMembership();
  assertCan(role, "property:write");

  const [property] = await db
    .select({ type: properties.type })
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.orgId, orgId)));
  if (!property) return { error: "Property not found" };

  const parsed = unitSchema.safeParse({
    unitNumber: formData.get("unitNumber"),
    bedrooms: formData.get("bedrooms") || undefined,
    floorAreaSqft: formData.get("floorAreaSqft") || undefined,
    commercialUnitType: formData.get("commercialUnitType") || undefined,
    rentAmountKes: formData.get("rentAmountKes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Server-side enforcement, not just a hidden form field — a residential
  // unit never stores commercial fields and vice versa, regardless of
  // what the client sends.
  const isResidential = property.type === "residential";
  const isCommercial = property.type === "commercial";

  try {
    await db.insert(units).values({
      orgId,
      propertyId,
      unitNumber: parsed.data.unitNumber,
      bedrooms: isCommercial ? null : parsed.data.bedrooms ?? null,
      floorAreaSqft: isResidential ? null : parsed.data.floorAreaSqft ?? null,
      commercialUnitType: isResidential ? null : parsed.data.commercialUnitType ?? null,
      rentAmountCents: Math.round(parsed.data.rentAmountKes * 100),
    });
  } catch {
    return { error: "A unit with that number already exists on this property." };
  }

  revalidatePath(`/properties/${propertyId}/units`);
  redirect(`/properties/${propertyId}/units`);
}

export async function archiveUnit(
  propertyId: string,
  unitId: string
): Promise<{ error: string | null }> {
  const { orgId, role } = await requireOrgMembership();
  assertCan(role, "property:write");

  const activeLeaseCount = await db.$count(
    leases,
    and(eq(leases.orgId, orgId), eq(leases.unitId, unitId), eq(leases.status, "active"))
  );

  if (activeLeaseCount > 0) {
    return { error: "Cannot archive: this unit has an active lease. Terminate it first." };
  }

  await db
    .update(units)
    .set({ archivedAt: new Date(), status: "vacant" })
    .where(and(eq(units.id, unitId), eq(units.orgId, orgId)));

  revalidatePath(`/properties/${propertyId}/units`);
  return { error: null };
}

export async function listUnits(propertyId: string) {
  const { orgId } = await requireOrgMembership();
  return db
    .select()
    .from(units)
    .where(and(eq(units.propertyId, propertyId), eq(units.orgId, orgId)));
}
