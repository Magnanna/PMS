# PRD v2: Kenya Rental Management System (working name: TBD)

> **Revision of:** `tasks/prd-rental-management-system.md` (v1 kept unchanged for diffing).
> **Why v2 exists:** an audit of v1 found compliance facts that needed correcting, several payment/data-model loopholes that would cause real money bugs, and missing stories without which the build stalls or ships unreliable. All changes are listed below; original story IDs (US-A1…H2) are preserved so existing plans stay diffable.

## 0. Changelog (v1 → v2)

**Factual corrections (verified against current Kenyan rules, Sept 2026):**

1. **MRI threshold wording was wrong/unsafe.** v1 said "skips calculation for landlords under **KES 288,000/year**". The KES 288,000 figure historically attaches to the **monthly** gross-rent figure under the existing MRI regime (7.5% retained by Finance Act 2025, increase to 10% dropped). More importantly, KRA published **draft Income Tax (Residential Rental Income) Regulations on 22 Mar 2026** that rework the regime: an **annual** KES 288,000 (KES 24,000/month) entry threshold, property-level registration on **eRITS**, and an end to the "voluntary regime" framing. Because this is moving law, v2 adds: **all statutory constants (rate, thresholds, controlled-tenancy cap, due dates) live in one per-org-configurable `compliance-constants.ts`, never hard-coded in logic or UI copy**, plus a new Section 3 "Compliance & Legal Facts".
2. **eRITS export (US-D4) was underspecified.** The draft RRI regs require **property-level** data: KRA PIN, physical address, **Land Reference (LR) number**, title document reference, tenancy agreements, and a **rent roll**. v1's schema stores none of these. v2 adds compliance fields to Property/Org/Tenant (US-B7) and rewrites US-D4 accordingly.
3. **Controlled-tenancy cap (KES 2,500) confirmed still current** — Rent Restriction Act (Cap 304, 1959) remains in force; the Landlord and Tenant Bill (2021) that would replace it is still pending. Kept, but demoted to a configurable constant with a "watch pending legislation" note.
4. **Kenya Data Protection Act 2019 was entirely absent** despite the system storing national IDs, phone numbers, and (v2) ID documents. v2 adds US-J2 (consent, retention, erasure/export rights).

**Loopholes closed (would have caused money/trust bugs):**

5. **M-Pesa account ownership was undecided** — biggest design hole. Who's Daraja paybill/runs the STK push? If the *platform's* shortcode collects rent and remits to landlords, that's a payment-aggregation/payout model (explicitly a v1 non-goal). v2 decides: **each org connects its own Safaricom/Daraja credentials** (US-C10, FR-8a).
6. **No idempotency or lost-callback handling.** Duplicate STK callbacks double-post the ledger; lost callbacks silently drop paid rent. v2: `webhook_events` table + idempotent processing (US-C9), daily Daraja query-API reconciliation job.
7. **Partial payments, overpayments, refunds, and cash/bank payments had no story.** Real Kenyan tenants pay cash, under-till, and short every month. v2: US-C6 (offline payment recording), US-C7 (allocation, credit balances, reversals), multi-line invoices (US-C8).
8. **Property archive "cascades on property archive" would orphan active leases.** v2: archive blocks or requires termination; everything soft-deletes; ledger is immutable.
9. **Tenant RLS policies were unspecified** — US-A2 only covered org-scoped tables; tenant-portal users need policies keyed to their own `tenant_id`, and the same person can tenanted by **two landlords in two orgs** (v1's model can't express that). v2: US-A5 (identity model), US-A2 extended.
10. **Cron timezone unhandled** — Vercel/pg_cron fire in UTC; billing day and "3 days before the 20th" must evaluate in **Africa/Nairobi (UTC+3)**. v2: NFR-7 + US-C1 AC.
11. **Invoice double-generation risk** if a lease's billing day lands while a renewal is mid-flight, or a cron retries. v2: unique index `(lease_id, billing_period)` (US-C1).
12. **No permission matrix** ("manager can't do billing" is too vague to build/test). v2: US-A6.
13. **"Typecheck passes" is a weak DoD for money code.** v2: ledger, MRI, pro-rating, allocation, and phone-normalization logic require unit tests with integer-cent cases + at least one negative test per payment story.

**New features that boost the system (v2 additions):** public pay links without login (US-H3), receipt share-to-WhatsApp (US-F4), reminder escalation ladder (US-F3), rent roll (US-G3), per-lease statement PDF (US-G4), lease amendments + renewal proposal with e-acceptance consent log (US-B8), deposit deductions with photo evidence (US-B6), CSV import + demo seed (US-I1/I2), audit trail (US-J1), PWA (design), and a single `NEXT_PUBLIC_SITE_URL` env var feeding canonical/OG/receipt/payment links (lessons-learned from the Evoq canonical-domain incident).

---

## 1. Introduction / Overview

A multi-org SaaS rental management platform for individual landlords in Kenya. Landlords manage properties, units, leases, and tenants; tenants pay rent via M-Pesa and track their lease from a self-service portal. Kenya-first: M-Pesa is the primary payment rail, KRA Monthly Rental Income (MRI) tax and eTIMS-style compliant receipts are built in from day one, and the Rent Restriction Act's controlled-tenancy rules are respected in the data model.

Two existing internal assets seed this build:

- **microrealestate** (open source, reference only — no code reused, license incompatible with commercial use) informed the landlord-portal / tenant-portal split and the lease→rent→receipt flow.
- **zoho-books-clone ("Zeno")** (`/Users/ianlove/workspaces/zoho-books-clone copy 2`) is a working, tested Kenya-compliant accounting app. Its M-Pesa integration, eTIMS receipt engine, double-entry ledger, SMS gateway, and Apple-HIG Tailwind design system are ported rather than rebuilt.

**Port discipline (new):** each ported module is copied with a header comment recording source repo + commit hash. Ported files are frozen for divergence except Kenyan-law fixes; shared logic is *not* extracted into a cross-repo package in v1 (simplicity beats DRY across repos).

## 2. Goals

