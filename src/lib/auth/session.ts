import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { orgMembers, tenantProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { OrgRole } from "./permissions";

export type CurrentUser = {
  userId: string;
  email: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { userId: user.id, email: user.email ?? null };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export type OrgMembership = {
  orgId: string;
  role: OrgRole;
};

/** First org membership for the signed-in user. v1 assumes one org per staff member. */
export async function requireOrgMembership(): Promise<CurrentUser & OrgMembership> {
  const user = await requireUser();

  const [membership] = await db
    .select({ orgId: orgMembers.orgId, role: orgMembers.role })
    .from(orgMembers)
    .where(eq(orgMembers.userId, user.userId))
    .limit(1);

  if (!membership) redirect("/onboarding");

  return { ...user, orgId: membership.orgId, role: membership.role as OrgRole };
}

/** All tenant_profiles rows linked to the signed-in user, across every org (US-A5). */
export async function requireTenantProfiles() {
  const user = await requireUser();

  const profiles = await db
    .select()
    .from(tenantProfiles)
    .where(eq(tenantProfiles.userId, user.userId));

  if (profiles.length === 0) redirect("/login");

  return { user, profiles };
}
