/**
 * Ported token-for-token from Zeno's `Stat` component in
 * src/app/(admin)/admin/page.tsx (inline there; promoted to a shared
 * component here since our dashboard/leases/properties pages all want it).
 * Exact type scale (12.5px/26px/11.5px) and card treatment
 * (rounded-xl border-ink-200 shadow-sm) — not our looser `.card` hairline
 * treatment, which is a different, lighter-weight surface.
 */
export function StatCard({
  label,
  value,
  sub,
  subTone,
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: "good" | "bad" | "muted";
}) {
  return (
    <div className="bg-white p-5 rounded-xl border border-[var(--color-ink-200)] shadow-sm">
      <div className="text-[12.5px] font-medium text-[var(--color-ink-400)]">{label}</div>
      <div className="text-[26px] font-semibold tracking-tight tnum mt-1.5 leading-none stat-figure">
        {value}
      </div>
      {sub && (
        <div
          className={`text-[11.5px] mt-2 ${
            subTone === "good"
              ? "text-[var(--color-good)]"
              : subTone === "bad"
                ? "text-[var(--color-bad)]"
                : "text-[var(--color-ink-400)]"
          }`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
