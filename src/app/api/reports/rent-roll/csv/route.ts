import { NextResponse } from "next/server";
import { requireOrgMembership } from "@/lib/auth/session";
import { computeRentRoll } from "@/lib/reports/rent-roll";

export async function GET() {
  const { orgId } = await requireOrgMembership();
  const rows = await computeRentRoll(orgId);

  const header = "property,unit,tenant,rent_kes,arrears_kes,lease_end,controlled_tenancy\n";
  const csvRows = rows
    .map((r) =>
      [
        `"${r.propertyName.replace(/"/g, '""')}"`,
        r.unitNumber,
        `"${r.tenantName.replace(/"/g, '""')}"`,
        (r.rentAmountCents / 100).toFixed(2),
        (r.arrearsCents / 100).toFixed(2),
        r.leaseEndDate ?? "",
        r.controlledTenancy,
      ].join(",")
    )
    .join("\n");

  return new NextResponse(header + csvRows + "\n", {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="rent-roll.csv"`,
    },
  });
}
