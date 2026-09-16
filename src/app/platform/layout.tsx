import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { signOut } from "@/app/(auth)/actions";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-[var(--color-ink-50)] text-[var(--color-ink-900)]">
      <header className="sidebar-chrome hairline-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <span className="text-[13.5px] font-semibold tracking-tight">Platform Admin</span>
          <Link href="/platform/orgs" className="text-[12.5px] text-[var(--color-ink-600)]">
            Orgs
          </Link>
          <Link href="/platform/audit" className="text-[12.5px] text-[var(--color-ink-600)]">
            Audit Log
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[11.5px] text-[var(--color-ink-400)]">{admin.email} · {admin.role}</span>
          <form action={signOut}>
            <button type="submit" className="text-[12.5px] text-[var(--color-ink-600)]">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-5xl mx-auto w-full p-4 md:p-8 space-y-4">{children}</main>
    </div>
  );
}
