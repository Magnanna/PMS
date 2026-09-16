import { signOut } from "@/app/(auth)/actions";

export default function SuspendedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-ink-50)] p-4">
      <div className="max-w-sm bg-white rounded-xl border border-[var(--color-ink-200)] shadow-sm p-6 space-y-3 text-center">
        <h1 className="text-lg font-bold tracking-tight">Account suspended</h1>
        <p className="text-[13px] text-[var(--color-ink-500)]">
          Your organization&apos;s access has been suspended. Contact support for details.
        </p>
        <form action={signOut}>
          <button type="submit" className="btn-secondary px-4 py-2 text-[13px]">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
