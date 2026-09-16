import { NextResponse } from "next/server";
import { requireOrgMembership } from "@/lib/auth/session";
import { computeMriTax } from "@/lib/compliance/mri-tax";
import { db } from "@/db";
import { orgs } from "@/db/schema";
import { eq } from "drizzle-orm";

function lastMonths(n: number): { year: number; month: number }[] {
  const now = new Date();
  const out: { year: number; month: number }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  }
  return out;
}

/** US-D4/D5 (minimal slice): downloadable MRI figures per month. Full
 *  eRITS export (rent roll + LR numbers per property) lands with US-G3. */
export async function GET() {
  const { orgId } = await requireOrgMembership();
  const [org] = await db.select().from(orgs).where(eq(orgs.id, orgId));

  const months = lastMonths(12);
  const rows = await Promise.all(months.map((m) => computeMriTax(orgId, m.year, m.month)));

  const header = "org_name,kra_pin,period,gross_rent_collected_kes,rate_pct,tax_due_kes,below_threshold\n";
  const csvRows = rows
    .map((r) =>
      [
        `"${(org?.name ?? "").replace(/"/g, '""')}"`,
        org?.kraPin ?? "",
        r.periodLabel,
        (r.grossRentCollectedCents / 100).toFixed(2),
        r.ratePct,
        (r.taxDueCents / 100).toFixed(2),
        r.belowThreshold,
      ].join(",")
    )
    .join("\n");

  return new NextResponse(header + csvRows + "\n", {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="mri-tax-${org?.name ?? "org"}.csv"`,
    },
  });
}
