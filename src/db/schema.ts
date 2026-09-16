import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  date,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/**
 * M0 baseline schema — PRD v2 Section 7 ("Data Model: key entities & invariants").
 *
 * Conventions (Section 12 of the PRD, non-negotiable):
 * - Money is ALWAYS integer cents (bigint), never float/numeric.
 * - Every org-scoped table carries org_id; RLS policies land in a follow-up
 *   migration per table (CI-checked — no table without a policy).
 * - Financial rows are append-only: journal_entries/journal_lines are never
 *   UPDATEd or DELETEd; corrections are reversal entries (voided_by).
 * - Timestamps stored UTC; presented/scheduled in Africa/Nairobi (NFR-4).
 */

// ---------- Enums ----------

export const orgRoleEnum = pgEnum("org_role", ["owner", "manager"]);
export const propertyTypeEnum = pgEnum("property_type", [
  "residential",
  "commercial",
  "mixed",
]);
export const unitStatusEnum = pgEnum("unit_status", [
  "vacant",
  "occupied",
  "maintenance",
]);
export const leaseStatusEnum = pgEnum("lease_status", [
  "active",
  "terminated",
  "expired",
]);
export const invoiceLineKindEnum = pgEnum("invoice_line_kind", [
  "rent",
  "water",
  "service_charge",
  "garbage",
  "deposit",
  "late_fee",
  "other",
]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "open",
  "partially_paid",
  "paid",
  "void",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "mpesa_stk",
  "mpesa_c2b",
  "cash",
  "bank",
  "other",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "confirmed",
  "held_for_review",
  "reversed",
  "failed", // STK push cancelled/failed at the phone — money never moved
]);
export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
]);
export const notificationChannelEnum = pgEnum("notification_channel", [
  "sms",
  "email",
]);
export const notificationStatusEnum = pgEnum("notification_status", [
  "queued",
  "sent",
  "failed",
]);

// ---------- Org & identity (Epic A) ----------

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kraPin: text("kra_pin"),
  registeredAddress: text("registered_address"),
  contactPerson: text("contact_person"),
  plan: text("plan").notNull().default("free"), // OQ-1 monetization stub
  // Per-org overrides of Section 3 compliance constants; null = use platform default.
  complianceOverrides: jsonb("compliance_overrides"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orgMembers = pgTable(
  "org_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    userId: uuid("user_id").notNull(), // auth.users.id
    role: orgRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("org_members_org_user_uq").on(t.orgId, t.userId)]
);

// tenant_profiles: per-org person record. Linked to an auth.users id only
// once claimed via invite (US-A4) — supports one person tenanting under
// multiple orgs (US-A5) without assuming tenant === org member.
export const tenantProfiles = pgTable(
  "tenant_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    userId: uuid("user_id"), // auth.users.id, null until invite claimed
    name: text("name").notNull(),
    phone: text("phone").notNull(), // normalized Kenyan format (payments/phone.ts)
    email: text("email"),
    idNumber: text("id_number"), // access-controlled field, see US-J2
    idDocumentPath: text("id_document_path"), // private storage path
    kraPin: text("kra_pin"),
    employer: text("employer"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tenant_profiles_org_idx").on(t.orgId), index("tenant_profiles_user_idx").on(t.userId)]
);

// ---------- Properties, units, leases (Epic B) ----------

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    name: text("name").notNull(),
    address: text("address").notNull(),
    county: text("county"),
    type: propertyTypeEnum("type").notNull().default("residential"),
    lrNumber: text("lr_number"), // Land Reference — eRITS field (US-B7)
    titleRef: text("title_ref"),
    constructionYear: integer("construction_year"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("properties_org_idx").on(t.orgId)]
);

export const units = pgTable(
  "units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    propertyId: uuid("property_id").notNull().references(() => properties.id),
    unitNumber: text("unit_number").notNull(),
    bedrooms: integer("bedrooms"),
    rentAmountCents: bigint("rent_amount_cents", { mode: "number" }).notNull(),
    status: unitStatusEnum("status").notNull().default("vacant"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("units_property_number_uq").on(t.propertyId, t.unitNumber),
    index("units_org_idx").on(t.orgId),
  ]
);

