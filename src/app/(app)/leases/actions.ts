"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { leases, units, orgs } from "@/db/schema";
import { requireOrgMembership } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { resolveComplianceConstants } from "@/lib/compliance/constants";
import { logAudit } from "@/lib/audit/log";

const leaseSchema = z.object({
  unitId: z.string().uuid(),
  tenantProfileId: z.string().uuid(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  rentAmountKes: z.coerce.number().positive(),
  depositAmountKes: z.coerce.number().nonnegative().default(0),
  billingDay: z.coerce.number().int().min(1).max(28),
  guarantorName: z.string().optional(),
  guarantorPhone: z.string().optional(),
});

export type FormState = { error: string | null };

/** US-B4: create a lease. Guards: unit has no active lease; billing day 1–28. */
export async function createLease(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orgId, role, userId } = await requireOrgMembership();
  assertCan(role, "lease:write");

  const parsed = leaseSchema.safeParse({
    unitId: formData.get("unitId"),
    tenantProfileId: formData.get("tenantProfileId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
    rentAmountKes: formData.get("rentAmountKes"),
    depositAmountKes: formData.get("depositAmountKes") || 0,
    billingDay: formData.get("billingDay"),
    guarantorName: formData.get("guarantorName") || undefined,
    guarantorPhone: formData.get("guarantorPhone") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { unitId } = parsed.data;

  const [unit] = await db.select().from(units).where(and(eq(units.id, unitId), eq(units.orgId, orgId)));
  if (!unit) return { error: "Unit not found" };

  const existingActive = await db.$count(
    leases,
    and(eq(leases.unitId, unitId), eq(leases.status, "active"))
  );
  if (existingActive > 0) {
    return { error: "This unit already has an active lease." };
  }

  const [org] = await db.select().from(orgs).where(eq(orgs.id, orgId));
  const constants = resolveComplianceConstants(
    org?.complianceOverrides as Partial<import("@/lib/compliance/constants").ComplianceConstants> | null
  );
  const rentAmountCents = Math.round(parsed.data.rentAmountKes * 100);
  const controlledTenancy = parsed.data.rentAmountKes <= constants.CONTROLLED_TENANCY_CAP_KES;

  const [newLease] = await db
    .insert(leases)
    .values({
      orgId,
      unitId,
      tenantProfileId: parsed.data.tenantProfileId,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate || null,
      rentAmountCents,
      depositAmountCents: Math.round(parsed.data.depositAmountKes * 100),
      billingDay: parsed.data.billingDay,
      controlledTenancy,
      guarantorName: parsed.data.guarantorName || null,
      guarantorPhone: parsed.data.guarantorPhone || null,
      status: "active",
    })
    .returning({ id: leases.id });

  await db.update(units).set({ status: "occupied" }).where(eq(units.id, unitId));

  await logAudit({
    orgId,
    actorUserId: userId,
    actorRole: role,
    action: "lease.created",
    entityType: "lease",
    entityId: newLease.id,
    after: { unitId, rentAmountCents, controlledTenancy },
  });

  revalidatePath("/leases");
  revalidatePath("/properties");
  redirect("/leases");
}

/** US-B5 (minimal v1): terminate a lease, frees the unit. */
export async function terminateLease(
  leaseId: string,
  reason: string
): Promise<{ error: string | null }> {
  const { orgId, role, userId } = await requireOrgMembership();
  assertCan(role, "lease:write");

  const [lease] = await db
    .select()
    .from(leases)
    .where(and(eq(leases.id, leaseId), eq(leases.orgId, orgId)));

  if (!lease) return { error: "Lease not found" };

  await db
    .update(leases)
    .set({
      status: "terminated",
      terminatedAt: new Date(),
      terminationReason: reason || null,
    })
    .where(eq(leases.id, leaseId));

  await db.update(units).set({ status: "vacant" }).where(eq(units.id, lease.unitId));

  await logAudit({
    orgId,
    actorUserId: userId,
    actorRole: role,
    action: "lease.terminated",
    entityType: "lease",
    entityId: leaseId,
    before: { status: lease.status },
    after: { status: "terminated", reason },
  });

  revalidatePath("/leases");
  revalidatePath("/properties");
  return { error: null };
}

export async function listLeases() {
  const { orgId } = await requireOrgMembership();
  return db.select().from(leases).where(eq(leases.orgId, orgId));
}

export async function listVacantUnitsForOrg() {
  const { orgId } = await requireOrgMembership();
  return db.select().from(units).where(and(eq(units.orgId, orgId), eq(units.status, "vacant")));
}
