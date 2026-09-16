import { getPayLinkView } from "./actions";
import { PayForm } from "./form";

export const dynamic = "force-dynamic";

export default async function PayLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await getPayLinkView(token);

  if ("error" in view) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="card p-8 max-w-sm w-full text-center space-y-2">
          <h1 className="text-lg font-semibold tracking-tight">Link unavailable</h1>
          <p className="text-sm text-[var(--color-ink-600)]">{view.error}</p>
        </div>
      </main>
    );
  }

  if (view.balanceCents <= 0) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="card p-8 max-w-sm w-full text-center space-y-2">
          <h1 className="text-lg font-semibold tracking-tight">Already paid</h1>
          <p className="text-sm text-[var(--color-ink-600)]">
            This invoice ({view.billingPeriod.slice(0, 7)}) is fully settled — nothing due.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center p-8">
      <div className="card p-8 max-w-sm w-full space-y-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold tracking-tight">Pay rent</h1>
          <p className="text-sm text-[var(--color-ink-600)] mt-1">
            {view.propertyName} / {view.unitNumber} · {view.billingPeriod.slice(0, 7)}
          </p>
        </div>

        <div className="hairline-t hairline-b py-3 text-center">
          <div className="money-lg">KES {(view.balanceCents / 100).toLocaleString()}</div>
          <div className="text-xs text-[var(--color-ink-400)] mt-1">
            {view.tenantName} · ref {view.invoiceReference}
          </div>
        </div>

        <PayForm token={token} defaultPhone={view.tenantPhone} />
      </div>
    </main>
  );
}
