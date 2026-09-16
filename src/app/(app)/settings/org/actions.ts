"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orgs } from "@/db/schema";
import { requireOrgMembership } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";

const schema = z.object({
  kraPin: z.string().optional(),
  registeredAddress: z.string().optional(),
  contactPerson: z.string().optional(),
});

export type FormState = { error: string | null; success?: boolean };

export async function updateOrgDetails(_prev: FormState, formData: FormData): Promise<FormState> {
  const { orgId, role } = await requireOrgMembership();
  assertCan(role, "org:edit_settings");

  const parsed = schema.safeParse({
    kraPin: formData.get("kraPin") || undefined,
    registeredAddress: formData.get("registeredAddress") || undefined,
    contactPerson: formData.get("contactPerson") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await db
    .update(orgs)
    .set({
      kraPin: parsed.data.kraPin || null,
      registeredAddress: parsed.data.registeredAddress || null,
      contactPerson: parsed.data.contactPerson || null,
    })
    .where(eq(orgs.id, orgId));

  revalidatePath("/settings/org");
  return { error: null, success: true };
}

export async function getOrgDetails() {
  const { orgId } = await requireOrgMembership();
  const [org] = await db.select().from(orgs).where(eq(orgs.id, orgId));
  return org;
}
