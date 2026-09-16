import { notFound } from "next/navigation";
import { getOrgWithUsage } from "@/lib/platform/usage";
import { ImpersonateForm } from "./form";

export default async function ImpersonatePage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const org = await getOrgWithUsage(orgId);
  if (!org) notFound();

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Start support session</h1>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-[13px] text-amber-800">
        You are about to sign in as an owner of <span className="font-semibold">{org.name}</span>. This
        session is time-boxed to 30 minutes, banner-marked throughout, and fully audit-logged under your
        own account.
      </div>
      <ImpersonateForm orgId={org.id} />
    </div>
  );
}