export const leases = pgTable(
  "leases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    unitId: uuid("unit_id").notNull().references(() => units.id),
    tenantProfileId: uuid("tenant_profile_id").notNull().references(() => tenantProfiles.id),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"), // null = month-to-month
    rentAmountCents: bigint("rent_amount_cents", { mode: "number" }).notNull(),
    depositAmountCents: bigint("deposit_amount_cents", { mode: "number" }).notNull().default(0),
    billingDay: integer("billing_day").notNull(), // 1–28, enforced at app layer
    // Derived, never hand-edited (Section 7 invariant) — set by app logic from
    // compliance constants at creation/amendment time.
    controlledTenancy: boolean("controlled_tenancy").notNull().default(false),
    guarantorName: text("guarantor_name"),
    guarantorPhone: text("guarantor_phone"),
    leaseDocumentPath: text("lease_document_path"),
    status: leaseStatusEnum("status").notNull().default("active"),
    terminatedAt: timestamp("terminated_at", { withTimezone: true }),
    terminationReason: text("termination_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("leases_org_idx").on(t.orgId),
    index("leases_unit_idx").on(t.unitId),
    index("leases_tenant_idx").on(t.tenantProfileId),
  ]
);

export const leaseAmendments = pgTable(
  "lease_amendments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    leaseId: uuid("lease_id").notNull().references(() => leases.id),
    effectiveDate: date("effective_date").notNull(),
    changedFields: jsonb("changed_fields").notNull(), // { rentAmountCents: { from, to }, ... }
    reason: text("reason"),
    // Tenant e-acceptance evidence log (US-B8) — not a full e-signature.
    acceptedByUserId: uuid("accepted_by_user_id"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedIp: text("accepted_ip"),
    documentHash: text("document_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lease_amendments_lease_idx").on(t.leaseId)]
);

// ---------- Invoices, payments, allocations (Epic C) ----------

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    leaseId: uuid("lease_id").notNull().references(() => leases.id),
    billingPeriod: date("billing_period").notNull(), // first-of-month marker for the period
    status: invoiceStatusEnum("status").notNull().default("open"),
    dueDate: date("due_date").notNull(),
    reference: text("reference").notNull(), // org-unique, used as M-Pesa account number (ref-format.ts)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Idempotent invoice generation — FR-6, US-C1.
    uniqueIndex("invoices_lease_period_uq").on(t.leaseId, t.billingPeriod),
    uniqueIndex("invoices_org_reference_uq").on(t.orgId, t.reference),
    index("invoices_org_idx").on(t.orgId),
  ]
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
    kind: invoiceLineKindEnum("kind").notNull(),
    description: text("description").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invoice_lines_invoice_idx").on(t.invoiceId)]
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    leaseId: uuid("lease_id").notNull().references(() => leases.id),
    method: paymentMethodEnum("method").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    mpesaReceiptNumber: text("mpesa_receipt_number"),
    // Daraja's CheckoutRequestID, set when an STK push is initiated so the
    // callback (which carries this same id) can find the pending row.
    providerRequestRef: text("provider_request_ref"),
    referenceNote: text("reference_note"),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    // Append-only correction trail — never UPDATE a confirmed payment's amount.
    reversalOfPaymentId: uuid("reversal_of_payment_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payments_org_idx").on(t.orgId),
    index("payments_lease_idx").on(t.leaseId),
    uniqueIndex("payments_provider_request_ref_uq").on(t.providerRequestRef),
  ]
);

export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id").notNull().references(() => payments.id),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payment_allocations_payment_idx").on(t.paymentId),
    index("payment_allocations_invoice_idx").on(t.invoiceId),
  ]
);

// ---------- Ledger — append-only double-entry (Section 7 core invariant) ----------

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    // Free-text pointer back to the source document (invoice/payment/ticket/etc).
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    memo: text("memo"),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
    // Self-reference: a reversal entry points at the entry it voids. Original
    // rows are never updated/deleted — Section 12 "append-only law".
    voidedByEntryId: uuid("voided_by_entry_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("journal_entries_org_idx").on(t.orgId), index("journal_entries_source_idx").on(t.sourceType, t.sourceId)]
);

export const journalLines = pgTable(
  "journal_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id").notNull().references(() => journalEntries.id),
    // Simple account tag for v1 (rental_income, mpesa_cash, deposit_liability,
    // maintenance_expense, mri_tax_payable, ...) rather than a full COA table.
    account: text("account").notNull(),
    propertyId: uuid("property_id").references(() => properties.id),
    unitId: uuid("unit_id").references(() => units.id),
    debitCents: bigint("debit_cents", { mode: "number" }).notNull().default(0),
    creditCents: bigint("credit_cents", { mode: "number" }).notNull().default(0),
  },
  (t) => [index("journal_lines_entry_idx").on(t.entryId)]
);

