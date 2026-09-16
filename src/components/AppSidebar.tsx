"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Ported structure from Zeno's src/components/Sidebar.tsx / AdminSidebar.tsx
 * (identical pattern in both — grouped icon nav, identity header, mobile
 * drawer). Token-for-token match: emoji icons (not an icon font/lucide),
 * the precise 10.5/11.5/13/13.5px type scale, sidebar-chrome translucency,
 * hairline-t footer. Uses the app's own teal accent (--color-accent-*),
 * not the admin console's red — that red is Zeno's super-admin-only
 * branding, not a shared token (see docs/DESIGN.md role-preservation rule).
 */

const groups: { label: string | null; items: { href: string; label: string; icon: string }[] }[] = [
  {
    label: null,
    items: [{ href: "/dashboard", label: "Home", icon: "🏠" }],
  },
  {
    label: "Portfolio",
    items: [
      { href: "/properties", label: "Properties", icon: "🏢" },
      { href: "/tenants", label: "Tenants", icon: "👥" },
      { href: "/leases", label: "Leases", icon: "📄" },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/settings/mpesa", label: "M-Pesa", icon: "💸" },
      { href: "/reports/mri", label: "MRI Tax", icon: "🧾" },
    ],
  },
  {
    label: "Organization",
    items: [{ href: "/settings/org", label: "Settings", icon: "⚙️" }],
  },
];

export function AppSidebar({
  orgName,
  roleLabel,
  onSignOut,
}: {
  orgName: string;
  roleLabel: string;
  onSignOut: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Close the mobile drawer on navigation — adjusted during render (React's
  // recommended pattern for "reset state when a prop changes") rather than
  // an effect, which would cause an extra render pass for no benefit here.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  const active = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  const initials = orgName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const nav = (
    <>
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="shrink-0 w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center bg-[var(--color-accent-500)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
            <span className="text-white text-[18px] font-bold">{initials}</span>
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold tracking-tight truncate leading-tight">
              {orgName}
            </div>
            <div className="text-[10.5px] text-[var(--color-ink-400)] mt-0.5">{roleLabel}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.label && (
              <div className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--color-ink-400)]">
                {g.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    className={`flex items-center gap-2.5 rounded-md px-2 py-[7px] text-[13px] transition-colors ${
                      active(it.href)
                        ? "bg-white/80 text-[var(--color-accent-700)] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                        : "text-[var(--color-ink-600)] hover:bg-white/50"
                    }`}
                  >
                    <span className="w-4 text-center opacity-70">{it.icon}</span>
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="hairline-t px-4 py-3 flex items-center justify-between">
        <div className="min-w-0 text-[11.5px] text-[var(--color-ink-600)] truncate">
          {roleLabel}
        </div>
        {onSignOut}
      </div>
    </>
  );

  return (
    <>
      <div className="md:hidden no-print fixed top-0 inset-x-0 z-40 px-3 pt-3">
        <div className="relative sidebar-chrome rounded-[32px] shadow-[0_2px_14px_rgba(0,0,0,0.08)] border border-[var(--color-ink-100)]/70 h-16 flex items-center justify-center">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="absolute left-2.5 w-10 h-10 flex flex-col items-center justify-center gap-[5px] rounded-full hover:bg-white/60"
          >
            <span className="block w-5 h-[1.5px] bg-[var(--color-ink-900)]" />
            <span className="block w-5 h-[1.5px] bg-[var(--color-ink-900)]" />
            <span className="block w-5 h-[1.5px] bg-[var(--color-ink-900)]" />
          </button>
          <div className="flex flex-col items-center leading-tight max-w-[55vw]">
            <span className="text-[14px] font-semibold tracking-tight truncate">{orgName}</span>
            <span className="text-[11px] text-[var(--color-ink-400)] mt-0.5 truncate">{roleLabel}</span>
          </div>
        </div>
      </div>

      {open && (
        <div className="md:hidden no-print fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[270px] max-w-[85vw] bg-[var(--color-ink-50)] flex flex-col shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-3 w-8 h-8 rounded-full hover:bg-white/70 text-[18px] text-[var(--color-ink-600)]"
            >
              ×
            </button>
            {nav}
          </aside>
        </div>
      )}

      <aside className="hidden md:flex sidebar-chrome no-print w-[230px] shrink-0 sticky top-0 h-screen flex-col border-r border-[var(--color-ink-100)]">
        {nav}
      </aside>
    </>
  );
}
