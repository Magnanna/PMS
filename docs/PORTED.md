# Ported modules (Section 12 port discipline)

Modules copied from `zoho-books-clone copy 2` ("Zeno") are frozen —
no feature edits in place. If Kenyan-numbering/tax-law fixes are needed,
fix here directly (not upstream) and note it below. New PMS-specific
behavior goes in a new module that wraps/extends the ported one.

| File | Source | Source commit/state | Notes |
|---|---|---|---|
| `src/lib/payments/phone.ts` | `src/lib/payments/phone.ts` | working tree, Sep 2026 | verbatim |

More modules land as M2 (Epic C) starts: `mpesaDaraja.ts`, `match.ts`,
`ref-format.ts`, `etims.ts`, `receipts/*`, `sms/advanta.ts`, `posting.ts`.
