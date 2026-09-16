import "server-only";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { orgMembers, tenantProfiles, platformAdmins, impersonationSessions, orgs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { env } from "@/env";
import { verifyImpersonationToken, IMPERSONATION_COOKIE } from "@/lib/security/impersonation";
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
  /** True when this "membership" is actually a platform-admin support
   *  session (US-J3), not a real org_members row. Callers that need to
   *  show the impersonation banner or skip owner-only UI can check this. */
  isImpersonating?: boolean;
};

/** Live impersonation_sessions row for the cookie on this request, if any
 *  (verified signature, not expired, not manually ended). Null otherwise. */
async function getActiveImpersonationSession() {
  const jar = await cookies();
  const token = jar.get(IMPERSONATION_COOKIE)?.value;
  if (!token) return null;

  const sessionId = verifyImpersonationToken(token, env.MPESA_CREDENTIALS_ENC_KEY);
  if (!sessionId) return null;

  const [session] = await db
    .select()
    .from(impersonationSessions)
    .where(and(eq(impersonationSessions.id, sessionId), isNull(impersonationSessions.endedAt)))
    .limit(1);

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) return null;

  return session;
}

/** First org membership for the signed-in user. v1 assumes one org per staff
 *  member. Falls back to an active platform-admin impersonation session
 *  (US-J3) before giving up — impersonation grants owner-level access to
 *  the target org, attributed to the admin's own userId for audit trails. */
export async function requireOrgMembership(): Promise<CurrentUser & OrgMembership> {
  const user = await requireUser();

  const [membership] = await db
    .select({ orgId: orgMembers.orgId, role: orgMembers.role })
    .from(orgMembers)
    .where(eq(orgMembers.userId, user.userId))
    .limit(1);

  if (membership) {
    const [org] = await db.select({ suspended: orgs.suspended }).from(orgs).where(eq(orgs.id, membership.orgId));
    if (org?.suspended) redirect("/suspended");
    return { ...user, orgId: membership.orgId, role: membership.role as OrgRole };
  }

  const impersonation = await getActiveImpersonationSession();
  if (impersonation) {
    return { ...user, orgId: impersonation.targetOrgId, role: "owner", isImpersonating: true };
  }

  redirect("/onboarding");
}

export type PlatformAdmin = { role: string };

/** Staff-only realm (US-J3) — deliberately separate from org_members: a
 *  platform admin does not need to belong to any tenant org. */
export async function requirePlatformAdmin(): Promise<CurrentUser & PlatformAdmin> {
  const user = await requireUser();

  const [admin] = await db
    .select({ role: platformAdmins.role })
    .from(platformAdmins)
    .where(eq(platformAdmins.userId, user.userId))
    .limit(1);

  if (!admin) redirect("/dashboard");

  return { ...user, role: admin.role };
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
