/**
 * Ported token-for-token from Zeno's status-pill pattern in
 * src/app/(admin)/admin/page.tsx (statusBadge/planBadge maps, inlined per
 * call site there; generalized into one component + tone here).
 */
const TONE_CLASSES: Record<string, string> = {
  good: "bg-emerald-50 text-emerald-700 border-emerald-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  warn: "bg-amber-50 text-amber-700 border-amber-200",
  bad: "bg-red-50 text-red-700 border-red-200",
  accent: "bg-[var(--color-accent-50)] text-[var(--color-accent-700)] border-[var(--color-accent-100)]",
  neutral: "bg-[var(--color-ink-50)] text-[var(--color-ink-600)] border-[var(--color-ink-200)]",
};

export type BadgeTone = keyof typeof TONE_CLASSES;

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-medium border capitalize ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