- Landlords can onboard — including importing existing tenants/units from CSV or demo seed — and issue a first rent invoice in under 10 minutes.
- Tenants can pay rent via M-Pesa STK Push (public pay link, no login required), Paybill, or offline (cash/bank logged by landlord), and receive a QR-verifiable receipt automatically.
- Every financial event reconciles against a single append-only double-entry ledger — no manual bookkeeping drift, no double-posting on webhook retries.
- MRI tax is auto-calculated per landlord per month on **rent actually collected**, with correct statutory constants and a due-date reminder.
- Controlled tenancies are flagged with configurable thresholds and handled with distinct rules from market-rate leases.
- One visual design system (Zeno's Apple-HIG Tailwind system) across landlord and tenant portals.
- Multi-org data isolation enforced in the database (RLS), including the tenant-side access model.
- PII handling (national ID, phone) is Data Protection Act 2019-aware from day one.

## 3. Compliance & Legal Facts (single source of truth for product logic)

> All figures below belong in `src/lib/compliance/constants.ts` (per-org overridable). None may be hard-coded in components or business logic. Re-verify against KRA guidance **before launch and after every Finance Act**.

| Fact | Current position (Sep 2026) | Product handling |
|---|---|---|
| MRI rate | 7.5% of **gross rent collected**, monthly regime; Finance Act 2025 retained 7.5% (proposed 10% dropped) | `MRI_RATE_PCT = 7.5` configurable |
| MRI thresholds | Existing regime historically keyed on the ~KES 288,000 **monthly** gross rent; **draft RRI Regulations (22 Mar 2026)** propose **KES 288,000 annual (KES 24,000 monthly)** entry + upper cap (~KES 15M/yr cited) with normal income tax outside the band | Thresholds are **configurable + flagged "verify before filing"**; dashboard shows the basis used. Open question OQ-2. |
| MRI filing | Return + payment due by the **20th of the following month**; receipt/cash basis ("rent received in June declared by 20 July") | US-D2/D3/D4 built on collected basis, EAT timezone |
| eRITS / property registration | Draft regs point to property-level registration: KRA PIN, physical address, **LR number**, title docs, tenancy agreements, rent roll | US-B7 fields; US-D4 export; US-G3 rent roll |
| Controlled tenancy | Rent Restriction Act (1959) still in force; commonly applied cap ~KES 2,500/month; Landlord and Tenant Bill pending to replace it | `CONTROLLED_TENANCY_CAP_KES = 2500` configurable; termination/increase warnings (US-B5) |
| eTIMS receipts | Real OSCU/VSCU integration is a hard requirement before any production filing use; v1 ships a clearly-labelled simulated device (same caveat as Zeno) | US-D1; receipt watermark "SIMULATED — NOT FOR TAX USE" until real adapter |
| Data protection | Kenya DPA 2019: national ID/phone = personal data; consent, purpose limitation, correction/erasure, export rights | US-J2; ID docs in private storage with signed URLs |

**Liability guardrail:** every tax figure rendered in the UI carries a footnote: *"Computed from your records under the rules configured above; confirm current KRA rates before filing. Not tax advice."*

## 4. User Stories

Grouped by epic. Each story is scoped for one focused build session. Definition of done per story: typecheck **+ named unit tests pass** (Section 12). "Verify in browser" means the dev-browser skill walkthrough including the listed negative path.

### Epic A — Org, Auth & Onboarding

#### US-A1: Landlord signup and org creation
**Description:** As a new landlord, I want to sign up and create my organization so I can start managing properties.

**Acceptance Criteria:**
- [ ] Supabase Auth email/password + magic link signup; password policy enforced
- [ ] Signup creates an `orgs` row and links the user as `owner` role
- [ ] Captures landlord **KRA PIN (optional at signup, required before tax features)** and org display name
- [ ] Redirect to onboarding wizard on first login (property → unit → tenant → lease → import-or-demo, per Section 11 M1)
- [ ] Typecheck + auth unit tests pass
- [ ] Verify in browser using dev-browser skill

#### US-A2: Org-scoped data isolation (RLS)
**Description:** As the platform, I need every table scoped to `org_id` so one landlord never sees another's data.

**Acceptance Criteria:**
- [ ] RLS enabled on **every** table (policy file reviewed as part of each migration — CI check: no table without a policy)
- [ ] Tenant-portal users get separate policies keyed to `tenant_profiles.user_id` (see US-A5), never raw `org_id` membership
- [ ] Negative tests: second org cannot read/write first org's rows; tenant cannot read another tenant's lease; manager cannot read org billing settings
- [ ] Service-role key usable only server-side (no `NEXT_PUBLIC_*` exposure — lint rule)
- [ ] Typecheck passes

#### US-A3: Team members / staff accounts
**Description:** As a landlord, I want to invite a property manager/staff member to my org with limited permissions.

**Acceptance Criteria:**
- [ ] Invite-by-email flow, invited user joins org with role `manager`
- [ ] Invite tokens single-use, expiring; resend + revoke supported
- [ ] Manager permissions per US-A6 matrix
- [ ] Typecheck + invite-flow tests pass
- [ ] Verify in browser using dev-browser skill

#### US-A4: Tenant portal invite (no separate signup friction)
**Description:** As a landlord, I want to invite a tenant to their portal via a link/SMS so they don't need to "sign up" from scratch.

**Acceptance Criteria:**
- [ ] Token-based invite link (pattern from Zeno's `client-portal/auth.ts`), sent via SMS and email; **shareable via WhatsApp (wa.me deep link)**
- [ ] Tenant sets a password (or magic link) on first visit; token single-use, 7-day expiry, resendable
- [ ] Tenant account auto-linked to their `tenant_profiles` row (identity model per US-A5)
- [ ] Typecheck + tests pass
- [ ] Verify in browser using dev-browser skill

#### US-A5 (v2 new): Cross-org tenant identity
**Description:** As a tenant renting from two landlords (two orgs), I want one login to see all my leases, so the model must not assume tenant = org member.

**Acceptance Criteria:**
- [ ] `auth.users` = person; `tenant_profiles` rows are per-org, linked by phone/email claim to the same user id where matched
- [ ] Tenant portal aggregates leases across orgs; each org's data still isolated by RLS keyed on the tenant link
- [ ] Invite/claim flow can attach a new org's lease to an existing tenant login without a second account
- [ ] Test: user with leases in 2 orgs sees exactly both, and neither org's other tenants' rows
- [ ] Typecheck passes

#### US-A6 (v2 new): Role permission matrix
**Description:** As the platform, I need an explicit permission matrix so "manager can't do billing" is testable, not folklore.

**Acceptance Criteria:**
- [ ] Roles: `owner`, `manager`, `tenant`. Matrix table in `docs/PERMISSIONS.md` covering: org settings, billing/M-Pesa credentials, delete org, owner transfer, property/lease CRUD, payment entry, invoice void, reports, tenant invite, ticket close
- [ ] Enforced server-side (middleware/helpers) *and* hidden in UI; RLS remains the last line
- [ ] Owner transfer + member removal flows
- [ ] Unit tests for each role's deny path
- [ ] Typecheck passes

### Epic B — Properties, Units & Leases

#### US-B1: Property CRUD
**Description:** As a landlord, I want to add/edit/archive a property so I can organize units under it.

**Acceptance Criteria:**
- [ ] Property has name, address (GPS optional), type (residential/commercial/mixed), county, unit-count summary
- [ ] List, create, edit, archive (soft delete) views
- [ ] **Archive is blocked while any unit has an active lease** (offers "terminate leases first"); archive never cascades destructively
- [ ] Typecheck + tests pass
- [ ] Verify in browser using dev-browser skill

#### US-B2: Unit CRUD under a property
**Description:** As a landlord, I want to add units to a property so I can track each rentable space individually.

**Acceptance Criteria:**
- [ ] Unit has number, bedrooms, rent amount, status (vacant/occupied/maintenance), photos (optional, private storage)
- [ ] Uniqueness: unit number unique per property
- [ ] Archiving a unit with an active lease is blocked; soft delete only
- [ ] Bulk-add units ("1–20 flats") generator
- [ ] Typecheck + tests pass
- [ ] Verify in browser using dev-browser skill

#### US-B3: Tenant record
**Description:** As a landlord, I want to store tenant details so I can associate them with a lease.

**Acceptance Criteria:**
- [ ] Tenant has name, phone (M-Pesa-capable), email (optional), **ID/passport number (access-controlled field)**, employer/emergency contact, KRA PIN (optional)
- [ ] Phone validated/normalized to Kenyan format (reuse Zeno's `payments/phone.ts`)
- [ ] ID document image upload (optional) to private bucket, signed URLs, listed in DPA processing record (US-J2)
- [ ] Guarantor/co-tenant contact (name + phone) captured on the lease
- [ ] Typecheck + phone normalization property tests pass

#### US-B4: Lease creation
**Description:** As a landlord, I want to create a lease linking a tenant to a unit so rent tracking and billing can start.

**Acceptance Criteria:**
- [ ] Lease has start/end date (or month-to-month), rent amount, deposit, billing day-of-month, rent-increase note, attached lease document (PDF upload or generated from template)
- [ ] Lease auto-flagged `controlled_tenancy` when rent ≤ `CONTROLLED_TENANCY_CAP_KES` (configurable; see Section 3)
- [ ] Overlap guard: a unit cannot have two active leases; a billing day must be 1–28 (avoids month-length bugs)
- [ ] Creating a lease sets unit status to `occupied`
- [ ] Typecheck + date-logic tests pass (incl. Feb/31st edge cases)
- [ ] Verify in browser using dev-browser skill

#### US-B5: Lease renewal / termination
**Description:** As a landlord, I want to renew or terminate a lease so unit status and billing stay accurate.

**Acceptance Criteria:**
- [ ] Renew extends end date, keeps lease with renewal history entry; pro-rated invoices resolve correctly after renewal
- [ ] Terminate: sets unit `vacant` **only when no unbilled/terminal month is outstanding**, stops recurring generation, requires termination date + reason
- [ ] Controlled tenancies show a warning that termination/rent-increase may require Rent Restriction Tribunal approval
- [ ] Expiring-soon dashboard/reminder (60/30 days, org-configurable)
- [ ] Typecheck + state-machine tests pass
- [ ] Verify in browser using dev-browser skill

#### US-B6: Deposit tracking + refund workflow
**Description:** As a landlord, I want to track the security deposit separately from rent so it's not mistaken for income, and settle it cleanly at exit.

**Acceptance Criteria:**
- [ ] Deposit invoice (separate document type) receivable; deposit receipts post to a **liability** account, never income
- [ ] Termination workflow: refund amount, itemized deductions (each with description + photo/receipt evidence), net payout recorded
- [ ] Ledger: refund + deductions move the liability to zero; deduction amounts post to income/expense as appropriate
- [ ] Controlled tenancies: display deposit-cap guidance note (verify current cap before launch — OQ-3)
- [ ] Typecheck + ledger-balance tests pass

#### US-B7 (v2 new): Compliance fields (property & org)
**Description:** As a landlord, I want my property records to satisfy KRA/eRITS registration data requirements so filing is not a scavenger hunt.

**Acceptance Criteria:**
- [ ] Property: **LR number**, title deed/reference, unit count, construction/registration year (all optional-now, required-later)
- [ ] Org: KRA PIN, registered address, contact person
- [ ] Completeness meter on dashboard ("3 of 8 properties have LR numbers — needed for eRITS export")
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

#### US-B8 (v2 new): Rent increase & lease amendment
**Description:** As a landlord, I want to raise rent or amend lease terms mid-term with an auditable record, so new amounts bill correctly without losing history.

**Acceptance Criteria:**
- [ ] Amendment object: effective date, changed fields (rent, billing day, term), reason; previous values preserved
- [ ] Invoice generation uses rent **as of each billing period** (prorate where applicable)
- [ ] Tenant e-acceptance: tenant portal "review & accept" records consent (user id, timestamp, IP, document hash) as evidence log (IT Act 2021 electronic-record admissibility; not full e-signature)
- [ ] Controlled tenancies: banner that increases may be restricted/pending new law (Section 3)
- [ ] Typecheck + period-pricing tests pass

### Epic C — Rent Billing & M-Pesa Collection

#### US-C1: Recurring rent invoice generation
**Description:** As the platform, I need to auto-generate a rent invoice each month per active lease so tenants know what's due.

**Acceptance Criteria:**
- [ ] Cron generates invoice on lease billing day **evaluated in Africa/Nairobi** regardless of server timezone
- [ ] Idempotency: unique index `(lease_id, billing_period)`; retries never duplicate
- [ ] Invoice amount = lease rent for that period; editable for pro-rated first/last month; rounding rule: sen-level round-half-up, remainder absorbed on final line item
- [ ] Skips generation for terminated/parked leases; generates terminal pro-rated final invoice on mid-cycle termination
- [ ] Typecheck + property tests over 10 years of billing-day dates pass

#### US-C2: M-Pesa STK Push payment
**Description:** As a tenant, I want to pay rent from my phone via M-Pesa prompt so I don't need to visit an agent.

**Acceptance Criteria:**
- [ ] "Pay now" in tenant portal / pay link triggers Daraja STK Push (org credentials per US-C10)
- [ ] **Callback processing is idempotent** via `webhook_events` (unique `X-Request-ID`/`CheckoutRequestID`+result code); replayed callbacks post the ledger exactly once
- [ ] On success: invoice → paid (or partially paid, US-C7), ledger posted, receipt queued (US-D1), notification (US-F2)
- [ ] Pending callbacks: client polls checkout status; **if callback never arrives**, `queryPaymentStatus` (Daraja query API) reconciles within 15 min and marks unknown-for-review after 24 h
- [ ] Failed/cancelled/timeout states show retry with back-off (no STK flood; per-IP rate limit)
- [ ] Amount mismatch between callback and invoice → payment held for review, never auto-posted
- [ ] Typecheck + callback-replay/timeout tests (sandbox) pass
- [ ] Verify in browser using dev-browser skill (Safaricom sandbox creds)

#### US-C3: Paybill manual payment reconciliation
**Description:** As a landlord, I want manually-sent Paybill payments (account number = unit/lease ref) auto-matched to the right lease.

**Acceptance Criteria:**
- [ ] C2B confirmation webhook (verified per Daraja security: base64 auth check + timestamp freshness + **result code 0 only**) parses account number → matches lease (port `match.ts`, `ref-format.ts`)
- [ ] Invoice reference format carries an org-unique token (no cross-org collisions on shared ref spaces)
- [ ] Unmatched/over/mismatched amounts → "needs review" queue with one-click assign to lease/tenant
- [ ] Reversed/failed result codes logged, never posted
- [ ] Typecheck + matching tests pass

#### US-C4: Late fee rules
**Description:** As a landlord, I want to configure a late fee so overdue rent is automatically penalized.

**Acceptance Criteria:**
- [ ] Org-level: grace days, fee flat or %, max-cap optional; default OFF
- [ ] Applied once per invoice after grace (idempotent per invoice), posted as separate ledger line + visible as its own invoice line item
- [ ] Late-fee toggle per lease; controlled tenancies show advisory note
- [ ] Typecheck + once-only application tests pass

#### US-C5: Arrears / aging view
**Description:** As a landlord, I want to see which tenants are behind on rent so I can follow up.

**Acceptance Criteria:**
- [ ] Aging buckets current/30/60/90+ per tenant, per unit; reads from ledger (Zeno rule: never document totals)
- [ ] Drill-down to invoices and payments; exportable CSV
- [ ] Typecheck + ledger-vs-invoices reconciliation test pass
- [ ] Verify in browser using dev-browser skill

#### US-C6 (v2 new): Offline payment recording (cash/bank/other till)
**Description:** As a landlord or manager, I want to record a cash or bank rent payment so tenants who don't pay via M-Pesa still get receipts and accurate arrears.

**Acceptance Criteria:**
- [ ] Manual payment form: amount, method, date, reference note; posts to ledger, marks invoice paid/partial, generates receipt like any payment
- [ ] Edit/void of a manual payment creates reversal entries (append-only, never UPDATE/deleting rows silently); audit-logged (US-J1)
- [ ] Typecheck + reversal tests pass
- [ ] Verify in browser using dev-browser skill

#### US-C7 (v2 new): Partial payments, overpayments, credit balances, refunds
**Description:** As a tenant who under-pays or over-pays, I want the system to allocate money correctly so my balance is never a mystery.

**Acceptance Criteria:**
- [ ] `payment_allocations`: one payment → many invoices (oldest-first auto-allocation, manual re-alloc allowed)
- [ ] Overpayment → credit balance on lease, auto-applied to next invoice, visible in tenant portal
- [ ] Refund flow (M-Pesa B2C out of scope; record refund manually with reversal entries)
- [ ] Deposit vs rent allocation rules documented + enforced (credits never touch deposit liability)
- [ ] Typecheck + allocation property tests (sum of allocations = payment amount, integer cents) pass

#### US-C8 (v2 new): Multi-line invoices (rent + utilities)
**Description:** As a landlord who bills water/service charge/garbage, I want them on the same invoice with separate ledger treatment — this is how real Kenyan rentals bill.

**Acceptance Criteria:**
- [ ] Invoice line items: rent, water, service charge, garbage, other; each with account mapping (rent→rental income; utilities→pass-through income; deposit lines→liability)
- [ ] Lease-level recurring extras setup; one-off lines editable on the invoice before payment
- [ ] Receipts and MRI gross-rent basis reflect the correct subset (MRI = gross **rent**; utility treatment flagged OQ-4)
- [ ] Typecheck + per-line ledger mapping tests pass
- [ ] Verify in browser using dev-browser skill

#### US-C9 (v2 new): Reconciliation safety net
**Description:** As the platform, I must catch every payment even when webhooks die, so no rent is ever silently lost.

**Acceptance Criteria:**
- [ ] `webhook_events` persists every raw callback (idempotency + audit + replay tool)
- [ ] Daily job: list-day Daraja query (STK + C2B) vs ledger postings → flags missing/extra; landlord-visible "unreconciled" badge + admin report
- [ ] Replay command to re-process a webhook event from stored payload
- [ ] Typecheck + simulated-loss test pass

#### US-C10 (v2 new): Per-org M-Pesa credential connection + sandbox mode
**Description:** As a landlord, I want to connect my own Safaricom paybill/till via Daraja so rent lands in my account, not the platform's (which would make us an unlicensed payment aggregator).

**Acceptance Criteria:**
- [ ] Org settings: shortcode type (paybill/till), shortcode, account number, Daraja consumer key/secret, env toggle **sandbox ↔ live** (per-org, clearly labelled)
- [ ] Secrets encrypted at rest (Supabase Vault/pgcrypto or env-scoped per-org store), never shown after save
- [ ] Connection test button (token fetch + sandbox validation)
- [ ] Platform-provided paybill + payout model explicitly deferred (Non-Goal; OQ-5)
- [ ] No credentials in logs/error traces (test)
- [ ] Typecheck + secret-hygiene tests pass
- [ ] Verify in browser using dev-browser skill

### Epic D — Receipts & Tax Compliance

#### US-D1: eTIMS-style compliant rent receipt
**Description:** As a tenant, I want an official receipt after paying rent so I have proof of payment.

**Acceptance Criteria:**
- [ ] Receipt generated on payment confirmation (port `etims.ts` `TaxDevice` interface + `receipts/`)
- [ ] QR-coded, verifiable receipt (port `receipts/qr.ts`, `scan.ts`, `tokens.ts`); QR verification URL built from **`NEXT_PUBLIC_SITE_URL`** only
- [ ] Simulated/demo device until real OSCU/VSCU adapter: receipt watermarked **"SIMULATED TAX DEVICE — NOT FOR KRA FILING"** (no silent "real" claims; tech consideration retained)
- [ ] Receipt shows: landlord name + KRA PIN (if captured), tenant, unit, period, line items, M-Pesa reference
- [ ] Typecheck + tests pass
- [ ] Verify in browser using dev-browser skill

#### US-D2: MRI tax auto-calculation
**Description:** As a landlord, I want Monthly Rental Income tax calculated automatically so I don't miscalculate KRA obligations.

**Acceptance Criteria:**
- [ ] `mri-tax.ts` (template: Zeno's `tax.ts` — pure function, integer cents) using constants from `compliance/constants.ts` (Section 3) — **no hard-coded 7.5/288,000 in code**
- [ ] Basis: **gross rent collected** in the month (cash basis), by payment posting date in EAT
- [ ] Threshold logic per configured regime display (rate, entry threshold, upper cap) with "verify current rules" flag
- [ ] Controlled tenancies handled per configured rules; late-fee inclusion in gross follows OQ-4 decision
- [ ] Golden-file tests: 100+ cases incl. thresholds, multi-org aggregation; 100% match vs manual calc
- [ ] Typecheck passes

#### US-D3: MRI tax due-date reminder
**Description:** As a landlord, I want a reminder before the 20th so I don't miss my MRI filing.

**Acceptance Criteria:**
- [ ] Email + SMS N days (default 3, **evaluated in EAT**) before the 20th of the month *following* collection month, **only when tax owed > 0**
- [ ] Reminder states the exact period + amount computed
- [ ] Dismissible per-month, re-surfaces next cycle
- [ ] Typecheck + due-date boundary tests (EAT vs UTC) pass

#### US-D4 (v2 rewrite): eRITS-ready export
**Description:** As a landlord, I want an export that satisfies eRITS/rental-reg data requirements so filing is upload-ready, not guesswork.

**Acceptance Criteria:**
- [ ] Rent roll export (US-G3) enriched with per-property compliance data: LR number, title ref, address, tenant + PIN, period gross rent, tax due
- [ ] CSV (machine import) + PDF (human) formats
- [ ] Missing-field validation report ("cannot export: 2 properties lack LR numbers")
- [ ] Typecheck + export-schema snapshot tests pass

#### US-D5 (v2 new): Monthly tax summary document
**Description:** As a landlord, I want one PDF per month summarizing collections, line-item breakdown, deposits moved, MRI figure, and M-Pesa references — attachable to a filing or accountant's email.

**Acceptance Criteria:**
- [ ] Generated from ledger only; totals reconcile with US-C5 aging and US-D2 figure
- [ ] Downloadable + emailable
- [ ] Typecheck + reconciliation test pass

### Epic E — Maintenance

#### US-E1: Tenant maintenance request
**Description:** As a tenant, I want to submit a maintenance request with photos so my landlord knows about the issue.

**Acceptance Criteria:**
- [ ] Form: category, description, photo upload (private Supabase Storage; ≤5 photos, ≤10 MB each, type-validated, client-resized)
- [ ] Creates `maintenance_tickets` row linked to unit/lease, status `open`; tenant sees status
- [ ] Typecheck + upload-policy tests pass
- [ ] Verify in browser using dev-browser skill

#### US-E2: Landlord maintenance pipeline
**Description:** As a landlord, I want to track maintenance tickets through a status pipeline so nothing gets lost.

**Acceptance Criteria:**
- [ ] Statuses: open → assigned → in_progress → resolved → closed; transitions logged with actor
- [ ] Assign to vendor (contact record, no vendor login in v1); tenant notified on resolution
- [ ] SLA timer per category (display only in v1)
- [ ] Typecheck + transition tests pass
- [ ] Verify in browser using dev-browser skill

#### US-E3: Maintenance cost tracking
**Description:** As a landlord, I want maintenance costs posted to the ledger against the right property so my P&L is accurate.

**Acceptance Criteria:**
- [ ] Closing a ticket with cost posts expense journal entry (ported `posting.ts` pattern) tagged to property/unit + ticket
- [ ] Expense vs billable-to-tenant flag (charge-back creates invoice line via US-C8)
- [ ] Typecheck + mapping tests pass

### Epic F — Notifications

#### US-F1: SMS rent reminders
**Description:** As a tenant, I want an SMS reminder before rent is due so I don't get a late fee.

**Acceptance Criteria:**
- [ ] SMS N days before due (org-configurable) via ported `sms/advanta.ts`; includes amount, unit, **short pay link** (US-H3)
- [ ] Send-once-per-invoice-per-stage guard (no duplicate spam on cron retry)
- [ ] Every send logged in `notification_log` (status, gateway id, failure reason); failures fall back to email
- [ ] Typecheck + dedupe tests pass

#### US-F2: Payment confirmation notification
**Description:** As a tenant, I want an SMS/email confirming my payment went through.

**Acceptance Criteria:**
- [ ] Triggered on payment post-to-ledger (not raw callback) — works for M-Pesa and offline payments
- [ ] Includes receipt link + resulting balance/credit
- [ ] Typecheck + tests pass

#### US-F3 (v2 new): Reminder escalation ladder
**Description:** As a landlord, I want overdue follow-ups automated on a schedule so chasing rent isn't manual labor.

**Acceptance Criteria:**
- [ ] Configurable ladder, e.g. D-3 due → D+1 → D+7 → D+14, each with own SMS/email template, tone escalating; per-lease opt-out
- [ ] Ladder respects US-C7 allocations (paid-in-full invoices stop the ladder)
- [ ] Org-level SMS cost cap + kill switch; monthly send-count/cost summary visible
- [ ] Typecheck + ladder state tests pass
- [ ] Verify in browser using dev-browser skill

#### US-F4 (v2 new): Share-to-WhatsApp for receipts & statements
**Description:** As a tenant, I want to send my receipt to my landlord/employer/bank on WhatsApp — Kenya's default proof-of-payment channel.

**Acceptance Criteria:**
- [ ] Every receipt/statement has "Copy link" + "Share on WhatsApp" (wa.me deep link with canonical short URL)
- [ ] Shared link is tokened, read-only, revocable, served from `NEXT_PUBLIC_SITE_URL`
- [ ] Typecheck + token tests pass

### Epic G — Reporting

#### US-G1: Landlord dashboard
**Description:** As a landlord, I want a home dashboard showing rent collected, arrears, and vacancies at a glance.

**Acceptance Criteria:**
- [ ] Cards: rent collected this month, total arrears, vacant units, MRI tax due + **collection rate %**, expiring leases (B5), unreconciled-payments badge (C9), compliance completeness meter (B7)
- [ ] Reads from ledger (never cached document totals)
- [ ] Typecheck + tests pass
- [ ] Verify in browser using dev-browser skill

#### US-G2: Per-property P&L
**Description:** As a landlord, I want income/expenses per property so I know which properties are profitable.

**Acceptance Criteria:**
- [ ] P&L by property/unit, date-range filterable, line-item classes (rent vs utilities vs expenses), CSV export
- [ ] Vacancy-loss line (expected rent of vacant units) for true economic view
- [ ] Typecheck + tests pass
- [ ] Verify in browser using dev-browser skill

#### US-G3 (v2 new): Rent roll
**Description:** As a landlord (or accountant/KRA), I want a rent roll: every unit, tenant, current rent, arrears, lease end — one table, exportable.

**Acceptance Criteria:**
- [ ] Rent roll from ledger + leases; filters by property/status; CSV + PDF; feeds US-D4
- [ ] Typecheck + snapshot tests pass
- [ ] Verify in browser using dev-browser skill

#### US-G4 (v2 new): Tenant statement of account
**Description:** As a tenant, I want a PDF statement of my full lease history (charges, payments, balance) for banks, sponsors, or disputes.

**Acceptance Criteria:**
- [ ] Statement from ledger, period-selectable, QR-verifiable link, share-to-WhatsApp (F4)
- [ ] Typecheck + tests pass

### Epic H — Tenant Portal

#### US-H1: Tenant dashboard
**Description:** As a tenant, I want to see my lease, current balance, and payment history in one place.

**Acceptance Criteria:**
- [ ] Lease terms, next due date/amount, balance incl. credit, last 12 months payments, receipt links, maintenance entry point
- [ ] Multi-org aware (US-A5: shows all my leases)
- [ ] Mobile-first (≥95% of tenant traffic assumed phones); works on 3G-class networks (bundle budget)
- [ ] Typecheck + tests pass
- [ ] Verify in browser using dev-browser skill

#### US-H2: Tenant receipt/document access
**Description:** As a tenant, I want to download all my past receipts and my lease document.

**Acceptance Criteria:**
- [ ] Receipt list w/ PDF download; lease + amendments viewable/downloadable
- [ ] Typecheck + tests pass
- [ ] Verify in browser using dev-browser skill

#### US-H3 (v2 new): Public pay link (no login)
**Description:** As a tenant, I want a link from my SMS/WhatsApp that lets me pay immediately without creating an account.

**Acceptance Criteria:**
- [ ] `/pay/[token]`: signed, expiring, single-lease token; shows amount + pay via STK; usable without auth
- [ ] Post-pay: receipt page + "create account" upsell that claims existing records (US-A5 link)
- [ ] Abuse guards: rate limits, token rotation per invoice, no enumeration (tokens carry no sequential info)
- [ ] Typecheck + token security tests pass
- [ ] Verify in browser using dev-browser skill

### Epic I — Onboarding Data (v2 new)

#### US-I1: CSV import
**Description:** As a landlord with 30 tenants on a spreadsheet, I want to import properties/units/tenants/leases so onboarding takes minutes, not evenings.

**Acceptance Criteria:**
- [ ] Templates downloadable; dry-run validation report (row errors, duplicates, opening balances/arrears handling)
- [ ] Imports post opening balances to ledger correctly (arrears as starting receivables, deposits as liability — never "income")
- [ ] Idempotent re-import (dedupe by unit+tenant+period)
- [ ] Typecheck + validator tests pass
- [ ] Verify in browser using dev-browser skill

#### US-I2: Demo seed
**Description:** As a new landlord or evaluator, I want one-click demo data so I can see the flow before committing my real data.

**Acceptance Criteria:**
- [ ] Seeded org with 2 properties, mixed controlled/market leases, payments, tickets; clearly badged DEMO; export/wipe-able
- [ ] Typecheck + seed idempotency test pass

### Epic J — Trust, Safety & Platform Ops (v2 new)

#### US-J1: Audit trail
**Description:** As the platform, I need an append-only record of who changed what (rent, invoices voided, payments edited, role changes) so disputes are answerable.

**Acceptance Criteria:**
- [ ] `audit_logs` (actor, role, org, action, entity, before/after summary, IP); covers all financial mutations + permission changes
- [ ] Visible to owner per org; retention aligned with DPA (US-J2)
- [ ] Typecheck + coverage test (mutation helpers emit audit events) pass

#### US-J2: Data Protection Act compliance
**Description:** As a tenant/citizen, my national ID and phone must be handled lawfully: consent, purpose limit, access, correction, erasure/export.

**Acceptance Criteria:**
- [ ] Processing record for each PII field (who collects, purpose, retention); landlord is controller, platform is processor — reflected in ToS text
- [ ] Tenant self-service: view own data, request correction, account export (JSON), deletion request workflow (ledger-preserving: anonymize, don't destroy financial records — tax retention rules win over erasure, documented)
- [ ] ID-documents bucket: private, signed URLs only, 90-day default retention configurable
- [ ] Typecheck + data-rights tests pass

#### US-J3: Minimal platform admin console
**Description:** As the platform operator, I need to list orgs, see usage (SMS credits, payments volume), suspend abuse, and impersonate-with-consent for support.

**Acceptance Criteria:**
- [ ] Separate auth realm (platform staff role, not org membership); every action audit-logged (J1)
- [ ] No silent impersonation: time-boxed, banner shown, consent flag for support sessions
- [ ] Typecheck + authz tests pass

## 5. Functional Requirements

1. Multi-org with RLS-enforced isolation (Supabase Auth + Postgres RLS); every table has a policy (CI-checked).
2. Roles `owner`/`manager`/`tenant` with an explicit, server-enforced permission matrix (US-A6).
2a. A natural person may be a tenant in multiple orgs under one login (US-A5).
3. Property and unit CRUD with soft delete and active-lease archive guards.
4. Lease creation linking tenant↔unit capturing rent, deposit, term, billing day (1–28), compliance flags.
5. Configurable controlled-tenancy flagging (`CONTROLLED_TENANCY_CAP_KES`) with tribunal warnings on termination/increase.
6. Idempotent monthly rent invoice generation on billing day, evaluated in **Africa/Nairobi**, unique per `(lease_id, billing_period)`.
6a. Invoices support line items (rent, water, service charge, other) with per-line ledger mapping.
7. Tenant-initiated M-Pesa STK Push from portal and from **public pay links**, using **per-org Daraja credentials**.
8. C2B/Paybill confirmation webhooks auto-matching via org-unique account references; unmatched → review queue.
8a. Money collects into the **landlord's own** paybill/till in v1; platform-collect + payout is a non-goal (OQ-5).
9. Webhook handling is idempotent, verified, persisted (`webhook_events`), replayable, and reconciled daily against Daraja query results.
10. Partial payments, overpayments (credit balances), allocation, reversals/refunds supported with append-only corrections.
11. Offline (cash/bank) payment recording with the same receipt + ledger treatment as M-Pesa.
12. Every financial event posts to one append-only double-entry ledger; all reports read from the ledger, never document caches.
13. QR-verifiable receipt on payment confirmation; simulated-device watermarks until real eTIMS adapter.
14. MRI calculated on gross rent **collected** (EAT basis) via `compliance/constants.ts`; figures rendered with not-tax-advice disclaimers.
15. MRI due-date reminders (email + SMS) only when owed, due-date logic in EAT.
16. eRITS-oriented export: rent roll + per-property compliance fields (LR number, title ref, tenant PIN) in CSV/PDF with completeness validation.
17. Maintenance requests with capped photo uploads; status pipeline with actor-logged transitions; cost posting with billable flag.
18. SMS reminders with per-invoice-per-stage dedupe, delivery logging, email fallback, org cost caps, and escalation ladder.
19. Landlord dashboard incl. collection rate, arrears, vacancies, tax due, unreconciled payments, compliance meter.
20. Per-property P&L with vacancy loss; rent roll; tenant statements; monthly tax summary PDF.
21. Tenant portal: multi-org aware dashboard, receipts/lease access, share-to-WhatsApp, public pay links with abuse guards.
22. CSV import with dry-run + idempotency; demo seed.
23. Append-only audit log for financial and permission mutations.
24. DPA 2019 data-rights workflows (view/correct/export/erasure-with-retention-rules).
25. Platform admin console with staff-only auth and logged, consent-bannered impersonation.
26. One shared design system across portals; all public URLs derive from `NEXT_PUBLIC_SITE_URL`.

## 6. Non-Functional Requirements (v2 new)

- **NFR-1 Correctness:** ledger debits==credits invariant test on every posting path; integer cents everywhere; no float money.
- **NFR-2 Security:** server-only secrets (lint-enforced), encrypted per-org Daraja credentials, webhook signature/token verification, rate limits on auth/pay/STS endpoints, private buckets + signed URLs for PII, RLS as final line.
- **NFR-3 Idempotency:** every cron, webhook, and notification path is retry-safe.
- **NFR-4 Timezone:** store UTC, present and schedule in Africa/Nairobi; no `NOW()`-without-zone in money logic.
- **NFR-5 Performance:** pages < 200k initial JS budget on tenant flows; lists paginated/RLS-indexed; 500-unit landlords don't degrade dashboards (> p95 < 1s server).
- **NFR-6 Observability:** structured logs with request ids, Sentry (or similar) in webhooks/cron, daily reconciliation report, uptime-visible status for payment ingestion lag.
- **NFR-7 Availability/DR:** nightly DB backups with tested restore; M-Pesa downtime UX (queued retries, "pay later" guidance); app state safe if SMS gateway is down.
- **NFR-8 Usability:** tenant portal one-thumb usable; ≥AA contrast; English+Swahili copy slots (strings centralized) — Swahili out-of-scope-for-v1 optional.
- **NFR-9 Environments:** dev (Safaricom sandbox) / staging / prod separated credentials; seed script per env.

## 7. Data Model (key entities & invariants) (v2 new)

`orgs` (KRA PIN, site branding, compliance constants overrides) · `org_members` (user↔org, role) · `tenant_profiles` (org-scoped person, linked to auth user where claimed; ID/PIN fields access-controlled) · `properties` (county, **LR number**, title ref) · `units` (rent, status, photos) · `leases` (tenant, unit, dates, billing day 1–28, controlled flag, deposit, guarantor) · `lease_amendments` (effective-dated changes, consent log) · `invoices` + `invoice_lines` (multi-line, unique `(lease_id, billing_period)` per rent line) · `payments` + `payment_allocations` · `journal_entries` + `journal_lines` (append-only double-entry; `voided_by` self-reference for reversals) · `receipts` · `deposits` (liability subledger views derived from ledger) · `maintenance_tickets` + attachments · `vendors` · `webhook_events` (raw payload, processed state, unique external id) · `notification_log` · `audit_logs` · `mpesa_credentials_per_org` (encrypted) · `org_settings` (late fee, reminders, caps).

**Invariants (test-enforced):** debits==credits per entry; payment allocations sum to payment; invoice balance = lines − allocations; deposit liability never touches income; controlled flag derived, never hand-edited; soft deletes only; `org_id` on every row.

## 8. Non-Goals (Out of Scope for v1)

- Platform paybill + payout-to-landlord / agency owner portal (needs payment-business licensing review — OQ-5)
- Vendor/contractor self-service portal
- Real eTIMS OSCU/VSCU hardware integration (simulated device only, watermarked)
- Multi-currency; payroll/staff time; CRM pipeline; marketplace/listings (a lightweight shareable vacancy flyer is a *stretch* v1.1 item, not v1)
- Automated tenant screening/credit checks (v2 integration candidate)
- M-Pesa B2C auto-refunds (manual recorded refunds only)
- Native mobile apps (responsive web + PWA manifest)
- Swahili localization (string infrastructure only)
- microrealestate code reuse of any kind (license incompatible)

## 9. Design Considerations

- Single design system: Zeno's Apple-HIG Tailwind components (see `docs/DESIGN.md` in `zoho-books-clone copy 2`) across both portals.
- Landlord portal: dense, data-forward tables/dashboards. Tenant portal: simpler, **mobile-first, one-thumb, fast on 3G**.
- PWA: installable tenant portal (manifest + offline shell showing last-known balance).
- KES displayed as `KES 12,500.00`; integer cents internally.
- **Single URL source:** `NEXT_PUBLIC_SITE_URL` feeds canonical tags, `og:*`/WhatsApp preview images, receipt verification links, and pay links. One env var, used everywhere — an incorrect/stale value here breaks link previews and every shared URL (known failure mode from the Evoq audit; treat as a release checklist item per env).
- Receipt/statement PDFs: printable A5-friendly, QR + watermark zones.

## 10. Technical Considerations

- **Frontend:** Next.js 16 (App Router, Turbopack), built fresh — no code ported from microrealestate.
- **Backend/DB/Auth:** Supabase (Postgres + Auth + Storage + Edge Functions).
- **ORM:** Drizzle over Supabase Postgres (chosen so Zeno's `posting.ts`/`tax.ts`-pattern modules port cleanly). Migrations via `drizzle-kit`, every migration reviewed for RLS policy coverage (CI check).
- **Ported modules (frozen w/ source hash):** `mpesaDaraja.ts`, `match.ts`, `ref-format.ts`, `phone.ts`, `etims.ts`, `receipts/*`, `sms/advanta.ts`, `posting.ts`; `client-portal/auth.ts` evaluated vs Supabase invites — keep the leaner.
- **New modules:** `compliance/constants.ts`, `mri-tax.ts`, rental schema + controlled-tenancy logic, allocations, reconciliation, audit hooks.
- **Scheduler (decide at M0 — blocker for C1/D3/F1/F3):** recommended default **Supabase Edge Function + pg_cron** (hosting-independent, EAT-safe with explicit timezone args); Vercel Cron acceptable only if hosting = Vercel and schedule math still runs in EAT.
- **Env vars (documented in `.env.example`, validated at boot with zod):** Supabase URL/keys, `NEXT_PUBLIC_SITE_URL`, Advanta SMS keys, Sentry DSN, admin bootstrap creds, per-org Daraja secrets (DB-encrypted, not env).
- **eTIMS caveat:** simulated control unit until real OSCU/VSCU adapter; must not ship silently as "real" eTIMS; watermarks per US-D1.
- **Testing:** vitest; golden-file tests for tax/receipts; sandbox (Daraja sandbox + recorded webhook fixtures) for payments; Playwright happy-path per portal.

## 11. Build Order & Milestones (v2 new — tuned for Claude Code sessions)

- **M0 — Skeleton:** repo, env validation, Supabase project, Drizzle baseline migration of Section 7, CI (typecheck+tests+RLS coverage), Sentry, design-system port. *Decision gate: scheduler + hosting.*
- **M1 — Landlord core:** Epic A + Epic B + US-I2 demo seed (portal usable without payments).
- **M2 — Money in:** Epic C (C1→C10 in dependency order: idempotent invoices → per-org creds → STK+reconcile → C2B match → partials/offline).
- **M3 — Compliance:** Epic D (needs C's ledger postings).
- **M4 — Tenant surface:** Epic H (incl. pay links) + Epic F.
- **M5 — Operations:** Epic E, Epic G, Epic I, Epic J.
- Dependencies worth honoring: D and G cannot start before C's ledger postings exist; F needs B's lease/invoice data; J1 audit hooks land with M2 (retrofitting is worse).

## 12. Vibe-Coding Conventions & Guardrails (v2 new — feed to Claude Code as standing rules)

- Money = integer cents, always. No floats, no `parseFloat` on currency strings.
- Timezone: UTC storage, EAT presentation/scheduling; every cron job takes an explicit date arg (re-runnable for a given day).
- Every story lands with: migration (if schema touched, incl. RLS policy), unit tests for named logic paths, at least one **negative test** for money/permission stories, and the story's browser walkthrough.
- Append-only law: financial mutations are reversals, never UPDATE/DELETE of postings; audit-log every mutation.
- Public URLs only from `NEXT_PUBLIC_SITE_URL`; no hard-coded domains in components or templates.
- Secret hygiene: service-role key server-only; Daraja secrets encrypted per-org; no secrets in logs (CI grep check).
- Ported Zeno modules: no feature edits in-place — wrap/extend in new modules; divergence requires a note in `docs/PORTED.md`.
- Commit per story; PR body links story IDs.

## 13. Success Metrics

- Signup → first invoiced lease (with CSV import or seed) < 10 minutes.
- ≥ 95% of M-Pesa payments auto-reconcile without manual review; **≥ 99.9% of confirmed payments land in the ledger within 24 h** (lost-callback recovery proof via US-C9).
- Zero ledger/report drift (invariant tests green); zero double-postings in sandbox replay suite.
- MRI figure matches manual calculation 100% of golden cases before any filing use.
- STK completion rate (success/triggered) tracked; tenant pay-link → paid conversion visible on dashboard.
- Time-to-first-payment per new org; CSV import success rate without support touch.
- Maintenance median resolution time; SMS delivery rate; arrears trend per cohort.

## 14. Risks & Mitigations (v2 new)

| Risk | Impact | Mitigation |
|---|---|---|
| RRI regulations finalize differently from assumptions (rates/thresholds/registration duties) | Tax feature misleading | All constants in `compliance/constants.ts`; "verify before filing" UX; OQ-1/OQ-2 review each Finance Act |
| Landlord mis-sets MRI basis (e.g., counts deposits/late fees) | Under/over-taxed | Basis locked to collected **rent** lines; OQ-4 decision; D5 summary shows derivation |
| Webhook loss/duplication | Lost or double revenue | US-C9 idempotency + daily recon + replay tool |
| Platform paybill temptation for easy onboarding | Regulatory exposure | Explicit non-goal; OQ-5 gated by licensing review |
| PII breach (IDs, phones) | DPA liability, trust collapse | Private buckets, signed URLs, field-level access rules, J2 workflows, no PII in logs |
| Zeno port divergence (two repos edit same money logic) | Silent law bugs | Freeze + hash headers, `PORTED.md`, Kenyan-law fixes only |
| Controlled-tenancy law replaced (Landlord & Tenant Bill) | Wrong warnings | Constant + copy centralized; watch list in OQ-3 |
| SMS costs unbounded on reminders/escalation | Margin burn | Org caps, kill switches, monthly cost summary |

## 15. Open Questions

- **OQ-1 Monetization** (from v1): still deferred — but schema note: `org_settings.plan` stub + usage counters (SMS units, org count) now cost almost nothing and make pricing retrofit-free. Decide before US-J3 ships.
- **OQ-2 Current MRI thresholds/rates** (monthly vs annual basis, 15M cap, whether the ~KES 288,000 figure applies monthly or annually *today*): get a one-page opinion from a Kenyan tax practitioner before M3; encode their answer into `constants.ts` with a review date.
- **OQ-3 Controlled tenancy + deposit caps:** confirm current deposit cap wording and track Landlord and Tenant Bill status; decide warning copy with counsel.
- **OQ-4 Gross-rent definition:** are late fees, water/service charge, and tenant-billed recoveries in or out of the MRI gross figure? (Affects US-C8/D2 mappings.)
- **OQ-5 Payout model:** does a platform-paybill + weekly-transfer feature eventually become a differentiator? If yes, start licensing research early (CBK/payment-service rules) — until then v1 stays landlord-paybill.
- **OQ-6 eTIMS real-device vendor** + whether eTIMS invoice obligations formally extend to MRI landlords in 2026 (verify current KRA invoice rules) — gates retiring the "SIMULATED" watermark.
- **OQ-7 Scheduler/hosting final choice** — must close at M0 (blocks C1, D3, F1, F3).
- **OQ-8 Deposit dispute flow** (v1 open question kept): partial deductions + tenant objection path needs definition before US-B6 builds — spec'd as itemized-with-evidence + status, disputes logged as tickets.
- **OQ-9 Owner-portal schema readiness** (v1): v2 stance — reserve `property_owners`/`ownership_pct` columns now (nullable), no UI; cheap insurance against rewrite.
- **OQ-10 Tenant screening** v2 in-house vs third-party API — unchanged.

## 16. References (verify before launch; law changes)

- KRA — Residential Rental Income (MRI) portal page: https://www.kra.go.ke/individual/filing-paying/types-of-taxes/residential-rental-income
- Residential Rental Income Rules in Kenya (2026) — incl. 22 Mar 2026 draft RRI Regulations summary: https://globallawexperts.com/kenya-residential-rental-income-rules-2026/
- Draft rules ending voluntary rental regime coverage: https://kenyanwallstreet.com/kra-landlords-tax-register
- Rent Restriction Act (Cap 304) — controlled tenancies: https://new.kenyalaw.org/akn/ke/act/1959/35
- Rent control explainer (KES 2,500 cap, Act still in force): https://articles.mkodisha.com/articles/rent-control-policies-what-landlords-need-to-know-uk-vs-kenya-dc0cd159
- Landlord and Tenant Bill 2021 (pending replacement): https://www.parliament.go.ke/sites/default/files/2022-01/The%20Landlord%20and%20Tenant%20Bill,%202021.pdf
