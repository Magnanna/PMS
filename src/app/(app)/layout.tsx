import { requireOrgMembership } from "@/lib/auth/session";
import { signOut } from "@/app/(auth)/actions";
import { endImpersonation } from "@/app/platform/orgs/[orgId]/actions";
import { AppSidebar } from "@/components/AppSidebar";
import { db } from "@/db";
import { orgs } from "@/db/schema";
import { eq } from "drizzle-orm";

const ROLE_LABEL: Record<string, string> = { owner: "Owner", manager: "Manager" };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { orgId, role, isImpersonating } = await requireOrgMembership();
  const [org] = await db.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, orgId));

  return (
    <div className={`flex min-h-screen bg-[var(--color-ink-50)] text-[var(--color-ink-900)] ${isImpersonating ? "pt-8" : ""}`}>
      {isImpersonating && (
        <div className="fixed top-0 inset-x-0 z-50 bg-amber-500 text-white text-[12.5px] px-4 py-1.5 flex items-center justify-center gap-3">
          <span>Support session — viewing {org?.name ?? "this org"} as owner</span>
          <form action={endImpersonation}>
            <button type="submit" className="underline font-medium">
              End session
            </button>
          </form>
        </div>
      )}
      <AppSidebar
        orgName={org?.name ?? "My Business"}
        roleLabel={ROLE_LABEL[role] ?? role}
        onSignOut={
          <form action={signOut}>
            <button type="submit" className="btn-secondary px-3 py-1.5 text-[12.5px]">
              Sign out
            </button>
          </form>
        }
      />
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="h-[76px] md:hidden shrink-0 no-print" />
          <div className="mx-auto max-w-6xl w-full p-4 md:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
