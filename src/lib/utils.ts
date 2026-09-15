/** Minimal className joiner — no clsx/tailwind-merge dependency needed for our usage. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
