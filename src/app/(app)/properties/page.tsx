import Link from "next/link";
import { listProperties } from "./actions";
import { db } from "@/db";
import { units } from "@/db/schema";
import { isNull, and, inArray } from "drizzle-orm";
import { ArchiveButton } from "./archive-button";

export default async function PropertiesPage() {
  const props = await listProperties();

  const unitCounts = props.length
    ? await db
        .select({ propertyId: units.propertyId, id: units.id })
        .from(units)
        .where(
          and(
            inArray(
              units.propertyId,
              props.map((p) => p.id)
            ),
            isNull(units.archivedAt)
          )
        )
    : [];

  const countByProperty = new Map<string, number>();
  for (const u of unitCounts) {
    countByProperty.set(u.propertyId, (countByProperty.get(u.propertyId) ?? 0) + 1);
  }

  return (
    <main className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
        <Link href="/properties/new" className="btn-primary px-4 py-2">
          + New property
        </Link>
      </div>

      {props.length === 0 ? (
        <div className="card p-8 text-center text-[var(--color-ink-600)]">
          No properties yet.{" "}
          <Link href="/properties/new" className="text-[var(--color-accent-500)]">
            Add your first property
          </Link>
          .
        </div>
      ) : (
        <div className="card divide-y divide-[var(--color-ink-100)]">
          {props.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-4">
              <div>
                <Link
                  href={`/properties/${p.id}/units`}
                  className="font-medium hover:text-[var(--color-accent-500)]"
                >
                  {p.name}
                </Link>
                <div className="text-sm text-[var(--color-ink-600)]">
                  {p.address} {p.county ? `· ${p.county}` : ""} · {countByProperty.get(p.id) ?? 0} unit
                  {(countByProperty.get(p.id) ?? 0) === 1 ? "" : "s"}
                </div>
              </div>
              <ArchiveButton propertyId={p.id} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
