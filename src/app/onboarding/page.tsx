import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { seedDemoData } from "./actions";

export default async function OnboardingPage() {
  await requireUser();

  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="card p-8 max-w-lg w-full space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
          <p className="text-sm text-[var(--color-ink-600)] mt-1">
            Add your first property, or load demo data to explore the flow first.
          </p>
        </div>

        <div className="space-y-3">
          <Link href="/properties/new" className="btn-primary block text-center px-4 py-2">
            Add my first property
          </Link>

          <form action={seedDemoData}>
            <button type="submit" className="btn-secondary w-full px-4 py-2">
              Load demo data instead
            </button>
          </form>
        </div>

        <p className="text-xs text-[var(--color-ink-400)]">
          Demo data is clearly labelled (DEMO) and can be removed later once you add real
          properties.
        </p>
      </div>
    </main>
  );
}
