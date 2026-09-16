import { getMpesaCredentialsSummary } from "./actions";
import { MpesaSettingsForm } from "./form";

export default async function MpesaSettingsPage() {
  const summary = await getMpesaCredentialsSummary();

  return (
    <div className="flex justify-center">
      <div className="max-w-md w-full space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">M-Pesa</h1>
          <p className="text-sm text-[var(--color-ink-600)] mt-1">
            Connect your own Safaricom Paybill or Till via Daraja — rent lands directly in
            your account, not ours.
          </p>
        </div>

        {summary && (
          <div className="card p-4 text-sm">
            <span className="text-[var(--color-ink-600)]">Connected:</span>{" "}
            <span className="tnum">
              {summary.shortcodeType} {summary.shortcode}
            </span>{" "}
            <span
              className="ml-1"
              style={{
                color:
                  summary.environment === "live"
                    ? "var(--color-good)"
                    : "var(--color-warn)",
              }}
            >
              {summary.environment}
            </span>
          </div>
        )}

        <MpesaSettingsForm />
      </div>
    </div>
  );
}
