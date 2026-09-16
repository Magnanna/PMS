import { notFound } from "next/navigation";
import { getReceiptByToken } from "@/lib/receipts/lookup";
import { qrPngDataUrl } from "@/lib/receipts/qr";
import { env } from "@/env";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getReceiptByToken(token);
  if (!data) notFound();

  const { receipt, payment, unit, property, tenant, org, allocations } = data;

  const verifyUrl = `${env.NEXT_PUBLIC_SITE_URL}/r/${token}`;
  const qrDataUrl = await qrPngDataUrl(verifyUrl);

  return (
    <main className="flex-1 flex items-center justify-center p-8 print:p-0">
      <div className="card p-8 max-w-md w-full space-y-4 print:shadow-none print:border-0">
        {receipt.simulated && (
          <div
            className="text-center text-[11px] font-semibold tracking-wide py-1.5 rounded-md"
            style={{ background: "var(--color-ink-100)", color: "var(--color-bad)" }}
          >
            SIMULATED TAX DEVICE — NOT FOR KRA FILING
          </div>
        )}

        <div className="text-center">
          <div className="font-semibold text-lg">{org.name}</div>
          {org.kraPin && (
            <div className="text-xs text-[var(--color-ink-400)]">KRA PIN: {org.kraPin}</div>
          )}
        </div>

        <div className="hairline-t hairline-b py-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-ink-600)]">Tenant</span>
            <span>{tenant.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-ink-600)]">Property / Unit</span>
            <span>
              {property.name} / {unit.unitNumber}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-ink-600)]">Date</span>
            <span className="tnum">
              {new Date(payment.paidAt).toLocaleDateString("en-KE", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--color-ink-600)]">Method</span>
            <span className="capitalize">{payment.method.replace("_", " ")}</span>
          </div>
          {payment.mpesaReceiptNumber && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--color-ink-600)]">M-Pesa ref</span>
              <span className="tnum">{payment.mpesaReceiptNumber}</span>
            </div>
          )}
        </div>

        <div className="space-y-1">
          {allocations.map((a) =>
            a.lines.map((l, i) => (
              <div key={`${a.invoiceId}-${i}`} className="flex justify-between text-sm">
                <span>
                  {l.description} ({a.billingPeriod.slice(0, 7)})
                </span>
                <span className="tnum">KES {(a.amountCents / 100).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>

        <div className="hairline-t pt-3 flex justify-between items-baseline">
          <span className="text-sm text-[var(--color-ink-600)]">Total paid</span>
          <span className="money-lg">KES {(payment.amountCents / 100).toLocaleString()}</span>
        </div>

        <div className="flex flex-col items-center gap-2 pt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Verify this receipt" width={120} height={120} />
          <div className="text-[10px] text-[var(--color-ink-400)] text-center">
            Scan to verify · {receipt.cuInvoiceNumber}
          </div>
        </div>
      </div>
    </main>
  );
}
