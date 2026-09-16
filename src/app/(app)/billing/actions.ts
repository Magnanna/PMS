"use server";

import { revalidatePath } from "next/cache";
import { requireOrgMembership } from "@/lib/auth/session";
import { generateMonthlyInvoices } from "@/lib/billing/generate-invoices";

/** Manual trigger for US-C1, ahead of/alongside the cron — lets a landlord
 *  (or this session, testing) generate this period's invoices on demand. */
export async function generateInvoicesNow(): Promise<{ created: number; skipped: number }> {
  const { orgId } = await requireOrgMembership();
  const result = await generateMonthlyInvoices(new Date(), orgId);
  revalidatePath("/dashboard");
  revalidatePath("/leases");
  return result;
}
