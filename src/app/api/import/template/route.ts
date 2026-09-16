import { NextResponse } from "next/server";
import { requireOrgMembership } from "@/lib/auth/session";

const HEADER =
  "property_name,property_type,property_address,county,unit_number,bedrooms,rent_kes,tenant_name,tenant_phone,tenant_email,lease_start_date,deposit_kes,billing_day,arrears_kes\n";
const EXAMPLE =
  'Riverside Apartments,residential,Riverside Drive Nairobi,Nairobi,A1,2,35000,Wanjiru Kamau,0712345678,,2026-01-01,35000,1,0\n';

export async function GET() {
  await requireOrgMembership();
  return new NextResponse(HEADER + EXAMPLE, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="import-template.csv"',
    },
  });
}