// ---------- Receipts ----------

export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    paymentId: uuid("payment_id").notNull().references(() => payments.id),
    token: text("token").notNull(), // QR verification token — resolves to /r/[token]
    simulated: boolean("simulated").notNull().default(true), // eTIMS watermark flag, US-D1
    cuInvoiceNumber: text("cu_invoice_number"), // simulated eTIMS control-unit invoice number
    cuSerial: text("cu_serial"), // simulated control-unit serial
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("receipts_token_uq").on(t.token), index("receipts_org_idx").on(t.orgId)]
);

// ---------- Maintenance (Epic E) ----------

export const vendors = pgTable("vendors", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id),
  name: text("name").notNull(),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const maintenanceTickets = pgTable(
  "maintenance_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    unitId: uuid("unit_id").notNull().references(() => units.id),
    leaseId: uuid("lease_id").references(() => leases.id),
    category: text("category").notNull(),
    description: text("description").notNull(),
    status: ticketStatusEnum("status").notNull().default("open"),
    vendorId: uuid("vendor_id").references(() => vendors.id),
    costCents: bigint("cost_cents", { mode: "number" }),
    billableToTenant: boolean("billable_to_tenant").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("maintenance_tickets_org_idx").on(t.orgId), index("maintenance_tickets_unit_idx").on(t.unitId)]
);

export const maintenanceAttachments = pgTable(
  "maintenance_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id").notNull().references(() => maintenanceTickets.id),
    storagePath: text("storage_path").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("maintenance_attachments_ticket_idx").on(t.ticketId)]
);

// ---------- Payments infra: idempotency, credentials, notifications, audit ----------

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => orgs.id),
    source: text("source").notNull(), // 'mpesa_stk' | 'mpesa_c2b'
    externalId: text("external_id").notNull(), // CheckoutRequestID / TransID
    rawPayload: jsonb("raw_payload").notNull(),
    processed: boolean("processed").notNull().default(false),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("webhook_events_source_external_uq").on(t.source, t.externalId)]
);

export const mpesaCredentials = pgTable(
  "mpesa_credentials_per_org",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    shortcodeType: text("shortcode_type").notNull(), // 'paybill' | 'till'
    shortcode: text("shortcode").notNull(),
    accountNumberPrefix: text("account_number_prefix"),
    // Encrypted at rest (pgcrypto/Supabase Vault) — never stored/logged plaintext.
    consumerKeyEncrypted: text("consumer_key_encrypted").notNull(),
    consumerSecretEncrypted: text("consumer_secret_encrypted").notNull(),
    passkeyEncrypted: text("passkey_encrypted"),
    environment: text("environment").notNull().default("sandbox"), // 'sandbox' | 'live'
    // Daraja has no callback signature — a random per-org token in the
    // callback URL is what authenticates inbound webhooks (US-C10, NFR-2).
    webhookToken: text("webhook_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("mpesa_credentials_org_uq").on(t.orgId)]
);

export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    tenantProfileId: uuid("tenant_profile_id").references(() => tenantProfiles.id),
    channel: notificationChannelEnum("channel").notNull(),
    template: text("template").notNull(),
    status: notificationStatusEnum("status").notNull().default("queued"),
    gatewayId: text("gateway_id"),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notification_log_org_idx").on(t.orgId)]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => orgs.id),
    actorUserId: uuid("actor_user_id"),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    beforeSummary: jsonb("before_summary"),
    afterSummary: jsonb("after_summary"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_org_idx").on(t.orgId)]
);

// ---------- Org settings ----------

export const orgSettings = pgTable("org_settings", {
  orgId: uuid("org_id").primaryKey().references(() => orgs.id),
  lateFeeEnabled: boolean("late_fee_enabled").notNull().default(false),
  lateFeeGraceDays: integer("late_fee_grace_days").notNull().default(0),
  lateFeeFlatCents: bigint("late_fee_flat_cents", { mode: "number" }),
  lateFeePercent: integer("late_fee_percent_bps"), // basis points, e.g. 500 = 5%
  reminderDaysBefore: integer("reminder_days_before").notNull().default(3),
  smsMonthlyCostCapCents: bigint("sms_monthly_cost_cap_cents", { mode: "number" }),
  // OQ-9: owner-portal schema readiness, nullable, no UI in v1.
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
