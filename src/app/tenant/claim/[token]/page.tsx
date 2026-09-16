import { verifyTenantInviteToken } from "@/lib/auth/tenant-invite";
import { db } from "@/db";
import { tenantProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ClaimForm } from "./form";

export default async function ClaimTenantPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const verified = verifyTenantInviteToken(token);

  if (!verified) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="card p-8 max-w-sm w-full text-center space-y-2">
          <h1 className="text-lg font-semibold tracking-tight">Invite expired</h1>
          <p className="text-sm text-[var(--color-ink-600)]">
            Ask your landlord to resend the invite.
          </p>
        </div>
      </main>
    );
  }

  const [tenant] = await db
    .select({ name: tenantProfiles.name, userId: tenantProfiles.userId })
    .from(tenantProfiles)
    .where(eq(tenantProfiles.id, verified.tenantProfileId));

  if (!tenant) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="card p-8 max-w-sm w-full text-center space-y-2">
          <h1 className="text-lg font-semibold tracking-tight">Not found</h1>
        </div>
      </main>
    );
  }

  if (tenant.userId) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="card p-8 max-w-sm w-full text-center space-y-2">
          <h1 className="text-lg font-semibold tracking-tight">Already set up</h1>
          <p className="text-sm text-[var(--color-ink-600)]">
            This portal account is already active — sign in instead.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="card p-8 max-w-sm w-full space-y-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold tracking-tight">Welcome, {tenant.name}</h1>
          <p className="text-sm text-[var(--color-ink-600)] mt-1">
            Set a password to access your tenant portal.
          </p>
        </div>
        <ClaimForm token={token} />
      </div>
    </main>
  );
}
