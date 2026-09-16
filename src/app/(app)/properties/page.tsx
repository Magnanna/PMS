import Link from "next/link";
import { listProperties } from "./actions";
import { db } from "@/db";
import { units } from "@/db/schema";
import { isNull, and, inArray } from "drizzle-orm";
import { ArchiveButton } from "./archive-button";

export const dynamic = "force-dynamic";

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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Properties</h1>
          <p className="text-[var(--color-ink-500)] text-sm mt-1">
            Every property in your portfolio.
          </p>
        </div>
        <Link href="/properties/new" className="btn-primary px-4 py-2 text-[13px]">
          + New property
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        {props.length === 0 ? (
          <div className="px-5 py-8 text-center text-[12.5px] text-[var(--color-ink-400)]">
            No properties yet.{" "}
            <Link href="/properties/new" className="text-[var(--color-accent-700)] font-medium">
              Add your first property
            </Link>
            .
          </div>
        ) : (
          <table className="w-full text-left text-[12.5px]">
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {props.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3">
                    <Link
                      href={`/properties/${p.id}/units`}
                      className="font-medium hover:text-[var(--color-accent-700)]"
                    >
                      {p.name}
                    </Link>
                    <div className="text-[11px] text-[var(--color-ink-400)] mt-0.5">
                      {p.address} {p.county ? `· ${p.county}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[var(--color-ink-400)] tnum">
                    {countByProperty.get(p.id) ?? 0} unit
                    {(countByProperty.get(p.id) ?? 0) === 1 ? "" : "s"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <ArchiveButton propertyId={p.id} />
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
