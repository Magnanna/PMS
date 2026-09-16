import { NextResponse } from "next/server";
import { env } from "@/env";
import { generateMonthlyInvoices } from "@/lib/billing/generate-invoices";

/**
 * US-C1 cron entry point (Vercel Cron -> this route, per Section 10's
 * scheduler decision). Runs once daily; generateMonthlyInvoices is
 * idempotent (unique lease_id+billing_period index) so a retry or a
 * double-fire never duplicates an invoice.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await generateMonthlyInvoices(new Date());
  return NextResponse.json(result);
}
