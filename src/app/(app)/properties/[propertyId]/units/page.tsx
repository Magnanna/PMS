import Link from "next/link";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireOrgMembership } from "@/lib/auth/session";
import { listUnits } from "./actions";
import { UnitArchiveButton } from "./unit-archive-button";

const STATUS_COLOR: Record<string, string> = {
  vacant: "var(--color-warn)",
  occupied: "var(--color-good)",
  maintenance: "var(--color-bad)",
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
      <main className="p-8">
        <p className="text-[var(--color-bad)]">Property not found.</p>
      </main>
    );
  }

  return (
    <main className="p-8 space-y-6">
      <div>
        <Link href="/properties" className="text-sm text-[var(--color-accent-500)]">
          ← Properties
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{property.name}</h1>
          <p className="text-sm text-[var(--color-ink-600)]">{property.address}</p>
        </div>
        <Link href={`/properties/${propertyId}/units/new`} className="btn-primary px-4 py-2">
          + New unit
        </Link>
      </div>

      {unitList.length === 0 ? (
        <div className="card p-8 text-center text-[var(--color-ink-600)]">
          No units yet.{" "}
          <Link
            href={`/properties/${propertyId}/units/new`}
            className="text-[var(--color-accent-500)]"
          >
            Add the first unit
          </Link>
          .
        </div>
      ) : (
        <div className="card divide-y divide-[var(--color-ink-100)]">
          {unitList.map((u) => (
            <div key={u.id} className="flex items-center justify-between p-4">
              <div>
                <div className="font-medium">Unit {u.unitNumber}</div>
                <div className="text-sm text-[var(--color-ink-600)] tnum">
                  {u.bedrooms != null ? `${u.bedrooms} bd · ` : ""}
                  KES {(u.rentAmountCents / 100).toLocaleString()}/mo ·{" "}
                  <span style={{ color: STATUS_COLOR[u.status] }}>{u.status}</span>
                </div>
              </div>
              <UnitArchiveButton propertyId={propertyId} unitId={u.id} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
