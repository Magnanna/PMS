# PRD: Kenya Rental Management System (working name: TBD)

## 1. Introduction/Overview

A multi-org SaaS rental management platform for individual landlords in Kenya. Landlords manage properties, units, leases, and tenants; tenants pay rent via M-Pesa and track their lease from a self-service portal. The system is Kenya-first: M-Pesa is the primary payment rail, KRA Monthly Rental Income (MRI) tax and eTIMS-compliant receipts are built in from day one, and the Rent Restriction Act's controlled-tenancy rules are respected in the data model.

Two existing internal assets seed this build:
- **microrealestate** (open source, reference only — no code reused, license incompatible with commercial use) informed the landlord-portal / tenant-portal split and the lease→rent→receipt flow.
- **zoho-books-clone ("Zeno")** (`/Users/ianlove/workspaces/zoho-books-clone copy 2`) is a working, tested Kenya-compliant accounting app. Its M-Pesa integration, eTIMS receipt engine, double-entry ledger, SMS gateway, and Apple-HIG Tailwind design system are ported into this project rather than rebuilt.

## 2. Goals

- Landlords can onboard, add properties/units, and create leases in under 10 minutes.
- Tenants can pay rent via M-Pesa STK Push (or Paybill manual entry) and receive an eTIMS-compliant receipt automatically.
- Every rent payment reconciles against a double-entry ledger — no manual bookkeeping drift.
- MRI tax (7.5% of gross rent) is auto-calculated per landlord per month, with a due-date reminder.
- Controlled tenancies (rent ≤ KES 2,500/mo, Rent Restriction Act) are flagged and handled with different rules from market-rate leases.
- One visual design system (Zeno's Apple-HIG Tailwind system) across admin/landlord portal and tenant portal.
- Multi-org data isolation: one landlord's data is never visible to another.

## 3. User Stories

Grouped by epic. Each story is scoped for one focused build session.

### Epic A — Org, Auth & Onboarding

#### US-A1: Landlord signup and org creation
**Description:** As a new landlord, I want to sign up and create my organization so I can start managing properties.

**Acceptance Criteria:**
- [ ] Supabase Auth email/password + magic link signup
- [ ] Signup creates an `orgs` row and links the user as `owner` role
- [ ] Redirect to onboarding wizard on first login
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

#### US-A2: Org-scoped data isolation (RLS)
**Description:** As the platform, I need every table scoped to `org_id` so one landlord never sees another's data.

**Acceptance Criteria:**
- [ ] Supabase Row Level Security policies on every org-scoped table (properties, units, leases, tenants, payments, maintenance_tickets, etc.)
- [ ] Policy denies cross-org reads/writes, verified with a negative test (second org cannot fetch first org's rows)
- [ ] Typecheck passes

#### US-A3: Team members / staff accounts
**Description:** As a landlord, I want to invite a property manager/staff member to my org with limited permissions.

**Acceptance Criteria:**
- [ ] Invite-by-email flow, invited user joins org with role `manager` (not `owner`)
- [ ] Manager role can manage properties/leases/payments but not billing or delete the org
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

#### US-A4: Tenant portal invite (no separate signup friction)
**Description:** As a landlord, I want to invite a tenant to their portal via a link/SMS so they don't need to "sign up" from scratch.

**Acceptance Criteria:**
- [ ] Token-based invite link (pattern from Zeno's `client-portal/auth.ts`), sent via SMS and email
- [ ] Tenant sets a password (or uses magic link) on first visit, token single-use and expiring
- [ ] Tenant account auto-linked to their existing lease record
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### Epic B — Properties, Units & Leases

#### US-B1: Property CRUD
**Description:** As a landlord, I want to add/edit/archive a property so I can organize units under it.

**Acceptance Criteria:**
- [ ] Property has name, address, type (residential/commercial), county
- [ ] List, create, edit, archive (soft delete) views
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

#### US-B2: Unit CRUD under a property
**Description:** As a landlord, I want to add units to a property so I can track each rentable space individually.

**Acceptance Criteria:**
- [ ] Unit has unit number, bedrooms, rent amount, status (vacant/occupied/maintenance)
- [ ] Belongs to a property, cascades on property archive
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

#### US-B3: Tenant record
**Description:** As a landlord, I want to store tenant details so I can associate them with a lease.

**Acceptance Criteria:**
- [ ] Tenant has name, phone (M-Pesa-capable), email (optional), national ID, emergency contact
- [ ] Phone number validated/normalized to Kenyan format (reuse Zeno's `payments/phone.ts`)
- [ ] Typecheck passes

#### US-B4: Lease creation
**Description:** As a landlord, I want to create a lease linking a tenant to a unit so rent tracking and billing can start.

**Acceptance Criteria:**
- [ ] Lease has start date, end date (or month-to-month), rent amount, deposit amount, billing day-of-month
- [ ] Lease auto-flagged `controlled_tenancy = true` when rent ≤ KES 2,500/mo (Rent Restriction Act)
- [ ] Creating a lease sets the unit status to `occupied`
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

#### US-B5: Lease renewal / termination
**Description:** As a landlord, I want to renew or terminate a lease so unit status and billing stay accurate.

**Acceptance Criteria:**
- [ ] Renew extends end date, keeps same lease record with renewal history entry
- [ ] Terminate sets unit status back to `vacant`, stops recurring rent generation
- [ ] Controlled tenancies show a warning that termination/rent-increase may require Rent Restriction Tribunal approval
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

#### US-B6: Deposit tracking
**Description:** As a landlord, I want to track the security deposit separately from rent so it's not mistaken for income.

**Acceptance Criteria:**
- [ ] Deposit posted to a liability account in the ledger, not income
- [ ] Deposit refund/deduction workflow at lease termination
- [ ] Typecheck passes

### Epic C — Rent Billing & M-Pesa Collection

#### US-C1: Recurring rent invoice generation
**Description:** As the platform, I need to auto-generate a rent invoice each month per active lease so tenants know what's due.

**Acceptance Criteria:**
- [ ] Cron job (adapt Zeno's `recurring.ts`) generates invoice on lease's billing day
- [ ] Invoice amount = lease rent amount, editable for pro-rated first/last month
- [ ] Typecheck passes

#### US-C2: M-Pesa STK Push payment
**Description:** As a tenant, I want to pay rent from my phone via M-Pesa prompt so I don't need to visit an agent.

**Acceptance Criteria:**
- [ ] "Pay now" button in tenant portal triggers Daraja STK Push (port `mpesaDaraja.ts`)
- [ ] Callback updates invoice status to paid, posts to ledger
- [ ] Failed/cancelled STK shows retry option
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

#### US-C3: Paybill manual payment reconciliation
**Description:** As a landlord, I want manually-sent Paybill payments (account number = unit/lease ID) auto-matched to the right lease.

**Acceptance Criteria:**
- [ ] C2B confirmation webhook parses account number, matches to lease (port `match.ts`, `ref-format.ts`)
- [ ] Unmatched payments land in a "needs review" queue for manual assignment
- [ ] Typecheck passes

#### US-C4: Late fee rules
**Description:** As a landlord, I want to configure a late fee so overdue rent is automatically penalized.

**Acceptance Criteria:**
- [ ] Org-level setting: grace period days, late fee (flat or %)
- [ ] Late fee auto-applied to invoice after grace period, posted as separate ledger line
- [ ] Typecheck passes

#### US-C5: Arrears / aging view
**Description:** As a landlord, I want to see which tenants are behind on rent so I can follow up.

**Acceptance Criteria:**
- [ ] Aging report: current / 30 / 60 / 90+ days overdue, per tenant
- [ ] Reads from ledger, not invoice cache (Zeno's "reports never read document totals" rule)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### Epic D — Receipts & Tax Compliance

#### US-D1: eTIMS-compliant rent receipt
**Description:** As a tenant, I want an official receipt after paying rent so I have proof of payment for my records.

**Acceptance Criteria:**
- [ ] Receipt generated on payment confirmation (port `etims.ts` `TaxDevice` interface + `receipts/`)
- [ ] QR-coded, verifiable receipt (port `receipts/qr.ts`, `scan.ts`, `tokens.ts`)
- [ ] Marked as simulated/demo device until real OSCU/VSCU adapter is wired (same caveat as Zeno)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

#### US-D2: MRI tax auto-calculation
**Description:** As a landlord, I want my Monthly Rental Income tax calculated automatically so I don't miscalculate KRA obligations.

**Acceptance Criteria:**
- [ ] New `mri-tax.ts` module (template: Zeno's `tax.ts` — pure function, integer cents)
- [ ] 7.5% of gross rent collected in the month, per landlord org
- [ ] Skips calculation for landlords under KES 288,000/year threshold (configurable per org)
- [ ] Typecheck passes

#### US-D3: MRI tax due-date reminder
**Description:** As a landlord, I want a reminder before the 20th of the month so I don't miss my MRI filing.

**Acceptance Criteria:**
- [ ] Notification (email + SMS) sent 3 days before due date with computed amount
- [ ] Dismissible per-month, re-surfaces next cycle
- [ ] Typecheck passes

#### US-D4: eRITS export
**Description:** As a landlord, I want an export formatted for KRA's eRITS portal so filing is fast.

**Acceptance Criteria:**
- [ ] CSV/PDF export of monthly gross rent + tax due, per KRA eRITS field requirements
- [ ] Typecheck passes

### Epic E — Maintenance

#### US-E1: Tenant maintenance request
**Description:** As a tenant, I want to submit a maintenance request with photos so my landlord knows about the issue.

**Acceptance Criteria:**
- [ ] Form: category, description, photo upload (Supabase Storage), submitted from tenant portal
- [ ] Creates `maintenance_tickets` row linked to unit/lease, status `open`
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

#### US-E2: Landlord maintenance pipeline
**Description:** As a landlord, I want to track maintenance tickets through a status pipeline so nothing gets lost.

**Acceptance Criteria:**
- [ ] Statuses: open → assigned → in_progress → resolved → closed
- [ ] Assign to vendor (name/contact, no full vendor portal in v1)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

#### US-E3: Maintenance cost tracking
**Description:** As a landlord, I want maintenance costs posted to the ledger against the right property so my P&L is accurate.

**Acceptance Criteria:**
- [ ] Closing a ticket with a cost posts an expense journal entry (via ported `posting.ts` pattern) tagged to property/unit
- [ ] Typecheck passes

### Epic F — Notifications

#### US-F1: SMS rent reminders
**Description:** As a tenant, I want an SMS reminder before rent is due so I don't get a late fee.

**Acceptance Criteria:**
- [ ] SMS sent N days before due date (org-configurable), via ported `sms/advanta.ts`
- [ ] Includes amount, unit, pay link
- [ ] Typecheck passes

#### US-F2: Payment confirmation notification
**Description:** As a tenant, I want an SMS/email confirming my rent payment went through.

**Acceptance Criteria:**
- [ ] Triggered on successful M-Pesa callback
- [ ] Includes receipt link
- [ ] Typecheck passes

### Epic G — Reporting

#### US-G1: Landlord dashboard
**Description:** As a landlord, I want a home dashboard showing rent collected, arrears, and vacancies at a glance.

**Acceptance Criteria:**
- [ ] Cards: rent collected this month, total arrears, vacant units, MRI tax due
- [ ] Reads from ledger (not cached document totals)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

#### US-G2: Per-property P&L
**Description:** As a landlord, I want income/expenses per property so I know which properties are profitable.

**Acceptance Criteria:**
- [ ] P&L view filterable by property and date range, CSV export
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### Epic H — Tenant Portal

#### US-H1: Tenant dashboard
**Description:** As a tenant, I want to see my lease, current balance, and payment history in one place.

**Acceptance Criteria:**
- [ ] Shows lease terms, next due date/amount, balance, last 12 months payment history
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

#### US-H2: Tenant receipt/document access
**Description:** As a tenant, I want to download all my past receipts and my lease document.

**Acceptance Criteria:**
- [ ] Receipt list with PDF download, lease document viewable/downloadable
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

## 4. Functional Requirements

1. The system must support multiple landlord orgs with Row-Level-Security-enforced data isolation (Supabase Auth + Postgres RLS).
2. The system must allow an org to have `owner` and `manager` roles with differing permissions.
3. The system must allow a landlord to create/edit/archive properties and units under a property.
4. The system must allow a landlord to create a lease linking a tenant to a unit, capturing rent amount, deposit, term, and billing day.
5. The system must auto-flag a lease as `controlled_tenancy` when monthly rent ≤ KES 2,500, per the Rent Restriction Act.
6. The system must auto-generate a rent invoice per active lease on its billing day each month.
7. The system must support M-Pesa STK Push for tenant-initiated payment from the tenant portal.
8. The system must support M-Pesa C2B/Paybill confirmation webhooks and auto-match payments to leases via account-number reference (unit/lease ID).
9. The system must queue unmatched M-Pesa payments for manual landlord review.
10. The system must post every financial event (rent invoice, payment, deposit, expense, late fee) to a single append-only double-entry ledger; reports must read from the ledger, never from cached document totals.
11. The system must generate an eTIMS-formatted, QR-verifiable receipt on successful rent payment.
12. The system must calculate MRI tax (7.5% of gross monthly rent) per landlord org and surface it on the dashboard.
13. The system must send a tax due-date reminder (SMS + email) 3 days before the 20th of each month, when tax is owed.
14. The system must provide an eRITS-formatted export of monthly gross rent and tax due.
15. The system must allow tenants to submit maintenance requests with photos from the tenant portal.
16. The system must let landlords move maintenance tickets through a status pipeline and post resolved-ticket costs to the ledger against the correct property.
17. The system must send SMS rent-due reminders and payment-confirmation messages via the Advanta gateway.
18. The system must provide a landlord dashboard with rent collected, arrears, vacancies, and tax due.
19. The system must provide a per-property P&L report, filterable and CSV-exportable.
20. The system must provide a tenant dashboard showing lease terms, balance, and payment history.
21. The system must allow tenants to download past receipts and their lease document.
22. The system must support a late-fee rule (grace period + flat/percentage fee), configurable per org.
23. The system must track security deposits as a ledger liability, separate from rent income.
24. The system must use one shared design system (Zeno's Apple-HIG Tailwind components) across the landlord and tenant portals.

## 5. Non-Goals (Out of Scope for v1)

- Owner portal / agency payout-to-owner flows (deferred — v1 is direct landlord-to-tenant payment model only, per stack decision)
- Vendor/contractor self-service portal (vendors are tracked as contacts only, no login)
- Real eTIMS OSCU/VSCU hardware integration (simulated device only, same as Zeno)
- Multi-currency support
- Platform billing/monetization (subscription, free tier, or transaction fee — explicitly undecided, see Open Questions)
- Payroll, staff time tracking, CRM/sales pipeline (Zeno features that don't apply to rental)
- Property listing/marketplace features (advertising vacant units publicly)
- Automated tenant screening/credit checks (may be a v2 integration with a Kenyan screening provider)
- Mobile native apps (web-only, responsive, for v1)
- microrealestate code reuse of any kind (reference/inspiration only, confirmed incompatible license)

## 6. Design Considerations

- Single design system: Zeno's Apple-HIG-inspired Tailwind components (see `docs/DESIGN.md` in `zoho-books-clone copy 2`) reused verbatim across landlord/admin portal and tenant portal — same look, same components, no separate tenant-facing style.
- Landlord portal: dense, data-forward (property/unit/lease tables, dashboards) — same information density as Zeno's admin views.
- Tenant portal: simpler, mobile-first — most tenants will use this from a phone browser to pay rent.
- Money displayed in KES, integer cents internally (Zeno convention) to avoid float rounding errors.

## 7. Technical Considerations

- **Frontend:** Next.js 16 (App Router, Turbopack default), built fresh — no code ported from microrealestate.
- **Backend/DB/Auth:** Supabase (Postgres + Auth + Storage), replacing microrealestate's Express/Mongo and Zeno's separate auth pattern.
- **ORM:** Drizzle over Supabase Postgres — chosen specifically so Zeno's `posting.ts`, `tax.ts`-pattern, and ledger modules port with minimal rewrite.
- **Ported modules from `zoho-books-clone copy 2`:** `src/lib/payments/mpesaDaraja.ts`, `match.ts`, `ref-format.ts`, `phone.ts`; `src/lib/etims.ts`; `src/lib/receipts/*`; `src/lib/sms/advanta.ts`; `src/lib/posting.ts` (ledger pattern); `src/lib/client-portal/auth.ts` (evaluate vs. Supabase Auth invite flow, keep leaner option).
- **New modules:** `mri-tax.ts` (MRI 7.5% calculator, modeled on Zeno's `tax.ts`), property/unit/lease/maintenance schema, controlled-tenancy flagging logic.
- **Multi-tenancy:** enforced via Postgres RLS keyed on `org_id`, not application-layer filtering alone.
- **Cron/scheduled jobs:** recurring invoice generation, tax reminders — needs a scheduler (Supabase Edge Functions + `pg_cron`, or Vercel Cron if deployed there).
- **eTIMS caveat:** current receipt module is a simulated control unit; real OSCU/VSCU integration is a hard requirement before any production filing use — must not silently ship as "real" eTIMS.

## 8. Success Metrics

- Landlord can go from signup to first invoiced lease in under 10 minutes.
- 95%+ of M-Pesa STK Push payments auto-reconcile to the correct lease without manual review.
- Zero ledger/report mismatches (reports always derived from ledger, never drift from cached totals).
- MRI tax figure matches manual calculation in 100% of test cases before any real filing use.
- Maintenance ticket median time-to-resolution tracked and visible on landlord dashboard.

## 9. Open Questions

- Platform monetization model (subscription vs. free-tier vs. transaction fee) — explicitly deferred, needs a decision before pricing/billing pages are built.
- Owner-portal / agency payout model — do we design the schema to allow adding this later without a rewrite, even though it's out of scope for v1?
- Tenant screening — build in-house or integrate a third-party Kenyan screening API in v2?
- Which scheduler to use for cron jobs (Supabase pg_cron vs. Vercel Cron vs. external worker) — depends on final hosting choice, not yet decided.
- Real eTIMS OSCU/VSCU vendor selection and integration timeline.
- Deposit refund workflow detail (partial deductions, dispute handling) needs more definition before US-B6 is built.
