"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { maintenanceTickets, vendors, units, auditLogs } from "@/db/schema";
import { requireOrgMembership } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { postJournalEntry } from "@/lib/ledger/posting";
import { ACCOUNTS } from "@/lib/ledger/accounts";

type TicketStatus = "open" | "assigned" | "in_progress" | "resolved" | "closed";

/** US-E2: move a ticket through the pipeline. Logged to audit_logs (US-J1
 *  slice) since status/assignment changes are exactly the kind of thing a
 *  dispute needs a record of. */
export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus
): Promise<{ error: string | null }> {
  const { orgId, role, userId } = await requireOrgMembership();
  assertCan(role, "maintenance:manage");

  const [ticket] = await db
    .select()
    .from(maintenanceTickets)
    .where(and(eq(maintenanceTickets.id, ticketId), eq(maintenanceTickets.orgId, orgId)));
  if (!ticket) return { error: "Ticket not found" };

  await db
    .update(maintenanceTickets)
    .set({
      status,
      resolvedAt: status === "resolved" || status === "closed" ? new Date() : ticket.resolvedAt,
    })
    .where(eq(maintenanceTickets.id, ticketId));

  await db.insert(auditLogs).values({
    orgId,
    actorUserId: userId,
    actorRole: role,
    action: "maintenance_ticket.status_changed",
    entityType: "maintenance_ticket",
    entityId: ticketId,
    beforeSummary: { status: ticket.status },
    afterSummary: { status },
  });

  revalidatePath("/maintenance");
  return { error: null };
}

const assignSchema = z.object({
  vendorName: z.string().min(1, "Vendor name is required"),
  vendorPhone: z.string().optional(),
});

export async function assignVendor(
  ticketId: string,
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const { orgId, role } = await requireOrgMembership();
  assertCan(role, "maintenance:manage");

  const parsed = assignSchema.safeParse({
    vendorName: formData.get("vendorName"),
    vendorPhone: formData.get("vendorPhone") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const [vendor] = await db
    .insert(vendors)
    .values({ orgId, name: parsed.data.vendorName, phone: parsed.data.vendorPhone || null })
    .returning({ id: vendors.id });

  await db
    .update(maintenanceTickets)
    .set({ vendorId: vendor.id, status: "assigned" })
    .where(and(eq(maintenanceTickets.id, ticketId), eq(maintenanceTickets.orgId, orgId)));

  revalidatePath("/maintenance");
  return { error: null };
}

const closeSchema = z.object({
  costKes: z.coerce.number().nonnegative().optional(),
  billableToTenant: z.coerce.boolean().optional(),
});

/** US-E3: closing a ticket with a cost posts an expense entry against the
 *  right property/unit (Dr maintenance_expense / Cr cash_on_hand — the
 *  landlord paid the vendor outside the app; this just records it). */
export async function closeTicketWithCost(
  ticketId: string,
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const { orgId, role } = await requireOrgMembership();
  assertCan(role, "maintenance:manage");

  const parsed = closeSchema.safeParse({
    costKes: formData.get("costKes") || undefined,
    billableToTenant: formData.get("billableToTenant") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const [ticket] = await db
    .select()
    .from(maintenanceTickets)
    .where(and(eq(maintenanceTickets.id, ticketId), eq(maintenanceTickets.orgId, orgId)));
  if (!ticket) return { error: "Ticket not found" };

  const costCents = parsed.data.costKes ? Math.round(parsed.data.costKes * 100) : null;

  await db
    .update(maintenanceTickets)
    .set({
      status: "closed",
      costCents,
      billableToTenant: parsed.data.billableToTenant ?? false,
      resolvedAt: ticket.resolvedAt ?? new Date(),
    })
    .where(eq(maintenanceTickets.id, ticketId));

  if (costCents && costCents > 0) {
    const [unit] = await db.select().from(units).where(eq(units.id, ticket.unitId));
    await postJournalEntry({
      orgId,
      sourceType: "maintenance_ticket",
      sourceId: ticketId,
      memo: `Maintenance — ${ticket.category}`,
      lines: [
        {
          account: ACCOUNTS.MAINTENANCE_EXPENSE,
          debitCents: costCents,
          unitId: unit?.id,
          propertyId: unit?.propertyId,
        },
        {
          account: ACCOUNTS.CASH_ON_HAND,
          creditCents: costCents,
          unitId: unit?.id,
          propertyId: unit?.propertyId,
        },
      ],
    });
  }

  revalidatePath("/maintenance");
  return { error: null };
}
