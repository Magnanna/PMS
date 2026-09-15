"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenantProfiles } from "@/db/schema";
import { requireOrgMembership } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { normalizeKenyanPhone } from "@/lib/payments/phone";

const tenantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email().optional().or(z.literal("")),
  idNumber: z.string().optional(),
  kraPin: z.string().optional(),
  employer: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
});

export type FormState = { error: string | null };

export async function createTenant(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orgId, role } = await requireOrgMembership();
  assertCan(role, "tenant:invite");

  const parsed = tenantSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email") || undefined,
    idNumber: formData.get("idNumber") || undefined,
    kraPin: formData.get("kraPin") || undefined,
    employer: formData.get("employer") || undefined,
    emergencyContactName: formData.get("emergencyContactName") || undefined,
    emergencyContactPhone: formData.get("emergencyContactPhone") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  let normalizedPhone: string;
  try {
    normalizedPhone = normalizeKenyanPhone(parsed.data.phone);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid phone number" };
  }

  await db.insert(tenantProfiles).values({
    orgId,
    name: parsed.data.name,
    phone: normalizedPhone,
    email: parsed.data.email || null,
    idNumber: parsed.data.idNumber || null,
    kraPin: parsed.data.kraPin || null,
    employer: parsed.data.employer || null,
    emergencyContactName: parsed.data.emergencyContactName || null,
    emergencyContactPhone: parsed.data.emergencyContactPhone || null,
  });

  revalidatePath("/tenants");
  redirect("/tenants");
}

export async function listTenants() {
  const { orgId } = await requireOrgMembership();
  return db.select().from(tenantProfiles).where(eq(tenantProfiles.orgId, orgId));
}
