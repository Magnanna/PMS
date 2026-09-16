import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-ink-50)] text-[var(--color-ink-900)]">
      <header className="sidebar-chrome hairline-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <span className="text-[13.5px] font-semibold tracking-tight">My Rental</span>
        <div className="flex items-center gap-4">
          <Link href="/portal" className="text-[12.5px] text-[var(--color-ink-600)]">
            Home
          </Link>
          <Link href="/portal/maintenance" className="text-[12.5px] text-[var(--color-ink-600)]">
            Maintenance
          </Link>
          <a
            href="/api/portal/export-data"
            className="text-[12.5px] text-[var(--color-ink-600)]"
          >
            My data
          </a>
          <form action={signOut}>
            <button type="submit" className="text-[12.5px] text-[var(--color-ink-600)]">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-md mx-auto w-full p-4 space-y-4">{children}</main>
    </div>
  );
}
