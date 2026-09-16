import Link from "next/link";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireOrgMembership } from "@/lib/auth/session";
import { listUnits } from "./actions";
import { UnitArchiveButton } from "./unit-archive-button";
import { Badge, type BadgeTone } from "@/components/Badge";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, BadgeTone> = {
  vacant: "warn",
  occupied: "good",
  maintenance: "bad",
};

export default async function UnitsPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const { orgId } = await requireOrgMembership();

  const [property] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.orgId, orgId)));

  const unitList = await listUnits(propertyId);

  if (!property) {
    return (
      <div>
        <p className="text-[var(--color-bad)]">Property not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/properties" className="text-[12.5px] text-[var(--color-accent-700)]">
          ← Properties
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{property.name}</h1>
          <p className="text-[var(--color-ink-500)] text-sm mt-1">{property.address}</p>
        </div>
        <Link
          href={`/properties/${propertyId}/units/new`}
          className="btn-primary px-4 py-2 text-[13px]"
        >
          + New unit
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        {unitList.length === 0 ? (
          <div className="px-5 py-8 text-center text-[12.5px] text-[var(--color-ink-400)]">
            No units yet.{" "}
            <Link
              href={`/properties/${propertyId}/units/new`}
              className="text-[var(--color-accent-700)] font-medium"
            >
              Add the first unit
            </Link>
            .
          </div>
        ) : (
          <table className="w-full text-left text-[12.5px]">
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {unitList.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-3">
                    <div className="font-medium">Unit {u.unitNumber}</div>
                    <div className="text-[11px] text-[var(--color-ink-400)] tnum mt-0.5">
                      {u.bedrooms != null ? `${u.bedrooms} bd · ` : ""}
                      KES {(u.rentAmountCents / 100).toLocaleString()}/mo
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={STATUS_TONE[u.status]}>{u.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <UnitArchiveButton propertyId={propertyId} unitId={u.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
