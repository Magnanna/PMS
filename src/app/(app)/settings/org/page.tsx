import { getOrgDetails } from "./actions";
import { OrgSettingsForm } from "./form";

export default async function OrgSettingsPage() {
  const org = await getOrgDetails();

  return (
    <div className="flex justify-center">
      <div className="max-w-md w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organization</h1>
          <p className="text-[var(--color-ink-500)] text-sm mt-1">
            KRA PIN appears on receipts and tax exports.
          </p>
        </div>
        <OrgSettingsForm
          defaultKraPin={org?.kraPin ?? ""}
          defaultRegisteredAddress={org?.registeredAddress ?? ""}
          defaultContactPerson={org?.contactPerson ?? ""}
        />
      </div>
    </div>
  );
}
