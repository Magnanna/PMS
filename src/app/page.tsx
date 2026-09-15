export default function Home() {
  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="card p-8 max-w-md w-full space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Kenya Rental PMS</h1>
        <p className="text-[var(--color-ink-600)]">
          M0 skeleton — design system ported from Zeno, Supabase + Drizzle wired,
          RLS baseline in place.
        </p>
        <div className="money-lg">KES 0.00</div>
        <button className="btn-primary px-4 py-2">Get started</button>
      </div>
    </main>
  );
}
