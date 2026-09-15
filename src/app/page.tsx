import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="card p-8 max-w-md w-full space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Kenya Rental PMS</h1>
        <p className="text-[var(--color-ink-600)]">
          Rental management for Kenyan landlords — M-Pesa rent collection, KRA-compliant
          receipts.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Link href="/login" className="btn-secondary px-4 py-2">
            Sign in
          </Link>
          <Link href="/signup" className="btn-primary px-4 py-2">
            Get started
          </Link>
        </div>
      </div>
    </main>
  );
}
