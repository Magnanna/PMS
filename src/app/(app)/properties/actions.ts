"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { properties, units, leases } from "@/db/schema";
import { requireOrgMembership } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";

const propertySchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  county: z.string().optional(),
  type: z.enum(["residential", "commercial", "mixed"]).default("residential"),
});

export type FormState = { error: string | null };

export async function createProperty(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orgId, role } = await requireOrgMembership();
  assertCan(role, "property:write");

  const parsed = propertySchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    county: formData.get("county") || undefined,
    type: formData.get("type") || "residential",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await db.insert(properties).values({ orgId, ...parsed.data });

  revalidatePath("/properties");
  redirect("/properties");
}

/** US-B1: archive is blocked while any unit under the property has an active lease. */
export async function archiveProperty(propertyId: string): Promise<{ error: string | null }> {
  const { orgId, role, userId } = await requireOrgMembership();
  assertCan(role, "property:write");

  const propertyUnitIds = (
    await db.select({ id: units.id }).from(units).where(eq(units.propertyId, propertyId))
  ).map((u) => u.id);

  if (propertyUnitIds.length > 0) {
    const activeLeaseUnitIds = new Set(
      (
        await db
          .select({ unitId: leases.unitId })
          .from(leases)
          .where(and(eq(leases.orgId, orgId), eq(leases.status, "active")))
      ).map((l) => l.unitId)
    );

    const hasActiveLease = propertyUnitIds.some((id) => activeLeaseUnitIds.has(id));
    if (hasActiveLease) {
      return {
        error:
          "Cannot archive: this property has a unit with an active lease. Terminate leases first.",
      };
    }
  }

  await db
    .update(properties)
    .set({ archivedAt: new Date() })
    .where(and(eq(properties.id, propertyId), eq(properties.orgId, orgId)));

  await logAudit({
    orgId,
    actorUserId: userId,
    actorRole: role,
    action: "property.archived",
    entityType: "property",
    entityId: propertyId,
  });

  revalidatePath("/properties");
  return { error: null };
}

export async function listProperties() {
  const { orgId } = await requireOrgMembership();
  return db
    .select()
    .from(properties)
    .where(and(eq(properties.orgId, orgId), isNull(properties.archivedAt)));
}
