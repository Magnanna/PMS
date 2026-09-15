import Link from "next/link";
import { requireOrgMembership } from "@/lib/auth/session";
import { signOut } from "@/app/(auth)/actions";

const NAV = [
  { href: "/dashboard", label: "Home" },
  { href: "/properties", label: "Properties" },
  { href: "/tenants", label: "Tenants" },
  { href: "/leases", label: "Leases" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requireOrgMembership();

  return (
    <div className="flex min-h-full">
      <aside className="sidebar-chrome hairline-r w-56 shrink-0 p-4 flex flex-col gap-1">
        <div className="px-2 py-2 text-sm font-semibold tracking-tight">
          Kenya Rental PMS
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2 py-1.5 text-sm text-[var(--color-ink-600)] hover:bg-[var(--color-ink-100)] hover:text-[var(--color-ink-900)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-2 px-2">
          <div className="text-xs text-[var(--color-ink-400)] capitalize">{role}</div>
          <form action={signOut}>
            <button type="submit" className="btn-secondary w-full px-3 py-1.5 text-sm">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
