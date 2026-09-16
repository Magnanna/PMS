# Ported modules (Section 12 port discipline)

Modules copied from `zoho-books-clone copy 2` ("Zeno") are frozen —
no feature edits in place. If Kenyan-numbering/tax-law fixes are needed,
fix here directly (not upstream) and note it below. New PMS-specific
behavior goes in a new module that wraps/extends the ported one.

| File | Source | Source commit/state | Notes |
|---|---|---|---|
| `src/lib/payments/phone.ts` | `src/lib/payments/phone.ts` | working tree, Sep 2026 | verbatim |
| `src/lib/payments/crypto.ts` | `src/lib/payments/crypto.ts` | working tree, Sep 2026 | adapted: generic single-string encrypt/decrypt instead of Zeno's JSON-config version (our schema stores consumer key/secret/passkey as separate encrypted columns) |
| `src/lib/payments/ref-format.ts` | `src/lib/payments/ref-format.ts` | working tree, Sep 2026 | verbatim |
| `src/lib/payments/mpesaDaraja.ts` | `src/lib/payments/mpesaDaraja.ts` | working tree, Sep 2026 | adapted: reads per-org credentials from our DB columns instead of a JSON config blob; dropped payOut/B2C (non-goal for v1) |

Still to port when their stories land: `etims.ts` (US-D1, M3), `receipts/*`
(US-D1, M3), `sms/advanta.ts` (US-F1, M4). `posting.ts`/`match.ts` were
**not** ported verbatim — our ledger schema (Section 7's flat account-tag
model) and matching needs differ enough that
`src/lib/ledger/posting.ts` and the C2B-matching slice in
`src/app/api/payments/webhook/mpesa/route.ts` were written fresh, using
Zeno's versions as a design reference rather than a copy source.
