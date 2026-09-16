import { redirect } from "next/navigation";
import { requireOrgMembership } from "@/lib/auth/session";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** US-J1: audit log, owner-only (matches docs/PERMISSIONS.md). */
export default async function AuditLogPage() {
  const { orgId, role } = await requireOrgMembership();
  if (role !== "owner") redirect("/dashboard");

  const rows = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.orgId, orgId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(200);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-[var(--color-ink-500)] text-sm mt-1">
          Who changed what — last 200 events.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-[12.5px] text-[var(--color-ink-400)]">
            No audited actions yet.
          </div>
        ) : (
          <table className="w-full text-left text-[12.5px]">
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-2.5">
                    <span className="font-medium">{r.action}</span>
                    <span className="text-[var(--color-ink-400)]"> · {r.entityType}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--color-ink-400)] capitalize">
                    {r.actorRole}
                  </td>
                  <td className="px-5 py-2.5 text-right text-[var(--color-ink-400)] tnum whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleString("en-KE", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
