"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orgs, impersonationSessions } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { env } from "@/env";
import {
  createImpersonationToken,
  verifyImpersonationToken,
  IMPERSONATION_COOKIE,
  IMPERSONATION_TTL_MS,
} from "@/lib/security/impersonation";

export async function suspendOrg(orgId: string, reason: string): Promise<{ error: string | null }> {
  const admin = await requirePlatformAdmin();

  if (!reason.trim()) return { error: "Reason is required" };

  await db.update(orgs).set({ suspended: true, suspendedReason: reason.trim() }).where(eq(orgs.id, orgId));

  await logAudit({
    orgId,
    actorUserId: admin.userId,
    actorRole: "platform_admin",
    action: "suspend_org",
    entityType: "org",
    entityId: orgId,
    after: { reason: reason.trim() },
  });

  revalidatePath(`/platform/orgs/${orgId}`);
  revalidatePath("/platform/orgs");
  return { error: null };
}

export async function unsuspendOrg(orgId: string): Promise<{ error: string | null }> {
  const admin = await requirePlatformAdmin();

  await db.update(orgs).set({ suspended: false, suspendedReason: null }).where(eq(orgs.id, orgId));

  await logAudit({
    orgId,
    actorUserId: admin.userId,
    actorRole: "platform_admin",
    action: "unsuspend_org",
    entityType: "org",
    entityId: orgId,
  });

  revalidatePath(`/platform/orgs/${orgId}`);
  revalidatePath("/platform/orgs");
  return { error: null };
}

/** US-J3: "no silent impersonation" — reason + explicit consent checkbox
 *  required, session is DB-tracked (revocable, auditable) and time-boxed
 *  via the same signed-token expiry the cookie carries. */
export async function startImpersonation(orgId: string, reason: string, consent: boolean): Promise<{ error: string | null }> {
  const admin = await requirePlatformAdmin();

  if (!reason.trim()) return { error: "Reason is required" };
  if (!consent) return { error: "You must confirm this is a consented support session" };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + IMPERSONATION_TTL_MS);

  const [session] = await db
    .insert(impersonationSessions)
    .values({
      platformAdminUserId: admin.userId,
      targetOrgId: orgId,
      reason: reason.trim(),
      consentAt: now,
      expiresAt,
    })
    .returning({ id: impersonationSessions.id });

  await logAudit({
    orgId,
    actorUserId: admin.userId,
    actorRole: "platform_admin",
    action: "start_impersonation",
    entityType: "org",
    entityId: orgId,
    after: { reason: reason.trim(), sessionId: session.id, expiresAt: expiresAt.toISOString() },
  });

  const token = createImpersonationToken(session.id, env.MPESA_CREDENTIALS_ENC_KEY);
  const jar = await cookies();
  jar.set(IMPERSONATION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  redirect("/dashboard");
}

/** Ends an active impersonation session — called from the banner shown in
 *  (app)/layout.tsx while impersonating. Not gated by requirePlatformAdmin
 *  since the caller is, for the duration of the session, presenting as an
 *  org member; the cookie itself is the only proof needed to end it. */
export async function endImpersonation(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(IMPERSONATION_COOKIE)?.value;
  jar.delete(IMPERSONATION_COOKIE);

  if (!token) {
    redirect("/platform");
  }

  const sessionId = verifyImpersonationToken(token, env.MPESA_CREDENTIALS_ENC_KEY);
  if (sessionId) {
    const [session] = await db
      .select()
      .from(impersonationSessions)
      .where(eq(impersonationSessions.id, sessionId))
      .limit(1);

    if (session && !session.endedAt) {
      await db.update(impersonationSessions).set({ endedAt: new Date() }).where(eq(impersonationSessions.id, sessionId));

      await logAudit({
        orgId: session.targetOrgId,
        actorUserId: session.platformAdminUserId,
        actorRole: "platform_admin",
        action: "end_impersonation",
        entityType: "org",
        entityId: session.targetOrgId,
        after: { sessionId },
      });
    }
  }

  redirect("/platform");
}
