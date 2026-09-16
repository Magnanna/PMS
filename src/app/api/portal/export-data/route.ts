import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { leases, payments, receipts, maintenanceTickets } from "@/db/schema";
import { requireTenantProfiles } from "@/lib/auth/session";

/**
 * US-J2 (self-service export slice): every tenant_profiles row linked to
 * the signed-in user, across every org, plus their leases/payments/
 * receipts/maintenance tickets — a full "what do you have on me" export.
 * Deletion-request workflow is the rest of US-J2, not built yet (the PRD
 * itself notes real deletion must anonymize rather than destroy financial
 * records — tax retention rules win over erasure — so it needs its own
 * careful design, not a rushed cut here).
 */
export async function GET() {
  const { profiles } = await requireTenantProfiles();

  const profileIds = profiles.map((p) => p.id);
  const leaseRows = await db.select().from(leases).where(inArray(leases.tenantProfileId, profileIds));
  const leaseIds = leaseRows.map((l) => l.id);

  const paymentRows = leaseIds.length
    ? await db.select().from(payments).where(inArray(payments.leaseId, leaseIds))
    : [];
  const paymentIds = paymentRows.map((p) => p.id);

  const receiptRows = paymentIds.length
    ? await db.select().from(receipts).where(inArray(receipts.paymentId, paymentIds))
    : [];

  const ticketRows = leaseIds.length
    ? await db.select().from(maintenanceTickets).where(inArray(maintenanceTickets.leaseId, leaseIds))
    : [];

  const exportData = {
    exportedAt: new Date().toISOString(),
    tenantProfiles: profiles,
    leases: leaseRows,
    payments: paymentRows,
    receipts: receiptRows,
    maintenanceTickets: ticketRows,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="my-data-export.json"',
    },
  });
}
