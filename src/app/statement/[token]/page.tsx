import { notFound } from "next/navigation";
import { verifyStatementToken } from "@/lib/reports/statement-link";
import { computeTenantStatement } from "@/lib/reports/tenant-statement";

export const dynamic = "force-dynamic";

export default async function StatementPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const verified = verifyStatementToken(token);
  if (!verified) notFound();

  const statement = await computeTenantStatement(verified.leaseId);
  if (!statement) notFound();

  return (
    <main className="flex-1 flex items-center justify-center p-8 print:p-0">
      <div className="card p-8 max-w-lg w-full space-y-4 print:shadow-none print:border-0">
        <div className="text-center">
          <div className="font-semibold text-lg">{statement.orgName}</div>
          <div className="text-sm text-[var(--color-ink-600)]">
            {statement.propertyName} / {statement.unitNumber} · {statement.tenantName}
          </div>
        </div>

        <div className="hairline-t hairline-b">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] text-[var(--color-ink-400)] uppercase tracking-wider">
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 font-medium">Description</th>
                <th className="py-2 font-medium text-right">Charged</th>
                <th className="py-2 font-medium text-right">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-ink-100)]">
              {statement.lines.map((line, i) => (
                <tr key={i} className="tnum">
                  <td className="py-2 text-[11px] text-[var(--color-ink-400)]">{line.date}</td>
                  <td className="py-2">{line.description}</td>
                  <td className="py-2 text-right">
                    {line.chargeCents > 0 ? (line.chargeCents / 100).toLocaleString() : "—"}
                  </td>
                  <td className="py-2 text-right">
                    {line.paidCents > 0 ? (line.paidCents / 100).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
              {statement.lines.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-[var(--color-ink-400)]">
                    No activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-baseline pt-2">
          <span className="text-sm text-[var(--color-ink-600)]">
            {statement.balanceCents > 0 ? "Balance due" : "Balance"}
          </span>
          <span
            className="money-lg"
            style={{ color: statement.balanceCents > 0 ? "var(--color-bad)" : "var(--color-good)" }}
          >
            KES {Math.abs(statement.balanceCents / 100).toLocaleString()}
          </span>
        </div>
      </div>
    </main>
  );
}
