import "server-only";
import { db } from "@/db";
import { orgs, units, payments, notificationLog } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

/**
 * US-J3 org list usage figures — computed live from the ledger/notification
 * tables rather than stored counters, same "reports read from source, not
 * caches" rule as pnl.ts/rent-roll.ts. Fine at this scale; revisit with
 * materialized counters only if the org list gets slow.
 */
export type OrgUsageRow = {
  id: string;
  name: string;
  plan: string;
  suspended: boolean;
  suspendedReason: string | null;
  createdAt: Date;
  unitCount: number;
  smsUnitsThisMonth: number;
  paymentVolumeCentsThisMonth: number;
};

function startOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function listOrgsWithUsage(): Promise<OrgUsageRow[]> {
  const monthStart = startOfCurrentMonthUtc();

  const orgRows = await db.select().from(orgs).orderBy(orgs.createdAt);

  const rows: OrgUsageRow[] = [];
  for (const org of orgRows) {
    const [unitAgg] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(units)
      .where(eq(units.orgId, org.id));

    const [smsAgg] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationLog)
      .where(
        and(
          eq(notificationLog.orgId, org.id),
          eq(notificationLog.channel, "sms"),
          gte(notificationLog.createdAt, monthStart)
        )
      );

    const [paymentAgg] = await db
      .select({ total: sql<number>`coalesce(sum(amount_cents), 0)::bigint` })
      .from(payments)
      .where(
        and(eq(payments.orgId, org.id), eq(payments.status, "confirmed"), gte(payments.paidAt, monthStart))
      );

    rows.push({
      id: org.id,
      name: org.name,
      plan: org.plan,
      suspended: org.suspended,
      suspendedReason: org.suspendedReason,
      createdAt: org.createdAt,
      unitCount: unitAgg?.count ?? 0,
      smsUnitsThisMonth: smsAgg?.count ?? 0,
      paymentVolumeCentsThisMonth: Number(paymentAgg?.total ?? 0),
    });
  }

  return rows;
}

export async function getOrgWithUsage(orgId: string): Promise<OrgUsageRow | null> {
  const rows = await listOrgsWithUsage();
  return rows.find((r) => r.id === orgId) ?? null;
}
