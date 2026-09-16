import "server-only";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";

/**
 * US-J1: append-only record of who changed what. Call this from every
 * server action that mutates something a dispute might later turn on
 * (financial state, permissions, lease lifecycle) — not for read-only
 * actions. Never pass secrets in before/after summaries (see
 * saveMpesaCredentials for the pattern: log that credentials changed, not
 * the credentials).
 */
export async function logAudit(input: {
  orgId: string;
  actorUserId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(auditLogs).values({
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    beforeSummary: input.before ?? null,
    afterSummary: input.after ?? null,
  });
}
