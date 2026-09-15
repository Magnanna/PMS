CREATE TYPE "public"."invoice_line_kind" AS ENUM('rent', 'water', 'service_charge', 'garbage', 'deposit', 'late_fee', 'other');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'open', 'partially_paid', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."lease_status" AS ENUM('active', 'terminated', 'expired');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('sms', 'email');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'manager');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('mpesa_stk', 'mpesa_c2b', 'cash', 'bank', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'confirmed', 'held_for_review', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('residential', 'commercial', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'assigned', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."unit_status" AS ENUM('vacant', 'occupied', 'maintenance');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"actor_user_id" uuid,
	"actor_role" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"before_summary" jsonb,
	"after_summary" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"kind" "invoice_line_kind" NOT NULL,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"billing_period" date NOT NULL,
	"status" "invoice_status" DEFAULT 'open' NOT NULL,
	"due_date" date NOT NULL,
	"reference" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"memo" text,
	"posted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_by_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"account" text NOT NULL,
	"property_id" uuid,
	"unit_id" uuid,
	"debit_cents" bigint DEFAULT 0 NOT NULL,
	"credit_cents" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lease_amendments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"effective_date" date NOT NULL,
	"changed_fields" jsonb NOT NULL,
	"reason" text,
	"accepted_by_user_id" uuid,
	"accepted_at" timestamp with time zone,
	"accepted_ip" text,
	"document_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"tenant_profile_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"rent_amount_cents" bigint NOT NULL,
	"deposit_amount_cents" bigint DEFAULT 0 NOT NULL,
	"billing_day" integer NOT NULL,
	"controlled_tenancy" boolean DEFAULT false NOT NULL,
	"guarantor_name" text,
	"guarantor_phone" text,
	"lease_document_path" text,
	"status" "lease_status" DEFAULT 'active' NOT NULL,
	"terminated_at" timestamp with time zone,
	"termination_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"lease_id" uuid,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"vendor_id" uuid,
	"cost_cents" bigint,
	"billable_to_tenant" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "mpesa_credentials_per_org" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"shortcode_type" text NOT NULL,
	"shortcode" text NOT NULL,
	"account_number_prefix" text,
	"consumer_key_encrypted" text NOT NULL,
	"consumer_secret_encrypted" text NOT NULL,
	"passkey_encrypted" text,
	"environment" text DEFAULT 'sandbox' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"tenant_profile_id" uuid,
	"channel" "notification_channel" NOT NULL,
	"template" text NOT NULL,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"gateway_id" text,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_settings" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"late_fee_enabled" boolean DEFAULT false NOT NULL,
	"late_fee_grace_days" integer DEFAULT 0 NOT NULL,
	"late_fee_flat_cents" bigint,
	"late_fee_percent_bps" integer,
	"reminder_days_before" integer DEFAULT 3 NOT NULL,
	"sms_monthly_cost_cap_cents" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kra_pin" text,
	"registered_address" text,
	"contact_person" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"compliance_overrides" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"amount_cents" bigint NOT NULL,
	"mpesa_receipt_number" text,
	"reference_note" text,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reversal_of_payment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"county" text,
	"type" "property_type" DEFAULT 'residential' NOT NULL,
	"lr_number" text,
	"title_ref" text,
	"construction_year" integer,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"token" text NOT NULL,
	"simulated" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"id_number" text,
	"id_document_path" text,
	"kra_pin" text,
	"employer" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"unit_number" text NOT NULL,
	"bedrooms" integer,
	"rent_amount_cents" bigint NOT NULL,
	"status" "unit_status" DEFAULT 'vacant' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_amendments" ADD CONSTRAINT "lease_amendments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_amendments" ADD CONSTRAINT "lease_amendments_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_tenant_profile_id_tenant_profiles_id_fk" FOREIGN KEY ("tenant_profile_id") REFERENCES "public"."tenant_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_attachments" ADD CONSTRAINT "maintenance_attachments_ticket_id_maintenance_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."maintenance_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mpesa_credentials_per_org" ADD CONSTRAINT "mpesa_credentials_per_org_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_tenant_profile_id_tenant_profiles_id_fk" FOREIGN KEY ("tenant_profile_id") REFERENCES "public"."tenant_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_profiles" ADD CONSTRAINT "tenant_profiles_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_org_idx" ON "audit_logs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_idx" ON "invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_lease_period_uq" ON "invoices" USING btree ("lease_id","billing_period");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_org_reference_uq" ON "invoices" USING btree ("org_id","reference");--> statement-breakpoint
CREATE INDEX "invoices_org_idx" ON "invoices" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "journal_entries_org_idx" ON "journal_entries" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "journal_entries_source_idx" ON "journal_entries" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "journal_lines_entry_idx" ON "journal_lines" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "lease_amendments_lease_idx" ON "lease_amendments" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "leases_org_idx" ON "leases" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "leases_unit_idx" ON "leases" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "leases_tenant_idx" ON "leases" USING btree ("tenant_profile_id");--> statement-breakpoint
CREATE INDEX "maintenance_attachments_ticket_idx" ON "maintenance_attachments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "maintenance_tickets_org_idx" ON "maintenance_tickets" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "maintenance_tickets_unit_idx" ON "maintenance_tickets" USING btree ("unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mpesa_credentials_org_uq" ON "mpesa_credentials_per_org" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "notification_log_org_idx" ON "notification_log" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_members_org_user_uq" ON "org_members" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_idx" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_invoice_idx" ON "payment_allocations" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payments_org_idx" ON "payments" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "payments_lease_idx" ON "payments" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "properties_org_idx" ON "properties" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_token_uq" ON "receipts" USING btree ("token");--> statement-breakpoint
CREATE INDEX "receipts_org_idx" ON "receipts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "tenant_profiles_org_idx" ON "tenant_profiles" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "tenant_profiles_user_idx" ON "tenant_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "units_property_number_uq" ON "units" USING btree ("property_id","unit_number");--> statement-breakpoint
CREATE INDEX "units_org_idx" ON "units" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_source_external_uq" ON "webhook_events" USING btree ("source","external_id");