CREATE TABLE "impersonation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform_admin_user_id" uuid NOT NULL,
	"target_org_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"role" text DEFAULT 'staff' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "suspended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "suspended_reason" text;--> statement-breakpoint
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_target_org_id_orgs_id_fk" FOREIGN KEY ("target_org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "impersonation_sessions_org_idx" ON "impersonation_sessions" USING btree ("target_org_id");--> statement-breakpoint

-- Platform-only tables (US-J3): no authenticated/anon policy is granted on
-- purpose — reads/writes happen exclusively via server actions on the
-- DATABASE_URL role, mirroring the journal_entries write-lockdown pattern.
-- Enabling RLS with zero policies denies both roles by default.
alter table platform_admins enable row level security;--> statement-breakpoint
alter table impersonation_sessions enable row level security;