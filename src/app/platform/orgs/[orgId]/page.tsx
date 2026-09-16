import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrgWithUsage } from "@/lib/platform/usage";
import { Badge } from "@/components/Badge";
import { SuspendForm } from "./suspend-form";

function fmtKes(cents: number): string {
  return `KES ${(cents / 100).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
}

export default async function PlatformOrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const org = await getOrgWithUsage(orgId);
  if (!org) notFound();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
          <p className="text-[12.5px] text-[var(--color-ink-400)] mt-1">
            {org.plan} plan · {org.unitCount} units · created {org.createdAt.toLocaleDateString()}
          </p>
        </div>
        {org.suspended ? <Badge tone="bad">Suspended</Badge> : <Badge tone="good">Active</Badge>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
          <div className="text-[12.5px] text-[var(--color-ink-400)]">SMS sent this month</div>
          <div className="text-[20px] font-semibold tnum mt-1">{org.smsUnitsThisMonth}</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
          <div className="text-[12.5px] text-[var(--color-ink-400)]">Payment volume this month</div>
          <div className="text-[20px] font-semibold tnum mt-1">{fmtKes(org.paymentVolumeCentsThisMonth)}</div>
        </div>
      </div>

      {org.suspended && org.suspendedReason && (
        <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-4 text-[13px]">
          <span className="font-medium">Suspended reason:</span> {org.suspendedReason}
        </div>
      )}

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-5 space-y-3">
        <h2 className="text-[13.5px] font-semibold">Abuse controls</h2>
        <SuspendForm orgId={org.id} suspended={org.suspended} />
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-5 space-y-2">
        <h2 className="text-[13.5px] font-semibold">Support access</h2>
        <p className="text-[12.5px] text-[var(--color-ink-400)]">
          Impersonation is time-boxed (30 min), requires a reason and explicit consent, and is fully
          audit-logged.
        </p>
        <Link href={`/platform/orgs/${org.id}/impersonate`} className="btn-secondary px-4 py-2 text-[13px] inline-block">
          Start support session
        </Link>
      </div>
    </div>
  );
}
